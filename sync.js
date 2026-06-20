// ======================================================================
// sync.js - الإصدار النهائي المعدل v4.0
// طبقة المزامنة الذكية: إدارة الرسائل المعلقة، إعادة المحاولة، المزامنة الدورية، التكامل مع الأحداث
// مع إصلاحات: RangeError، معالجة الأخطاء، التحقق من صحة البيانات، منع التكرار، تحسين الأداء
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
        RETRY_JITTER: 500,                 // قيمة عشوائية لتجنب التزامن (تشتيت)
        CLEANUP_INTERVAL: 3600000,         // تنظيف الرسائل القديمة كل ساعة
        FETCH_INTERVAL: 30000              // جلب الرسائل الجديدة كل 30 ثانية (عند عدم وجود رسائل معلقة)
    };

    let isSyncing = false;
    let periodicSyncInterval = null;
    let fetchInterval = null;
    let isOnline = navigator.onLine;
    let syncAttempts = 0;
    let lastSyncTime = 0;

    // ======================================================================
    // دوال مساعدة
    // ======================================================================
    function isNetworkOnline() {
        return navigator.onLine;
    }

    function getRetryDelay(attempts) {
        const base = Math.min(CONFIG.BASE_DELAY * Math.pow(2, attempts), CONFIG.MAX_DELAY);
        const jitter = Math.random() * CONFIG.RETRY_JITTER;
        return Math.min(base + jitter, CONFIG.MAX_DELAY);
    }

    function getPendingMessages() {
        if (window.getPendingMessages) return window.getPendingMessages();
        // إذا لم تكن الدالة موجودة، نحاول جلبها من inMemoryDB مباشرة
        const all = [];
        const chats = window.getChats?.() || [];
        chats.forEach(c => {
            const msgs = window.getMessages?.(c.id) || [];
            msgs.forEach(m => {
                if (m.sync_status === 'pending-send' || m.sync_status === 'failed') {
                    all.push(m);
                }
            });
        });
        return all;
    }

    function updateMessageStatus(msgId, updates) {
        if (window.updateMessage) {
            try {
                window.updateMessage(msgId, updates);
            } catch (e) {
                console.warn('⚠️ فشل تحديث حالة الرسالة:', e);
            }
        }
    }

    function addMessage(msg) {
        if (window.addMessage) {
            try {
                window.addMessage(msg);
            } catch (e) {
                console.warn('⚠️ فشل إضافة الرسالة:', e);
            }
        }
    }

    function getChat(chatId) {
        if (window.getChat) return window.getChat(chatId);
        const chats = window.getChats?.() || [];
        return chats.find(c => c.id === chatId);
    }

    function saveChat(chatData) {
        if (window.saveChat) {
            try {
                window.saveChat(chatData);
            } catch (e) {
                console.warn('⚠️ فشل حفظ المحادثة:', e);
            }
        }
    }

    function renderMessages() {
        if (typeof renderMessages === 'function') renderMessages();
        else if (window.renderMessages) window.renderMessages();
    }

    function renderChats() {
        if (typeof renderChats === 'function') renderChats();
        else if (window.renderChats) window.renderChats();
    }

    function updateStats() {
        if (typeof updateStats === 'function') updateStats();
        else if (window.updateStats) window.updateStats();
    }

    function toast(message) {
        if (typeof toast === 'function') toast(message);
        else if (window.toast) window.toast(message);
        else console.log('📢', message);
    }

    function playNotificationSound() {
        if (typeof playNotificationSound === 'function') playNotificationSound();
        else if (window.playNotificationSound) window.playNotificationSound();
    }

    function isValidMessage(msg) {
        // التحقق من صحة الرسالة قبل الإرسال
        if (!msg) return false;
        if (!msg.id) return false;
        if (!msg.chat_id && !msg.sid) return false;
        // التأكد من أن القيم العددية صحيحة
        if (msg.likes !== undefined && typeof msg.likes !== 'number') msg.likes = Number(msg.likes) || 0;
        if (msg.sync_attempts !== undefined && typeof msg.sync_attempts !== 'number') msg.sync_attempts = Number(msg.sync_attempts) || 0;
        return true;
    }

    function cleanMessageForSync(msg) {
        // نسخ عميقة وتنظيف القيم غير الصالحة
        const clean = { ...msg };
        // التأكد من أن القيم العددية صحيحة
        if (clean.likes !== undefined) clean.likes = Number(clean.likes) || 0;
        if (clean.sync_attempts !== undefined) clean.sync_attempts = Number(clean.sync_attempts) || 0;
        // التأكد من وجود chat_id
        if (!clean.chat_id && clean.sid) clean.chat_id = clean.sid;
        // إزالة الحقول غير المطلوبة
        delete clean._typing;
        delete clean._temp;
        delete clean._localOnly;
        return clean;
    }

    function generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    }

    // ======================================================================
    // الدوال الأساسية للمزامنة
    // ======================================================================

    // مزامنة رسالة واحدة (مع محاولة إعادة الإرسال)
    async function syncSingleMessage(msg) {
        if (!isNetworkOnline()) {
            return { success: false, offline: true };
        }

        if (!isValidMessage(msg)) {
            console.warn('⚠️ رسالة غير صالحة للمزامنة:', msg.id);
            updateMessageStatus(msg.id, {
                sync_status: 'failed',
                status: 'failed',
                sync_error: 'Invalid message data'
            });
            return { success: false, error: 'Invalid message' };
        }

        const cleanMsg = cleanMessageForSync(msg);

        // تحديث الحالة إلى "جاري الإرسال"
        updateMessageStatus(msg.id, { sync_status: 'sending' });

        try {
            if (window.sendMessageRealtime) {
                const result = await window.sendMessageRealtime(cleanMsg);
                if (result.success) {
                    updateMessageStatus(msg.id, {
                        sync_status: 'sent',
                        status: 'sent',
                        sync_time: new Date().toISOString(),
                        sync_attempts: 0,
                        sync_error: null
                    });
                    return { success: true };
                } else if (result.offline) {
                    return { success: false, offline: true };
                } else {
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
                    sync_error: 'sendMessageRealtime not available'
                });
                return { success: false, error: 'sendMessageRealtime not available' };
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
        if (isSyncing) {
            console.log('⏳ المزامنة قيد التشغيل بالفعل');
            return { synced: 0, failed: 0, alreadyRunning: true };
        }

        if (!isNetworkOnline()) {
            console.log('📡 غير متصل بالإنترنت، تأجيل المزامنة');
            return { synced: 0, failed: 0, offline: true };
        }

        // تأكد من أن supabase جاهز
        if (!window.supabaseClient) {
            console.warn('⚠️ Supabase غير متاح، تأجيل المزامنة');
            return { synced: 0, failed: 0, supabaseUnavailable: true };
        }

        isSyncing = true;
        let synced = 0;
        let failed = 0;
        lastSyncTime = Date.now();

        try {
            const pending = getPendingMessages();

            if (pending.length === 0) {
                console.log('✅ لا توجد رسائل معلقة للمزامنة');
                isSyncing = false;
                return { synced: 0, failed: 0 };
            }

            console.log(`📤 بدء مزامنة ${pending.length} رسالة معلقة`);

            // ترتيب الرسائل حسب الأقدمية
            pending.sort((a, b) => new Date(a.time) - new Date(b.time));

            // تصفية الرسائل التي تجاوزت عدد المحاولات المسموح
            const validPending = pending.filter(m => (m.sync_attempts || 0) < CONFIG.MAX_RETRIES);
            const stuckMessages = pending.filter(m => (m.sync_attempts || 0) >= CONFIG.MAX_RETRIES);
            failed += stuckMessages.length;

            // معالجة الدفعات
            for (let i = 0; i < validPending.length; i += CONFIG.BATCH_SIZE) {
                // التأكد من أننا ما زلنا متصلين
                if (!isNetworkOnline()) {
                    console.warn('⚠️ انقطع الاتصال أثناء المزامنة');
                    isSyncing = false;
                    return { synced, failed, offline: true, partial: true };
                }

                const batch = validPending.slice(i, i + CONFIG.BATCH_SIZE);
                // معالجة الدفعة بالتوازي مع حدود
                const results = await Promise.all(batch.map(msg => syncSingleMessage(msg)));

                for (const res of results) {
                    if (res.success) {
                        synced++;
                    } else if (res.offline) {
                        // إذا انقطع الاتصال، نوقف المعالجة فوراً
                        isSyncing = false;
                        return { synced, failed, offline: true, partial: true };
                    } else {
                        failed++;
                    }
                }

                // تأخير بسيط بين الدفعات لتجنب ضغط الخادم
                if (i + CONFIG.BATCH_SIZE < validPending.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // تحديث الواجهة
            renderChats();
            renderMessages();
            updateStats();

            console.log(`✅ اكتملت المزامنة: ${synced} ناجحة، ${failed} فاشلة`);
            return { synced, failed, offline: false };

        } catch (e) {
            console.error('❌ خطأ أثناء المزامنة:', e);
            // لا نعيد طرح الخطأ، نعيد نتيجة جزئية
            return { synced, failed, error: e.message };
        } finally {
            isSyncing = false;
            syncAttempts++;
        }
    };

    // ======================================================================
    // دوال إضافية للتحكم في المزامنة
    // ======================================================================

    // إضافة رسالة لقائمة الانتظار للمزامنة
    window.queueMessageForSync = function(msg) {
        if (!msg || !msg.id) return;
        if (msg.sync_status !== 'pending-send' && msg.sync_status !== 'failed') {
            updateMessageStatus(msg.id, { sync_status: 'pending-send' });
        }
        if (isNetworkOnline() && !isSyncing) {
            // ننتظر قليلاً ثم نبدأ المزامنة
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
            online: isNetworkOnline(),
            lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
            attempts: syncAttempts
        };
        const chats = window.getChats?.() || [];
        chats.forEach(c => {
            const msgs = window.getMessages?.(c.id) || [];
            stats.total += msgs.length;
            msgs.forEach(m => {
                stats.byStatus[m.sync_status] = (stats.byStatus[m.sync_status] || 0) + 1;
            });
        });
        return stats;
    };

    // تنظيف الرسائل المعلقة القديمة
    window.cleanupPendingMessages = function() {
        const pending = getPendingMessages();
        if (pending.length > CONFIG.MAX_PENDING_STORAGE) {
            // ترتيب حسب الأقدمية وحذف الأقدم
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
    // جلب الرسائل الجديدة من الخادم
    // ======================================================================

    async function fetchNewMessages() {
        if (!isNetworkOnline() || !window.fetchAllPendingMessages) {
            return;
        }

        if (isSyncing) {
            console.log('⏳ المزامنة قيد التشغيل، تأجيل جلب الرسائل');
            return;
        }

        try {
            const msgs = await window.fetchAllPendingMessages();
            if (msgs && msgs.length > 0) {
                console.log(`📥 تم جلب ${msgs.length} رسالة جديدة من الخادم`);
                let newMessages = 0;
                for (const msg of msgs) {
                    // التحقق من عدم وجودها مكررة
                    const chatId = msg.chat_id || msg.sid;
                    if (!chatId) continue;
                    const existing = window.getMessages?.(chatId) || [];
                    if (!existing.find(m => m.id === msg.id)) {
                        // تنظيف الرسالة قبل الإضافة
                        const cleanMsg = { ...msg };
                        cleanMsg.sync_status = 'delivered';
                        cleanMsg.status = 'delivered';
                        if (!cleanMsg.time) cleanMsg.time = new Date().toISOString();
                        window.addMessage?.(cleanMsg);

                        // تحديث المحادثة
                        const chat = window.getChat?.(chatId);
                        if (chat) {
                            chat.last_msg = cleanMsg.text || (cleanMsg.img ? '📷' : cleanMsg.voice_blob ? '🎤' : '📎');
                            chat.last_time = cleanMsg.time;
                            if (!chat.online && cleanMsg.sender_id !== 'me') {
                                chat.unread = (chat.unread || 0) + 1;
                            }
                            window.saveChat?.(chat);
                        }
                        newMessages++;
                    }
                }
                if (newMessages > 0) {
                    renderChats();
                    renderMessages();
                    // تشغيل صوت الإشعار
                    if (typeof playNotificationSound === 'function') {
                        playNotificationSound();
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ فشل جلب الرسائل الجديدة:', e);
        }
    }

    // ======================================================================
    // المزامنة الدورية وجلب الرسائل
    // ======================================================================

    function startPeriodicSync() {
        if (periodicSyncInterval) return;

        periodicSyncInterval = setInterval(async () => {
            if (!isSyncing && isNetworkOnline()) {
                const pending = getPendingMessages();
                if (pending.length > 0) {
                    console.log(`🔄 مزامنة دورية: ${pending.length} رسالة معلقة`);
                    await window.syncAllPendingMessages();
                } else {
                    // إذا لم تكن هناك رسائل معلقة، نحاول جلب رسائل جديدة
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
            // فقط نجلب إذا لم تكن هناك رسائل معلقة ولسنا في حالة مزامنة
            if (!isSyncing && isNetworkOnline()) {
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
        if (isNetworkOnline()) {
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
        isOnline = true;
        console.log('🟢 عودة الاتصال بالإنترنت، بدء المزامنة...');
        // ننتظر قليلاً لاستقرار الاتصال
        await new Promise(r => setTimeout(r, 1000));

        // تحديث حالة المستخدم (باستخدام الدالة الآمنة)
        if (window.setUserOnlineStatus) {
            try {
                await window.setUserOnlineStatus(true);
            } catch (e) {
                console.warn('⚠️ فشل تحديث حالة الاتصال:', e);
            }
        }

        // نبدأ المزامنة فوراً
        window.syncAllPendingMessages();
        // ثم نجلب الرسائل الجديدة
        setTimeout(() => fetchNewMessages(), 2000);
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        console.log('🔴 انقطع الاتصال بالإنترنت، تعليق المزامنة');
        isSyncing = false;
        if (window.setUserOnlineStatus) {
            window.setUserOnlineStatus(false).catch(() => {});
        }
        // إشعار المستخدم
        if (typeof toast === 'function') {
            toast('🔴 أنت غير متصل بالإنترنت - سيتم المزامنة تلقائياً عند العودة');
        }
    });

    // ======================================================================
    // تهيئة المزامنة
    // ======================================================================

    // بدء المزامنة تلقائياً عند تحميل الصفحة
    setTimeout(() => {
        startPeriodicSync();
        startFetchInterval();
        if (isNetworkOnline()) {
            setTimeout(() => window.syncAllPendingMessages(), 2000);
            setTimeout(() => fetchNewMessages(), 3000);
        }
    }, 1000);

    // تنظيف الرسائل المعلقة القديمة كل ساعة
    setInterval(() => {
        window.cleanupPendingMessages();
    }, CONFIG.CLEANUP_INTERVAL);

    // المزامنة عند إشارة من التطبيق
    document.addEventListener('ramzapp:syncPending', () => {
        if (isNetworkOnline() && !isSyncing) {
            window.syncAllPendingMessages();
        }
    });

    console.log('✅ sync.js (الإصدار النهائي المعدل) جاهز');
    console.log(`🔄 المزامنة الدورية: ${CONFIG.SYNC_INTERVAL / 1000} ثانية`);
    console.log(`📤 أقصى عدد محاولات: ${CONFIG.MAX_RETRIES}`);
    console.log(`📥 جلب الرسائل: كل ${CONFIG.FETCH_INTERVAL / 1000} ثانية (عند عدم وجود رسائل معلقة)`);

})();
