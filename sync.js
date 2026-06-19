// ==================== sync.js - الإصدار النهائي الكامل v4.0 ====================
// طبقة المزامنة الذكية: إدارة الرسائل المعلقة، إعادة المحاولة، المزامنة الدورية، التكامل مع الأحداث

(function() {
    // ======================================================================
    // التكوين الأساسي
    // ======================================================================
    const CONFIG = {
        MAX_RETRIES: 5,                    // أقصى عدد محاولات لإعادة إرسال رسالة
        BASE_DELAY: 2000,                  // التأخير الأساسي (بالملي ثانية)
        MAX_DELAY: 60000,                  // أقصى تأخير (دقيقة واحدة)
        SYNC_INTERVAL: 15000,              // الفاصل الزمني للمزامنة الدورية (15 ثانية)
        BATCH_SIZE: 5,                     // عدد الرسائل المرسلة في كل دفعة
        ONLINE_CHECK_INTERVAL: 3000,       // التحقق من الاتصال كل 3 ثوان
        MAX_PENDING_STORAGE: 1000          // أقصى عدد رسائل معلقة في التخزين المحلي
    };

    let isSyncing = false;
    let periodicSyncInterval = null;
    let isOnline = navigator.onLine;
    let syncQueue = [];

    // ======================================================================
    // دوال مساعدة
    // ======================================================================
    function isNetworkOnline() {
        return navigator.onLine;
    }

    function getRetryDelay(attempts) {
        return Math.min(CONFIG.BASE_DELAY * Math.pow(2, attempts), CONFIG.MAX_DELAY);
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
        if (window.updateMessage) window.updateMessage(msgId, updates);
    }

    function addMessage(msg) {
        if (window.addMessage) window.addMessage(msg);
    }

    function getChat(chatId) {
        if (window.getChat) return window.getChat(chatId);
        const chats = window.getChats?.() || [];
        return chats.find(c => c.id === chatId);
    }

    function saveChat(chatData) {
        if (window.saveChat) window.saveChat(chatData);
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

    // ======================================================================
    // الدوال الأساسية للمزامنة
    // ======================================================================

    // مزامنة رسالة واحدة
    async function syncSingleMessage(msg) {
        if (!isNetworkOnline()) return { success: false, offline: true };

        updateMessageStatus(msg.id, { sync_status: 'sending' });

        try {
            // استخدام sendMessageRealtime من supabase.js
            if (window.sendMessageRealtime) {
                const result = await window.sendMessageRealtime(msg);
                if (result.success) {
                    updateMessageStatus(msg.id, {
                        sync_status: 'sent',
                        status: 'sent',
                        sync_time: new Date().toISOString(),
                        sync_attempts: 0
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
                return { success: false, error: 'sendMessageRealtime not available' };
            }
        } catch (e) {
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

        isSyncing = true;
        let synced = 0;
        let failed = 0;

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
            return { synced, failed, error: e.message };
        } finally {
            isSyncing = false;
        }
    };

    // ======================================================================
    // دوال إضافية للتحكم في المزامنة
    // ======================================================================

    // إضافة رسالة لقائمة الانتظار للمزامنة
    window.queueMessageForSync = function(msg) {
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
            online: isNetworkOnline()
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

    // تنظيف الرسائل المعلقة القديمة (للتخزين المحلي)
    window.cleanupPendingMessages = function() {
        const pending = getPendingMessages();
        if (pending.length > CONFIG.MAX_PENDING_STORAGE) {
            // ترتيب حسب الأقدمية وحذف الأقدم
            const sorted = pending.sort((a, b) => new Date(a.time) - new Date(b.time));
            const toRemove = sorted.slice(0, pending.length - CONFIG.MAX_PENDING_STORAGE);
            for (const msg of toRemove) {
                updateMessageStatus(msg.id, { sync_status: 'failed', sync_error: 'تمت الأرشفة' });
            }
            console.log(`🧹 تمت أرشفة ${toRemove.length} رسالة معلقة قديمة`);
        }
    };

    // ======================================================================
    // المزامنة الدورية
    // ======================================================================

    function startPeriodicSync() {
        if (periodicSyncInterval) return;

        periodicSyncInterval = setInterval(() => {
            if (!isSyncing && isNetworkOnline()) {
                const pending = getPendingMessages();
                if (pending.length > 0) {
                    console.log(`🔄 مزامنة دورية: ${pending.length} رسالة معلقة`);
                    window.syncAllPendingMessages();
                } else {
                    // حتى لو لم تكن هناك رسائل معلقة، نحاول جلب رسائل جديدة من الخادم
                    // هذا يتم عبر fetchAllPendingMessages في supabase.js
                    if (window.fetchAllPendingMessages) {
                        window.fetchAllPendingMessages().then(msgs => {
                            if (msgs && msgs.length > 0) {
                                console.log(`📥 تم جلب ${msgs.length} رسالة جديدة من الخادم`);
                                for (const msg of msgs) {
                                    // التحقق من عدم وجودها مكررة
                                    const existing = window.getMessages?.(msg.chat_id) || [];
                                    if (!existing.find(m => m.id === msg.id)) {
                                        window.addMessage?.(msg);
                                        // تحديث المحادثة
                                        const chat = window.getChat?.(msg.chat_id);
                                        if (chat) {
                                            chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
                                            chat.last_time = msg.time;
                                            if (!chat.online && msg.sender_id !== 'me') {
                                                chat.unread = (chat.unread || 0) + 1;
                                            }
                                            window.saveChat?.(chat);
                                        }
                                    }
                                }
                                renderChats();
                                renderMessages();
                                // تشغيل صوت الإشعار
                                if (typeof playNotificationSound === 'function') {
                                    playNotificationSound();
                                }
                            }
                        }).catch(() => {});
                    }
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

    // ======================================================================
    // دوال بدء/إيقاف المزامنة (للتحكم الخارجي)
    // ======================================================================

    window.startSync = function() {
        startPeriodicSync();
        if (isNetworkOnline()) {
            setTimeout(() => window.syncAllPendingMessages(), 1000);
        }
        console.log('✅ تم تشغيل المزامنة');
    };

    window.stopSync = function() {
        stopPeriodicSync();
        console.log('⏹️ تم إيقاف المزامنة');
    };

    // ======================================================================
    // مستمعي أحداث الشبكة
    // ======================================================================

    window.addEventListener('online', () => {
        isOnline = true;
        console.log('🟢 عودة الاتصال بالإنترنت، بدء المزامنة...');
        // ننتظر قليلاً لاستقرار الاتصال
        setTimeout(() => {
            // تحديث حالة المستخدم
            if (window.setUserOnlineStatus) {
                window.setUserOnlineStatus(true).catch(() => {});
            }
            window.syncAllPendingMessages();
        }, 1500);
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
        if (isNetworkOnline()) {
            setTimeout(() => window.syncAllPendingMessages(), 2000);
        }
    }, 1000);

    // تنظيف الرسائل المعلقة القديمة كل ساعة
    setInterval(() => {
        window.cleanupPendingMessages();
    }, 3600000);

    console.log('✅ sync.js (الإصدار النهائي الكامل) جاهز');
    console.log(`🔄 المزامنة الدورية: ${CONFIG.SYNC_INTERVAL / 1000} ثانية`);
    console.log(`📤 أقصى عدد محاولات: ${CONFIG.MAX_RETRIES}`);

})();
