// sync.js - طبقة المزامنة الذكية (نسخة نهائية حقيقية)
// يقوم بمزامنة الرسائل المعلقة محلياً مع Supabase، وجلب الرسائل الجديدة من الخادم
(function() {
    let isSyncing = false;
    let periodicSyncInterval = null;
    const MAX_RETRIES = 5;
    const BASE_DELAY = 2000;
    const MAX_DELAY = 60000;
    const SYNC_INTERVAL = 15000; // كل 15 ثانية
    const BATCH_SIZE = 5;

    function isOnline() { return navigator.onLine; }

    // ================== دوال مساعدة للوصول إلى البيانات ==================
    function getPendingMessages() {
        if (window.getPendingMessages) return window.getPendingMessages();
        const all = [];
        const chats = window.getChats?.() || [];
        chats.forEach(c => {
            const msgs = window.getMessages?.(c.id) || [];
            msgs.forEach(m => {
                if (m.sync_status === 'pending-send' || m.sync_status === 'failed') all.push(m);
            });
        });
        return all;
    }

    function getRetryDelay(attempts) {
        return Math.min(BASE_DELAY * Math.pow(2, attempts), MAX_DELAY);
    }

    // ================== مزامنة رسالة واحدة ==================
    async function syncSingleMessage(msg) {
        if (!isOnline()) return { success: false, offline: true };
        window.updateMessage?.(msg.id, { sync_status: 'sending' });
        try {
            const result = window.sendMessageRealtime
                ? await window.sendMessageRealtime(msg)
                : { success: false, error: 'Supabase missing' };
            if (result.success) {
                window.updateMessage?.(msg.id, { 
                    sync_status: 'sent', 
                    status: 'sent', 
                    sync_time: new Date().toISOString(),
                    sync_attempts: 0 // إعادة ضبط المحاولات عند النجاح
                });
                return { success: true };
            } else if (result.offline) {
                return { success: false, offline: true };
            } else {
                const attempts = (msg.sync_attempts || 0) + 1;
                const newStatus = attempts >= MAX_RETRIES ? 'failed' : 'pending-send';
                window.updateMessage?.(msg.id, { 
                    sync_status: newStatus, 
                    status: newStatus === 'failed' ? 'failed' : 'pending-send',
                    sync_error: result.error, 
                    sync_attempts: attempts 
                });
                return { success: false, error: result.error, attempts };
            }
        } catch (e) {
            const attempts = (msg.sync_attempts || 0) + 1;
            const newStatus = attempts >= MAX_RETRIES ? 'failed' : 'pending-send';
            window.updateMessage?.(msg.id, { 
                sync_status: newStatus, 
                status: newStatus === 'failed' ? 'failed' : 'pending-send',
                sync_error: e.message, 
                sync_attempts: attempts 
            });
            return { success: false, error: e.message, attempts };
        }
    }

    // ================== وضع علامة "مقروء" على الرسائل المستلمة ==================
    async function markMessagesAsRead(chatId, messageIds) {
        if (!isOnline() || !window.supabaseClient) return;
        try {
            await window.supabaseClient
                .from('messages')
                .update({ status: 'read', read_at: new Date().toISOString() })
                .in('id', messageIds);
        } catch (e) {
            // تجاهل الأخطاء هنا لأنها ليست حرجة للمستخدم
        }
    }

    // ================== المزامنة الرئيسية ==================
    window.syncAllPendingMessages = async function() {
        if (isSyncing) return { synced: 0, failed: 0, alreadyRunning: true };
        if (!isOnline()) return { synced: 0, failed: 0, offline: true };
        
        isSyncing = true;
        const pending = getPendingMessages();
        let synced = 0, failed = 0;

        // ====== 1. إرسال الرسائل المعلقة (دفعات) ======
        if (pending.length > 0) {
            // ترتيب حسب الأقدمية
            pending.sort((a, b) => new Date(a.time) - new Date(b.time));
            
            // تصفية الرسائل التي تجاوزت عدد المحاولات المسموح
            const validPending = pending.filter(m => (m.sync_attempts || 0) < MAX_RETRIES);
            const stuckMessages = pending.filter(m => (m.sync_attempts || 0) >= MAX_RETRIES);
            failed += stuckMessages.length;

            // معالجة الدفعات
            for (let i = 0; i < validPending.length; i += BATCH_SIZE) {
                const batch = validPending.slice(i, i + BATCH_SIZE);
                // إرسال الدفعة بالتوازي (لكن ننتظر جميع النتائج)
                const results = await Promise.all(batch.map(msg => syncSingleMessage(msg)));
                for (const res of results) {
                    if (res.success) synced++;
                    else if (res.offline) {
                        // إذا انقطع الاتصال، نوقف المعالجة ونحفظ ما تم
                        isSyncing = false;
                        refreshUI();
                        return { synced, failed, offline: true, partial: true };
                    } else {
                        failed++;
                    }
                }
                // تأخير بسيط بين الدفعات لتجنب ضغط الخادم
                if (i + BATCH_SIZE < validPending.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }

        // ====== 2. جلب الرسائل الجديدة من الخادم ======
        if (window.fetchAllPendingMessages) {
            try {
                const received = await window.fetchAllPendingMessages();
                if (received?.length) {
                    const readIds = [];
                    for (const msg of received) {
                        // التأكد من عدم وجودها مكررة
                        const existingChatMsgs = window.getMessages?.(msg.chat_id) || [];
                        const exists = existingChatMsgs.find(m => m.id === msg.id);
                        if (!exists) {
                            msg.sync_status = 'delivered';
                            msg.status = 'delivered';
                            window.addMessage?.(msg);
                            
                            // تحديث المحادثة (آخر رسالة)
                            const chat = window.getChat?.(msg.chat_id);
                            if (chat) {
                                chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
                                chat.last_time = msg.time;
                                if (!chat.online && msg.sender_id !== 'me') {
                                    chat.unread = (chat.unread || 0) + 1;
                                }
                                window.saveChat?.(chat);
                            }
                            
                            // تجميع معرفات الرسائل لتعليمها كمقروءة لاحقاً
                            if (msg.sender_id !== 'me') {
                                readIds.push(msg.id);
                            }
                        }
                    }

                    // تعليم الرسائل المستلمة كمقروءة (بشكل غير متزامن)
                    if (readIds.length > 0 && window.supabaseClient) {
                        // تجميع حسب chat_id لتحديث الكل
                        const chatGroups = {};
                        received.forEach(msg => {
                            if (readIds.includes(msg.id)) {
                                if (!chatGroups[msg.chat_id]) chatGroups[msg.chat_id] = [];
                                chatGroups[msg.chat_id].push(msg.id);
                            }
                        });
                        for (const [chatId, ids] of Object.entries(chatGroups)) {
                            await markMessagesAsRead(chatId, ids);
                        }
                    }

                    // تشغيل صوت الإشعار إذا كانت هناك رسائل جديدة
                    if (readIds.length > 0 && typeof playNotificationSound === 'function') {
                        playNotificationSound();
                    }
                }
            } catch (e) {
                console.warn('⚠️ فشل جلب الرسائل الجديدة', e);
            }
        }

        refreshUI();
        isSyncing = false;
        return { synced, failed, offline: false };
    };

    // ================== تحديث الواجهة ==================
    function refreshUI() {
        if (typeof renderChats === 'function') renderChats();
        if (typeof renderMessages === 'function' && typeof currentChatId !== 'undefined') renderMessages();
        if (typeof updateStats === 'function') updateStats();
    }

    // ================== دوال عامة للتحكم ==================
    window.queueMessageForSync = function(msg) {
        if (msg.sync_status !== 'pending-send' && msg.sync_status !== 'failed') {
            window.updateMessage?.(msg.id, { sync_status: 'pending-send' });
        }
        if (isOnline() && !isSyncing) window.syncAllPendingMessages();
    };

    window.forceSyncNow = () => window.syncAllPendingMessages();
    
    window.retryMessage = async function(msgId) {
        const pending = getPendingMessages();
        const msg = pending.find(m => m.id === msgId);
        if (!msg) return { success: false, error: 'Not found' };
        window.updateMessage?.(msgId, { sync_attempts: 0, sync_status: 'pending-send' });
        return await syncSingleMessage({ ...msg, sync_attempts: 0 });
    };
    
    window.retryAllFailed = async function() {
        const pending = getPendingMessages();
        const failedMsgs = pending.filter(m => m.sync_status === 'failed');
        for (const m of failedMsgs) {
            window.updateMessage?.(m.id, { sync_attempts: 0, sync_status: 'pending-send' });
        }
        return window.syncAllPendingMessages();
    };

    window.getSyncStats = function() {
        const pending = getPendingMessages();
        const stats = { 
            pending: pending.length, 
            total: 0, 
            byStatus: {}, 
            isSyncing, 
            online: isOnline() 
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

    // ================== المزامنة الدورية ==================
    function startPeriodicSync() {
        if (periodicSyncInterval) return;
        periodicSyncInterval = setInterval(() => {
            if (!isSyncing && isOnline()) {
                const pending = getPendingMessages();
                if (pending.length > 0) {
                    window.syncAllPendingMessages();
                } else {
                    // حتى لو لم تكن هناك رسائل معلقة، نحاول جلب رسائل جديدة
                    window.syncAllPendingMessages();
                }
            }
        }, SYNC_INTERVAL);
    }

    window.startSync = function() {
        startPeriodicSync();
        if (isOnline()) setTimeout(() => window.syncAllPendingMessages(), 1000);
    };

    window.stopSync = () => { clearInterval(periodicSyncInterval); periodicSyncInterval = null; };

    // ================== مستمعات الأحداث ==================
    window.addEventListener('online', async () => {
        // ننتظر ثانية لإستقرار الاتصال
        await new Promise(r => setTimeout(r, 1500));
        // تحديث حالة المستخدم إلى متصل
        if (window.setUserOnlineStatus) window.setUserOnlineStatus(true);
        // بدء المزامنة فوراً
        window.syncAllPendingMessages();
    });

    window.addEventListener('offline', () => {
        isSyncing = false;
        if (window.setUserOnlineStatus) window.setUserOnlineStatus(false);
        toast?.('🔴 أنت غير متصل بالإنترنت - سيتم المزامنة تلقائياً عند العودة');
    });

    // ================== بدء التشغيل ==================
    console.log('✅ sync.js (نسخة نهائية حقيقية) جاهز');
    startPeriodicSync();
    // تشغيل مزامنة أولية بعد 2 ثانية من التحميل
    setTimeout(() => {
        if (isOnline()) window.syncAllPendingMessages();
    }, 2000);

})();
