// ======================================================================
// sync.js - النسخة المحسّنة v1.1 (مع إصلاح مشكلة chat_id)
// مزامنة الرسائل بين التخزين المحلي والوسيط (Supabase)
// فلسفة: "الهاتف هو المصدر" – الخادم مجرد وسيط مؤقت
// ======================================================================

(function() {
    'use strict';

    // ======================================================================
    // التكوين الأساسي
    // ======================================================================
    const CONFIG = {
        MAX_RETRIES: 3,
        BASE_DELAY: 2000,
        SYNC_INTERVAL: 10000,
        FETCH_INTERVAL: 8000,
        BATCH_SIZE: 5,
        MAX_PENDING_STORAGE: 500,
    };

    // ======================================================================
    // المتغيرات العامة
    // ======================================================================
    let isSyncing = false;
    let syncInterval = null;
    let fetchInterval = null;
    let isOnline = navigator.onLine;

    // ======================================================================
    // دوال مساعدة
    // ======================================================================

    function getChats() {
        return window.getChats ? window.getChats() : [];
    }

    function getMessages(chatId) {
        return window.getMessages ? window.getMessages(chatId) : [];
    }

    function updateMessageStatus(msgId, updates) {
        if (window.updateMessage) {
            try { window.updateMessage(msgId, updates); } catch(e) {}
        }
    }

    function addMessageLocally(msg) {
        if (window.addMessage) {
            try { window.addMessage(msg); } catch(e) {}
        }
    }

    function saveChat(chatData) {
        if (window.saveChat) {
            try { window.saveChat(chatData); } catch(e) {}
        }
    }

    function renderMessages() {
        if (window.renderMessages) window.renderMessages();
        else if (typeof renderMessages === 'function') renderMessages();
    }

    function renderChats() {
        if (window.renderChats) window.renderChats();
        else if (typeof renderChats === 'function') renderChats();
    }

    function showToast(msg) {
        if (window.toast) window.toast(msg);
        else if (typeof toast === 'function') toast(msg);
        else console.log('📢', msg);
    }

    function playSound() {
        if (window.playNotificationSound) window.playNotificationSound();
        else if (typeof playNotificationSound === 'function') playNotificationSound();
    }

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem('ramzapp_user');
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    }

    // ======================================================================
    // الحصول على الرسائل المعلقة (محسّن مع تحقق من chat_id)
    // ======================================================================

    function getPendingMessages() {
        const allPending = [];
        const chats = getChats();
        
        for (const chat of chats) {
            const chatId = chat.id;
            if (!chatId) continue;
            
            const msgs = getMessages(chatId);
            for (const m of msgs) {
                // التأكد من أن الرسالة لها chat_id صحيح
                if (!m.chat_id) {
                    // محاولة إصلاح الرسالة
                    console.warn(`⚠️ رسالة ${m.id} ليس لها chat_id، سيتم إصلاحها`);
                    m.chat_id = chatId;
                    updateMessageStatus(m.id, { chat_id: chatId });
                }
                
                if (m.sync_status === 'pending-send' || m.sync_status === 'failed') {
                    allPending.push(m);
                }
            }
        }
        
        return allPending;
    }

    // ======================================================================
    // دالة إرسال رسالة واحدة (محسّنة مع تحقق chat_id)
    // ======================================================================

    async function syncSingleMessage(msg) {
        // التحقق من الاتصال
        if (!navigator.onLine) {
            return { success: false, offline: true };
        }

        // التحقق من صحة الرسالة - محاولة إصلاح chat_id إذا كان مفقوداً
        let chatId = msg.chat_id || msg.sid || msg.chatId;
        
        if (!chatId) {
            // محاولة استنتاج chat_id من الرسالة
            console.warn(`⚠️ رسالة ${msg.id} ليس لها chat_id، محاولة استنتاجه`);
            
            // البحث في المحادثات عن رسالة بنفس المعرف
            const chats = getChats();
            for (const chat of chats) {
                const msgs = getMessages(chat.id);
                const found = msgs.find(m => m.id === msg.id);
                if (found && found.chat_id) {
                    chatId = found.chat_id;
                    break;
                }
            }
            
            // إذا لم يتم العثور، نستخدم معرف المرسل إذا كان موجوداً
            if (!chatId && msg.sender_id && msg.sender_id !== 'me') {
                chatId = msg.sender_id;
            }
            
            // إذا لم نجد، نعتبر الرسالة فاشلة
            if (!chatId) {
                console.error(`❌ لا يمكن استنتاج chat_id للرسالة ${msg.id}`);
                updateMessageStatus(msg.id, {
                    sync_status: 'failed',
                    status: 'failed',
                    sync_error: 'معرف المحادثة مطلوب'
                });
                return { success: false, error: 'معرف المحادثة مطلوب' };
            }
            
            // تحديث الرسالة بـ chat_id الصحيح
            updateMessageStatus(msg.id, { chat_id: chatId });
            msg.chat_id = chatId;
        }

        // تحديث الحالة إلى "جاري الإرسال"
        updateMessageStatus(msg.id, { sync_status: 'sending' });

        try {
            // استخدام وسيط Supabase (sendMessageRealtime)
            if (window.sendMessageRealtime) {
                const result = await window.sendMessageRealtime(chatId, msg);
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
    // المزامنة الرئيسية (محسّنة)
    // ======================================================================

    window.syncAllPendingMessages = async function() {
        if (isSyncing) {
            console.log('⏳ المزامنة قيد التشغيل بالفعل');
            return { synced: 0, failed: 0, alreadyRunning: true };
        }

        if (!navigator.onLine) {
            console.log('📡 غير متصل، تأجيل المزامنة');
            return { synced: 0, failed: 0, offline: true };
        }

        if (!window.sendMessageRealtime) {
            console.warn('⚠️ الوسيط غير متاح');
            return { synced: 0, failed: 0, brokerUnavailable: true };
        }

        isSyncing = true;
        let synced = 0;
        let failed = 0;

        try {
            const pending = getPendingMessages();

            if (pending.length === 0) {
                console.log('✅ لا توجد رسائل معلقة');
                isSyncing = false;
                return { synced: 0, failed: 0 };
            }

            console.log(`📤 بدء مزامنة ${pending.length} رسالة معلقة`);

            // عرض تفاصيل الرسائل المعلقة للتصحيح
            for (const msg of pending) {
                console.log(`   📝 رسالة: ${msg.id}, chat_id: ${msg.chat_id || 'غير موجود'}, text: ${(msg.text || '').substring(0, 30)}`);
            }

            // ترتيب حسب الأقدمية
            pending.sort((a, b) => new Date(a.time) - new Date(b.time));

            // تصفية الرسائل التي تجاوزت عدد المحاولات
            const validPending = pending.filter(m => (m.sync_attempts || 0) < CONFIG.MAX_RETRIES);
            const stuckMessages = pending.filter(m => (m.sync_attempts || 0) >= CONFIG.MAX_RETRIES);
            failed += stuckMessages.length;

            if (stuckMessages.length > 0) {
                console.log(`⚠️ ${stuckMessages.length} رسالة تجاوزت عدد المحاولات`);
                for (const msg of stuckMessages) {
                    console.log(`   ⚠️ رسالة عالقة: ${msg.id}, chat_id: ${msg.chat_id}`);
                }
            }

            // معالجة الدفعات
            for (let i = 0; i < validPending.length; i += CONFIG.BATCH_SIZE) {
                if (!navigator.onLine) {
                    console.warn('⚠️ انقطع الاتصال أثناء المزامنة');
                    isSyncing = false;
                    return { synced, failed, offline: true, partial: true };
                }

                const batch = validPending.slice(i, i + CONFIG.BATCH_SIZE);
                const results = await Promise.all(batch.map(msg => syncSingleMessage(msg)));

                for (const res of results) {
                    if (res.success) synced++;
                    else if (res.offline) {
                        isSyncing = false;
                        return { synced, failed, offline: true, partial: true };
                    } else {
                        failed++;
                    }
                }

                if (i + CONFIG.BATCH_SIZE < validPending.length) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            renderChats();
            renderMessages();

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
    // جلب الرسائل الجديدة (محسّن)
    // ======================================================================

    async function fetchNewMessages() {
        if (!navigator.onLine || !window.fetchPendingMessages) {
            return 0;
        }

        if (isSyncing) {
            console.log('⏳ المزامنة قيد التشغيل، تأجيل جلب الرسائل');
            return 0;
        }

        try {
            const user = getCurrentUser();
            if (!user) return 0;

            const chats = getChats();
            let newMessagesCount = 0;

            for (const chat of chats) {
                const chatId = chat.id;
                if (!chatId || chatId === user.phone || chatId === user.id) continue;

                try {
                    const newMsgs = await window.fetchPendingMessages(chatId);
                    if (newMsgs && newMsgs.length > 0) {
                        let added = 0;
                        for (const msg of newMsgs) {
                            // التأكد من أن الرسالة لها chat_id
                            if (!msg.chat_id) msg.chat_id = chatId;
                            
                            const existing = getMessages(chatId);
                            if (!existing.find(m => m.id === msg.id)) {
                                addMessageLocally(msg);
                                added++;
                            }
                        }
                        
                        if (added > 0) {
                            newMessagesCount += added;
                            // تحديث المحادثة
                            const chatObj = getChats().find(c => c.id === chatId);
                            if (chatObj) {
                                const lastMsg = newMsgs[newMsgs.length - 1];
                                chatObj.last_msg = lastMsg.text || '📎';
                                chatObj.last_time = lastMsg.time || new Date().toISOString();
                                chatObj.unread = (chatObj.unread || 0) + added;
                                saveChat(chatObj);
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ فشل جلب رسائل للمحادثة ${chatId}:`, e);
                }
            }

            if (newMessagesCount > 0) {
                console.log(`📩 تم جلب ${newMessagesCount} رسالة جديدة`);
                renderChats();
                if (window.currentChatId) renderMessages();
                playSound();
                showToast(`📩 ${newMessagesCount} رسالة جديدة`);
            }

            return newMessagesCount;
        } catch (e) {
            console.warn('⚠️ فشل جلب الرسائل الجديدة:', e);
            return 0;
        }
    }

    // ======================================================================
    // دورة المزامنة الكاملة
    // ======================================================================

    async function fullSyncCycle() {
        if (!navigator.onLine) return;
        await fetchNewMessages();
        const pending = getPendingMessages();
        if (pending.length > 0 && !isSyncing) {
            await window.syncAllPendingMessages();
        }
    }

    // ======================================================================
    // دوال إضافية
    // ======================================================================

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

    window.retryMessage = async function(msgId) {
        const pending = getPendingMessages();
        const msg = pending.find(m => m.id === msgId);
        if (!msg) return { success: false, error: 'الرسالة غير موجودة' };
        updateMessageStatus(msgId, { sync_attempts: 0, sync_status: 'pending-send' });
        return await syncSingleMessage({ ...msg, sync_attempts: 0 });
    };

    window.retryAllFailed = async function() {
        const pending = getPendingMessages();
        const failedMsgs = pending.filter(m => m.sync_status === 'failed');
        for (const m of failedMsgs) {
            updateMessageStatus(m.id, { sync_attempts: 0, sync_status: 'pending-send' });
        }
        return window.syncAllPendingMessages();
    };

    window.getSyncStats = function() {
        const pending = getPendingMessages();
        return {
            pending: pending.length,
            isSyncing: isSyncing,
            online: navigator.onLine,
            pendingByStatus: {
                pending: pending.filter(m => m.sync_status === 'pending-send').length,
                failed: pending.filter(m => m.sync_status === 'failed').length,
                sending: pending.filter(m => m.sync_status === 'sending').length,
            },
            pendingDetails: pending.map(m => ({
                id: m.id,
                chat_id: m.chat_id || 'غير موجود',
                text: (m.text || '').substring(0, 30),
                status: m.sync_status,
                attempts: m.sync_attempts || 0
            }))
        };
    };

    // ======================================================================
    // بدء وإيقاف المزامنة
    // ======================================================================

    window.startSync = function() {
        if (syncInterval && fetchInterval) {
            console.log('ℹ️ المزامنة قيد التشغيل بالفعل');
            return;
        }

        console.log('🚀 بدء نظام المزامنة...');

        syncInterval = setInterval(() => {
            if (navigator.onLine && !isSyncing) {
                const pending = getPendingMessages();
                if (pending.length > 0) {
                    window.syncAllPendingMessages();
                }
            }
        }, CONFIG.SYNC_INTERVAL);

        fetchInterval = setInterval(() => {
            if (navigator.onLine && !isSyncing) {
                const pending = getPendingMessages();
                if (pending.length === 0) {
                    fetchNewMessages();
                }
            }
        }, CONFIG.FETCH_INTERVAL);

        setTimeout(() => {
            if (navigator.onLine) {
                fetchNewMessages().then(() => {
                    window.syncAllPendingMessages();
                });
            }
        }, 1000);

        console.log(`✅ المزامنة الدورية: كل ${CONFIG.SYNC_INTERVAL/1000} ثانية`);
        console.log(`📥 جلب الرسائل: كل ${CONFIG.FETCH_INTERVAL/1000} ثانية`);
    };

    window.stopSync = function() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
        if (fetchInterval) {
            clearInterval(fetchInterval);
            fetchInterval = null;
        }
        console.log('⏹️ تم إيقاف نظام المزامنة');
    };

    // ======================================================================
    // مستمعي الأحداث
    // ======================================================================

    window.addEventListener('online', async () => {
        console.log('🟢 عودة الاتصال بالإنترنت');
        isOnline = true;
        if (window.updateUserOnlineStatus) {
            try { await window.updateUserOnlineStatus(true); } catch(e) {}
        }
        await fetchNewMessages();
        await window.syncAllPendingMessages();
    });

    window.addEventListener('offline', () => {
        console.log('🔴 انقطع الاتصال بالإنترنت');
        isOnline = false;
        if (window.updateUserOnlineStatus) {
            window.updateUserOnlineStatus(false).catch(() => {});
        }
        showToast('🔴 غير متصل – سيتم المزامنة عند العودة');
    });

    document.addEventListener('ramzapp:syncPending', () => {
        if (navigator.onLine && !isSyncing) {
            window.syncAllPendingMessages();
        }
    });

    document.addEventListener('ramzapp:newMessage', () => {
        if (navigator.onLine && !isSyncing) {
            setTimeout(() => window.syncAllPendingMessages(), 500);
        }
    });

    // ======================================================================
    // التهيئة التلقائية
    // ======================================================================

    window.initSync = function() {
        if (window._syncInitialized) return;
        window._syncInitialized = true;
        window.startSync();
        setInterval(() => {
            window.cleanupPendingMessages();
        }, 3600000);
        console.log('✅ sync.js v1.1 (محسّن) جاهز');
    };

    if (document.readyState === 'complete') {
        setTimeout(() => window.initSync(), 1000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => window.initSync(), 1000);
        });
    }

    console.log('✅ sync.js (الإصدار المحسّن v1.1) تم تحميلها');

})();
