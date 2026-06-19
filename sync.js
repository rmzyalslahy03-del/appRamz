// sync.js - طبقة المزامنة الذكية (نهائي، بدون export)
(function() {
    let isSyncing = false;
    let periodicSyncInterval = null;
    const MAX_RETRIES = 5;
    const BASE_DELAY = 2000;
    const MAX_DELAY = 60000;
    const SYNC_INTERVAL = 30000;

    function isOnline() { return navigator.onLine; }

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

    async function syncSingleMessage(msg) {
        if (!isOnline()) return { success: false, offline: true };
        window.updateMessage?.(msg.id, { sync_status: 'sending' });
        try {
            const result = window.sendMessageRealtime
                ? await window.sendMessageRealtime(msg)
                : { success: false, error: 'Supabase missing' };
            if (result.success) {
                window.updateMessage?.(msg.id, { sync_status: 'sent', status: 'sent', sync_time: new Date().toISOString() });
                return { success: true };
            } else if (result.offline) {
                return { success: false, offline: true };
            } else {
                window.updateMessage?.(msg.id, { sync_status: 'failed', status: 'failed', sync_error: result.error, sync_attempts: (msg.sync_attempts||0)+1 });
                return { success: false, error: result.error };
            }
        } catch (e) {
            window.updateMessage?.(msg.id, { sync_status: 'failed', status: 'failed', sync_error: e.message, sync_attempts: (msg.sync_attempts||0)+1 });
            return { success: false, error: e.message };
        }
    }

    window.syncAllPendingMessages = async function() {
        if (isSyncing) return { synced: 0, failed: 0, alreadyRunning: true };
        if (!isOnline()) return { synced: 0, failed: 0, offline: true };
        isSyncing = true;
        const pending = getPendingMessages();
        let synced = 0, failed = 0;
        if (pending.length === 0) { isSyncing = false; return { synced: 0, failed: 0 }; }
        pending.sort((a,b) => new Date(a.time) - new Date(b.time));
        for (const msg of pending) {
            if (msg.sync_status === 'failed' && (msg.sync_attempts||0) >= MAX_RETRIES) { failed++; continue; }
            const res = await syncSingleMessage(msg);
            if (res.success) synced++;
            else if (res.offline) break;
            else failed++;
        }
        // سحب الرسائل المؤقتة من الخادم
        if (window.fetchAllPendingMessages) {
            const received = await window.fetchAllPendingMessages();
            if (received?.length) {
                for (const msg of received) {
                    msg.sync_status = 'delivered'; msg.status = 'delivered';
                    window.addMessage?.(msg);
                    const chat = window.getChat?.(msg.chat_id);
                    if (chat) {
                        chat.last_msg = msg.text || (msg.img?'📷':msg.voice_blob?'🎤':'📎');
                        chat.last_time = msg.time;
                        if (!chat.online && msg.sender_id !== 'me') chat.unread = (chat.unread||0)+1;
                        window.saveChat?.(chat);
                    }
                }
                if (typeof playNotificationSound === 'function') playNotificationSound();
            }
        }
        refreshUI();
        isSyncing = false;
        return { synced, failed, offline: false };
    };

    function refreshUI() {
        if (typeof renderChats === 'function') renderChats();
        if (typeof renderMessages === 'function' && typeof currentChatId !== 'undefined') renderMessages();
        if (typeof updateStats === 'function') updateStats();
    }

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
        return await syncSingleMessage({...msg, sync_attempts: 0});
    };
    window.retryAllFailed = async function() {
        for (const m of getPendingMessages().filter(m => m.sync_status === 'failed')) {
            window.updateMessage?.(m.id, { sync_attempts: 0, sync_status: 'pending-send' });
        }
        return window.syncAllPendingMessages();
    };

    window.getSyncStats = function() {
        const pending = getPendingMessages();
        const stats = { pending: pending.length, total: 0, byStatus: {}, isSyncing, online: isOnline() };
        const chats = window.getChats?.() || [];
        chats.forEach(c => {
            const msgs = window.getMessages?.(c.id) || [];
            stats.total += msgs.length;
            msgs.forEach(m => {
                stats.byStatus[m.sync_status] = (stats.byStatus[m.sync_status]||0)+1;
            });
        });
        return stats;
    };

    function startPeriodicSync() {
        if (periodicSyncInterval) return;
        periodicSyncInterval = setInterval(() => {
            if (!isSyncing && isOnline() && getPendingMessages().length > 0) window.syncAllPendingMessages();
        }, SYNC_INTERVAL);
    }

    window.startSync = function() {
        startPeriodicSync();
        if (isOnline()) setTimeout(() => window.syncAllPendingMessages(), 2000);
    };

    window.stopSync = () => { clearInterval(periodicSyncInterval); periodicSyncInterval = null; };

    window.addEventListener('online', async () => {
        await new Promise(r => setTimeout(r, 1000));
        window.syncAllPendingMessages();
    });
    window.addEventListener('offline', () => { isSyncing = false; });

    startPeriodicSync();
    if (isOnline()) setTimeout(() => window.syncAllPendingMessages(), 2000);
    console.log('✅ sync.js ready');
})();
