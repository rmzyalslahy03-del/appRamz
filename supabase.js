// supabase.js - وسيط Supabase (بدون export)
(async function() {
    const SUPABASE_URL = 'https://serlegwdzjulfcxabxzv.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_4_c97KxnG_7HTvfv-pKeNQ_FTlnK6Yx';

    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabase;

    let isOnline = navigator.onLine;
    let activeChannels = {};

    window.addEventListener('online', () => {
        isOnline = true;
        window.syncAllPendingMessages?.();
        updatePresence(true);
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updatePresence(false);
    });

    function updatePresence(online) {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        if (!user?.id) return;
        supabase.from('users').update({ is_online: online, last_seen: new Date().toISOString() }).eq('id', user.id).catch(() => {});
    }

    window.subscribeToChat = function(chatId, onMessage) {
        if (!chatId) return;
        if (activeChannels[chatId]) {
            supabase.removeChannel(activeChannels[chatId]);
            activeChannels[chatId] = null;
        }
        const channel = supabase.channel(`chat:${chatId}`, {
            config: { broadcast: { self: false }, presence: { key: JSON.parse(localStorage.getItem('ramzapp_user') || '{}').id || 'anonymous' } }
        });
        channel.on('broadcast', { event: 'new_message' }, (payload) => {
            if (!isOnline) return;
            onMessage?.({
                ...payload.payload,
                chat_id: chatId,
                sync_status: 'delivered'
            });
        });
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                activeChannels[chatId] = channel;
                await fetchPendingMessages(chatId);
            }
        });
    };

    window.unsubscribeFromChat = function(chatId) {
        if (activeChannels[chatId]) {
            supabase.removeChannel(activeChannels[chatId]);
            activeChannels[chatId] = null;
        }
    };

    window.sendMessageRealtime = async function(message) {
        if (!isOnline) return { success: false, offline: true };
        const chatId = message.chat_id || message.sid;
        let channel = activeChannels[chatId];
        if (!channel) {
            channel = supabase.channel(`chat:${chatId}`, { config: { broadcast: { self: false } } });
            await channel.subscribe();
            activeChannels[chatId] = channel;
        }
        try {
            await channel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: {
                    id: message.id,
                    chat_id: chatId,
                    sender_id: message.sender_id || 'me',
                    text: message.text,
                    img: message.img,
                    voice_blob: message.voice_blob,
                    voice_duration: message.voice_duration,
                    reply_to: message.reply_to,
                    time: message.time,
                    likes: 0,
                    liked: false
                }
            });
            await supabase.from('pending_messages').insert({
                message_id: message.id,
                chat_id: chatId,
                sender_id: message.sender_id || 'me',
                recipient_chat_id: chatId,
                payload: message,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 15*24*60*60*1000).toISOString()
            });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    };

    async function fetchPendingMessages(chatId) {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        if (!user?.id) return;
        try {
            const { data } = await supabase
                .from('pending_messages')
                .select('*')
                .eq('recipient_chat_id', chatId)
                .neq('sender_id', user.id)
                .gt('expires_at', new Date().toISOString());
            if (data?.length) {
                data.forEach(record => {
                    const msg = record.payload;
                    msg.sync_status = 'delivered';
                    window._onMessageCallback?.(msg);
                });
                await supabase.from('pending_messages').delete().in('message_id', data.map(r => r.message_id));
            }
        } catch (e) {}
    }

    window.checkRegisteredPhones = async function(phones) {
        if (!isOnline || !phones.length) return { registered: [], unregistered: phones };
        try {
            const { data } = await supabase.functions.invoke('check_phones', { body: { phones } });
            return data || { registered: [], unregistered: phones };
        } catch (e) {
            return { registered: [], unregistered: phones };
        }
    };

    window.getInviteCode = async function() {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        if (!user?.id) return null;
        const { data } = await supabase.from('users').select('invite_code').eq('id', user.id).single();
        return data?.invite_code;
    };

    window.createInviteLink = function(code) {
        return `${location.origin}/login.html?ref=${code}`;
    };

    window.setUserOnlineStatus = function(status) {
        updatePresence(status);
    };

    window.fetchAllPendingMessages = async function() {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        if (!user?.id) return [];
        const { data } = await supabase
            .from('pending_messages')
            .select('*')
            .neq('sender_id', user.id)
            .gt('expires_at', new Date().toISOString());
        return data?.map(r => r.payload) || [];
    };

    setInterval(() => { if (isOnline) updatePresence(true); }, 30000);
    console.log('✅ supabase.js initialized');
})();
