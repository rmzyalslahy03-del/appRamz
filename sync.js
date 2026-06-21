// ======================================================================
// sync.js - الإصدار النهائي v5.5 (مزامنة محلية مع وسيط مؤقت)
// ======================================================================

(function() {
    'use strict';

    // ======================================================================
    // التكوين الأساسي
    // ======================================================================
    const CONFIG = {
        MAX_RETRIES: 5,                    // أقصى عدد محاولات لإعادة إرسال رسالة
        BASE_DELAY: 2000,                  // التأخير الأساسي (بالملي ثانية)
        MAX_DELAY: 60000,                  // أقصى تأخير (دقيقة واحدة)
        SYNC_INTERVAL: 15000,              // الفاصل الزمني للمزامنة الدورية (15 ثانية)
        BATCH_SIZE: 5,                     // عدد الرسائل المرسلة في كل دفعة
        MAX_PENDING_STORAGE: 1000,         // أقصى عدد رسائل معلقة في التخزين المحلي
        RETRY_JITTER: 500,                 // قيمة عشوائية لتجنب التزامن
        CLEANUP_INTERVAL: 3600000,         // تنظيف الرسائل القديمة كل ساعة
        FETCH_INTERVAL: 30000,             // جلب الرسائل الجديدة كل 30 ثانية (عند عدم وجود رسائل معلقة)
        PENDING_MESSAGES_TABLE: 'pending_messages' // اسم الجدول في Supabase
    };

    let isSyncing = false;
    let periodicSyncInterval = null;
    let fetchInterval = null;
    let isOnline = navigator.onLine;
    let syncAttempts = 0;
    let lastSyncTime = 0;
    let retryTimeouts = [];

    // ======================================================================
    // دوال مساعدة (تعتمد على db.js و supabase.js)
    // ======================================================================

    // الحصول على الرسائل المعلقة من التخزين المحلي
    function getPendingMessages() {
        const all = [];
        const chats = window.getChats ? window.getChats() : [];
        for (const chat of chats) {
            const msgs = window.getMessages ? window.getMessages(chat.id) : [];
            for (const m of msgs) {
                if (m.sync_status === 'pending-send' || m.sync_status === 'failed') {
                    all.push(m);
                }
            }
        }
        return all;
    }

    // تحديث حالة رسالة في التخزين المحلي
    function updateMessageStatus(msgId, updates) {
        if (window.updateMessage) {
            try {
                window.updateMessage(msgId, updates);
            } catch (e) {
                console.warn('⚠️ فشل تحديث حالة الرسالة:', e);
            }
        }
    }

    // إضافة رسالة (للاستقبال)
    function addMessageLocally(msg) {
        if (window.addMessage) {
            try {
                window.addMessage(msg);
            } catch (e) {
                console.warn('⚠️ فشل إضافة الرسالة:', e);
            }
        }
    }

    // الحصول على محادثة
    function getChat(chatId) {
        if (window.getChat) return window.getChat(chatId);
        const chats = window.getChats ? window.getChats() : [];
        return chats.find(c => c.id === chatId);
    }

    // حفظ محادثة
    function saveChat(chatData) {
        if (window.saveChat) {
            try {
                window.saveChat(chatData);
            } catch (e) {
                console.warn('⚠️ فشل حفظ المحادثة:', e);
            }
        }
    }

    // دوال التحديث (للواجهة)
    function renderMessages() {
        if (typeof renderMessages === 'function') renderMessages();
        else if (window.renderMessages) window.renderMessages();
    }

    function renderChats() {
        if (typeof renderChats === 'function') renderChats();
        else if (window.renderChats) window.renderChats();
    }

    function showToast(message) {
        if (typeof toast === 'function') toast(message);
        else if (window.toast) window.toast(message);
        else console.log('📢', message);
    }

    // تشغيل صوت الإشعار
    function playNotificationSound() {
        if (typeof playNotificationSound === 'function') playNotificationSound();
        else if (window.playNotificationSound) window.playNotificationSound();
    }

    // ======================================================================
    // التحقق من صحة الرسالة وتنظيفها
    // ======================================================================

    function isValidMessage(msg) {
        if (!msg) return false;
        if (!msg.id) return false;
        if (!msg.chat_id && !msg.sid) return false;
        if (msg.likes !== undefined && typeof msg.likes !== 'number') msg.likes = Number(msg.likes) || 0;
        if (msg.sync_attempts !== undefined && typeof msg.sync_attempts !== 'number') msg.sync_attempts = Number(msg.sync_attempts) || 0;
        return true;
    }

    function cleanMessageForSync(msg) {
        const clean = { ...msg };
        if (clean.likes !== undefined) clean.likes = Number(clean.likes) || 0;
        if (clean.sync_attempts !== undefined) clean.sync_attempts = Number(clean.sync_attempts) || 0;
        if (!clean.chat_id && clean.sid) clean.chat_id = clean.sid;
        delete clean._typing;
        delete clean._temp;
        delete clean._localOnly;
        return clean;
    }

    function getRetryDelay(attempts) {
        const base = Math.min(CONFIG.BASE_DELAY * Math.pow(2, attempts), CONFIG.MAX_DELAY);
        const jitter = Math.random() * CONFIG.RETRY_JITTER;
        return Math.min(base + jitter, CONFIG.MAX_DELAY);
    }

    // ======================================================================
    // مزامنة رسالة واحدة (مع إعادة المحاولة)
    // ======================================================================

    async function syncSingleMessage(msg) {
        // تحقق من الاتصال
        if (!navigator.onLine) {
            return { success: false, offline: true };
        }

        // تحقق من صحة الرسالة
        if (!isValidMessage(msg)) {
            console.warn('⚠️ رسالة غير صالحة للمزامنة:', msg.id);
            updateMessageStatus(msg.id, {
                sync_status: 'failed',
                status: 'failed',
                sync_error: 'بيانات غير صالحة'
            });
            return { success: false, error: 'بيانات غير صالحة' };
        }

        // تنظيف الرسالة
        const cleanMsg = cleanMessageForSync(msg);

        // تحديث الحالة إلى "جاري الإرسال"
        updateMessageStatus(msg.id, { sync_status: 'sending' });

        try {
            // استخدام وسيط Supabase (sendMessageRealtime)
            if (window.sendMessageRealtime) {
                const result = await window.sendMessageRealtime(cleanMsg);
                if (result.success) {
                    // تم الإرسال بنجاح
                    updateMessageStatus(msg.id, {
                        sync_status: 'sent',
                        status: 'sent',
                        sync_time: new Date().toISOString(),
                        sync_attempts: 0,
                        sync_error: null
                    });
                    return { success: true };
                } else if (result.offline) {
                    // غير متصل
                    return { success: false, offline: true };
                } else {
                    // فشل الإرسال - زيادة عدد المحاولات
                    const attempts = (msg.sync_attempts || 0) + 1;
                    const newStatus = attempts >= CONFIG.MAX_RETRIES ? 'failed' : 'pending-send';
                    updateMessageStatus(msg.id, {
                        sync_status: newStatus,
                        status: newStatus === 'failed' ? 'failed' : 'pending-send',
                        sync_error: result.error || 'فشل الإرسال',
                        sync_attempts: attempts
                    });
                    return { success: false, error: result.error, attempts };
                }
            } else {
                console.warn('⚠️ window.sendMessageRealtime غير متوفرة');
                updateMessageStatus(msg.id, {
                    sync_status: 'failed',
                    status: 'failed',
                    sync_error: 'sendMessageRealtime غير متوفرة'
                });
                return { success: false, error: 'sendMessageRealtime غير متوفرة' };
            }
        } catch (e) {
            console.error('❌ خطأ في مزامنة الرسالة:', e);
            const attempts = (msg.sync_attempts || 0) + 1;
            const newStatus = attempts >= CONFIG.MAX_RETRIES ? 'failed' : 'pending-send';
            updateMessageStatus(msg.id, {
                sync_status: newStatus,
                status: newStatus === 'failed' ? 'failed' : 'pending-send',
                sync_error: e.message || 'خطأ غير معروف',
                sync_attempts: attempts
            });
            return { success: false, error: e.message, attempts };
        }
    }

    // ======================================================================
    // المزامنة الرئيسية لجميع الرسائل المعلقة
    // ======================================================================

    window.syncAllPendingMessages = async function() {
        // منع التزامن المتكرر
        if (isSyncing) {
            console.log('⏳ المزامنة قيد التشغيل بالفعل');
            return { synced: 0, failed: 0, alreadyRunning: true };
        }

        // التحقق من الاتصال
        if (!navigator.onLine) {
            console.log('📡 غير متصل بالإنترنت، تأجيل المزامنة');
            return { synced: 0, failed: 0, offline: true };
        }

        // التأكد من أن الوسيط جاهز
        if (!window.supabaseClient && !window.sendMessageRealtime) {
            console.warn('⚠️ الوسيط غير متاح، تأجيل المزامنة');
            return { synced: 0, failed: 0, brokerUnavailable: true };
        }

        isSyncing = true;
        let synced = 0;
        let failed = 0;
        lastSyncTime = Date.now();

        try {
            // جلب الرسائل المعلقة
            const pending = getPendingMessages();

            if (pending.length === 0) {
                console.log('✅ لا توجد رسائل معلقة للمزامنة');
                isSyncing = false;
                return { synced: 0, failed: 0 };
            }

            console.log(`📤 بدء مزامنة ${pending.length} رسالة معلقة`);

            // ترتيب حسب الأقدمية
            pending.sort((a, b) => new Date(a.time) - new Date(b.time));

            // تصفية الرسائل التي تجاوزت عدد المحاولات
            const validPending = pending.filter(m => (m.sync_attempts || 0) < CONFIG.MAX_RETRIES);
            const stuckMessages = pending.filter(m => (m.sync_attempts || 0) >= CONFIG.MAX_RETRIES);
            failed += stuckMessages.length;

            // معالجة الدفعات
            for (let i = 0; i < validPending.length; i += CONFIG.BATCH_SIZE) {
                // التأكد من استمرار الاتصال
                if (!navigator.onLine) {
                    console.warn('⚠️ انقطع الاتصال أثناء المزامنة');
                    isSyncing = false;
                    return { synced, failed, offline: true, partial: true };
                }

                const batch = validPending.slice(i, i + CONFIG.BATCH_SIZE);
                const results = await Promise.all(batch.map(msg => syncSingleMessage(msg)));

                for (const res of results) {
                    if (res.success) {
                        synced++;
                    } else if (res.offline) {
                        // انقطع الاتصال، نوقف المعالجة
                        isSyncing = false;
                        return { synced, failed, offline: true, partial: true };
                    } else {
                        failed++;
                    }
                }

                // تأخير بسيط بين الدفعات
                if (i + CONFIG.BATCH_SIZE < validPending.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // تحديث الواجهة بعد المزامنة
            renderChats();
            renderMessages();

            console.log(`✅ اكتملت المزامنة: ${synced} ناجحة، ${failed} فاشلة`);
            return { synced, failed, offline: false };

        } catch (e) {
            console.error('❌ خطأ أثناء المزامنة:', e);
            return { synced, failed, error: e.message };
        } finally {
            isSyncing = false;
            syncAttempts++;
        }
    };

    // ======================================================================
    // جلب الرسائل الجديدة من الوسيط (باستخدام fetchPendingMessages)
    // ======================================================================

    async function fetchNewMessages() {
        if (!navigator.onLine || !window.fetchPendingMessages) {
            return;
        }

        if (isSyncing) {
            console.log('⏳ المزامنة قيد التشغيل، تأجيل جلب الرسائل');
            return;
        }

        try {
            // جلب الرسائل المعلقة من الوسيط (لكل المحادثات النشطة)
            const chats = window.getChats ? window.getChats() : [];
            let newMessagesCount = 0;

            for (const chat of chats) {
                // فقط المحادثات التي لها اشتراك نشط (أو التي تم فتحها)
                if (chat.id) {
                    await window.fetchPendingMessages(chat.id);
                    // fetchPendingMessages ستقوم بإضافة الرسائل إلى التخزين المحلي
                    newMessagesCount++;
                }
            }

            if (newMessagesCount > 0) {
                renderChats();
                renderMessages();
                playNotificationSound();
            }
        } catch (e) {
            console.warn('⚠️ فشل جلب الرسائل الجديدة:', e);
        }
    }

    // ======================================================================
    // دوال إضافية للتحكم في المزامنة
    // ======================================================================

    // إضافة رسالة لقائمة الانتظار
    window.queueMessageForSync = function(msg) {
        if (!msg || !msg.id) return;
        if (msg.sync_status !== 'pending-send' && msg.sync_status !== 'failed') {
            updateMessageStatus(msg.id, { sync_status: 'pending-send' });
        }
        if (navigator.onLine && !isSyncing) {
            setTimeout(() => window.syncAllPendingMessages(), 500);
        }
    };

    // فرض المزامنة فوراً
    window.forceSyncNow = function() {
        return window.syncAllPendingMessages();
    };

    // إعادة محاولة رسالة محددة
    window.retryMessage = async function(msgId) {
        const pending = getPendingMessages();
        const msg = pending.find(m => m.id === msgId);
        if (!msg) return { success: false, error: 'الرسالة غير موجودة' };
        updateMessageStatus(msgId, { sync_attempts: 0, sync_status: 'pending-send' });
        return await syncSingleMessage({ ...msg, sync_attempts: 0 });
    };

    // إعادة محاولة جميع الرسائل الفاشلة
    window.retryAllFailed = async function() {
        const pending = getPendingMessages();
        const failedMsgs = pending.filter(m => m.sync_status === 'failed');
        for (const m of failedMsgs) {
            updateMessageStatus(m.id, { sync_attempts: 0, sync_status: 'pending-send' });
        }
        return window.syncAllPendingMessages();
    };

    // الحصول على إحصائيات المزامنة
    window.getSyncStats = function() {
        const pending = getPendingMessages();
        const stats = {
            pending: pending.length,
            total: 0,
            byStatus: {},
            isSyncing: isSyncing,
            online: navigator.onLine,
            lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
            attempts: syncAttempts
        };
        const chats = window.getChats ? window.getChats() : [];
        for (const c of chats) {
            const msgs = window.getMessages ? window.getMessages(c.id) : [];
            stats.total += msgs.length;
            for (const m of msgs) {
                stats.byStatus[m.sync_status] = (stats.byStatus[m.sync_status] || 0) + 1;
            }
        }
        return stats;
    };

    // تنظيف الرسائل المعلقة القديمة (لتفادي التراكم)
    window.cleanupPendingMessages = function() {
        const pending = getPendingMessages();
        if (pending.length > CONFIG.MAX_PENDING_STORAGE) {
            const sorted = pending.sort((a, b) => new Date(a.time) - new Date(b.time));
            const toRemove = sorted.slice(0, pending.length - CONFIG.MAX_PENDING_STORAGE);
            for (const msg of toRemove) {
                updateMessageStatus(msg.id, {
                    sync_status: 'failed',
                    sync_error: 'تمت أرشفة الرسالة بسبب كثرة الرسائل المعلقة'
                });
            }
            console.log(`🧹 تمت أرشفة ${toRemove.length} رسالة معلقة قديمة`);
        }
    };

    // ======================================================================
    // المزامنة الدورية وجلب الرسائل
    // ======================================================================

    function startPeriodicSync() {
        if (periodicSyncInterval) return;

        periodicSyncInterval = setInterval(async () => {
            if (!isSyncing && navigator.onLine) {
                const pending = getPendingMessages();
                if (pending.length > 0) {
                    console.log(`🔄 مزامنة دورية: ${pending.length} رسالة معلقة`);
                    await window.syncAllPendingMessages();
                } else {
                    // إذا لم تكن هناك رسائل معلقة، نجلب الجديدة
                    await fetchNewMessages();
                }
            }
        }, CONFIG.SYNC_INTERVAL);

        console.log(`⏰ بدأت المزامنة الدورية (كل ${CONFIG.SYNC_INTERVAL / 1000} ثانية)`);
    }

    function stopPeriodicSync() {
        if (periodicSyncInterval) {
            clearInterval(periodicSyncInterval);
            periodicSyncInterval = null;
            console.log('⏹️ تم إيقاف المزامنة الدورية');
        }
    }

    function startFetchInterval() {
        if (fetchInterval) return;

        fetchInterval = setInterval(async () => {
            if (!isSyncing && navigator.onLine) {
                const pending = getPendingMessages();
                if (pending.length === 0) {
                    await fetchNewMessages();
                }
            }
        }, CONFIG.FETCH_INTERVAL);

        console.log(`⏰ بدأت خدمة جلب الرسائل (كل ${CONFIG.FETCH_INTERVAL / 1000} ثانية)`);
    }

    function stopFetchInterval() {
        if (fetchInterval) {
            clearInterval(fetchInterval);
            fetchInterval = null;
            console.log('⏹️ تم إيقاف خدمة جلب الرسائل');
        }
    }

    // ======================================================================
    // دوال بدء/إيقاف المزامنة (للتحكم الخارجي)
    // ======================================================================

    window.startSync = function() {
        startPeriodicSync();
        startFetchInterval();
        if (navigator.onLine) {
            setTimeout(() => window.syncAllPendingMessages(), 1000);
            setTimeout(() => fetchNewMessages(), 2000);
        }
        console.log('✅ تم تشغيل المزامنة');
    };

    window.stopSync = function() {
        stopPeriodicSync();
        stopFetchInterval();
        console.log('⏹️ تم إيقاف المزامنة');
    };

    // ======================================================================
    // مستمعي أحداث الشبكة
    // ======================================================================

    window.addEventListener('online', async () => {
        console.log('🟢 عودة الاتصال بالإنترنت، بدء المزامنة...');
        await new Promise(r => setTimeout(r, 1000));

        // تحديث حالة المستخدم (عبر الوسيط)
        if (window.setUserOnlineStatus) {
            try {
                await window.setUserOnlineStatus(true);
            } catch (e) {
                console.warn('⚠️ فشل تحديث حالة الاتصال:', e);
            }
        }

        // بدء المزامنة فوراً
        window.syncAllPendingMessages();
        // ثم جلب الرسائل الجديدة
        setTimeout(() => fetchNewMessages(), 2000);
    });

    window.addEventListener('offline', () => {
        console.log('🔴 انقطع الاتصال بالإنترنت، تعليق المزامنة');
        isSyncing = false;
        if (window.setUserOnlineStatus) {
            window.setUserOnlineStatus(false).catch(() => {});
        }
        showToast('🔴 أنت غير متصل بالإنترنت - سيتم المزامنة تلقائياً عند العودة');
    });

    // ======================================================================
    // التهيئة التلقائية
    // ======================================================================

    // بدء المزامنة تلقائياً بعد تحميل الصفحة
    setTimeout(() => {
        startPeriodicSync();
        startFetchInterval();
        if (navigator.onLine) {
            setTimeout(() => window.syncAllPendingMessages(), 2000);
            setTimeout(() => fetchNewMessages(), 3000);
        }
    }, 1000);

    // تنظيف الرسائل المعلقة القديمة كل ساعة
    setInterval(() => {
        window.cleanupPendingMessages();
    }, CONFIG.CLEANUP_INTERVAL);

    // الاستماع لإشارة المزامنة من التطبيق
    document.addEventListener('ramzapp:syncPending', () => {
        if (navigator.onLine && !isSyncing) {
            window.syncAllPendingMessages();
        }
    });

    // ======================================================================
    // رسالة الإتمام
    // ======================================================================

    console.log('✅ sync.js (الإصدار النهائي v5.5) جاهز');
    console.log(`🔄 المزامنة الدورية: ${CONFIG.SYNC_INTERVAL / 1000} ثانية`);
    console.log(`📤 أقصى عدد محاولات: ${CONFIG.MAX_RETRIES}`);
    console.log(`📥 جلب الرسائل: كل ${CONFIG.FETCH_INTERVAL / 1000} ثانية (عند عدم وجود رسائل معلقة)`);

})();
