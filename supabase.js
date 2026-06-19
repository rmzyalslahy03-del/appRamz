// ==================== supabase.js - الإصدار النهائي الكامل v4.0 ====================
// وسيط Supabase المتكامل: المصادقة، المزامنة الفورية، إدارة البيانات، القصص، القنوات، المكالمات، الملفات

(function() {
    // ======================================================================
    // التكوين الأساسي – استخدم مفاتيح مشروعك الخاص
    // ======================================================================
    const SUPABASE_URL = 'https://serlegwdzjulfcxabxzv.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_4_c97KxnG_7HTvfv-pKeNQ_FTlnK6Yx';

    let supabase = null;
    let isOnline = navigator.onLine;
    let initError = null;
    let activeChannels = {};
    let isInitialized = false;

    // ======================================================================
    // تهيئة عميل Supabase (يدعم عدة طرق تحميل)
    // ======================================================================
    function initSupabase() {
        try {
            // 1. عبر supabaseJs (UMD من script tag)
            if (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) {
                supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
                console.log('✅ Supabase client initialized via UMD (supabaseJs)');
                return true;
            }
            // 2. عبر window.supabase (مكتبة محملة مسبقاً)
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                console.log('✅ Supabase client initialized via window.supabase');
                return true;
            }
            // 3. استيراد ديناميكي (كحل أخير)
            console.warn('⚠️ Supabase not loaded via script, attempting dynamic import...');
            import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
                .then(module => {
                    supabase = module.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('✅ Supabase client initialized via dynamic import');
                    // إشعار للوظائف المعتمدة على supabase
                    if (window._onSupabaseReady) window._onSupabaseReady();
                })
                .catch(err => {
                    initError = err;
                    console.error('❌ Dynamic import failed:', err);
                    supabase = null;
                });
            return false;
        } catch (e) {
            initError = e;
            console.error('❌ Supabase initialization error:', e);
            supabase = null;
            return false;
        }
    }

    // تهيئة فورية
    const initResult = initSupabase();
    if (initResult) isInitialized = true;

    // تعيين العميل على window للاستخدام العام
    window.supabaseClient = supabase;

    // ======================================================================
    // دوال مساعدة
    // ======================================================================
    function getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        return user?.id || null;
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
    }

    // تحديث حالة الاتصال في جدول users
    async function updatePresence(status) {
        if (!supabase) return;
        const userId = getCurrentUserId();
        if (!userId) return;
        try {
            await supabase
                .from('users')
                .update({ is_online: status, last_seen: new Date().toISOString() })
                .eq('id', userId);
        } catch (e) { /* تجاهل */ }
    }

    // دوال وهمية (fallback) في حال عدم توفر Supabase
    function createFallbackFunction(name) {
        return function(...args) {
            console.warn(`⚠️ ${name} called but Supabase is not available. Returning local data.`);
            if (name.startsWith('fetch') || name.startsWith('get') || name.startsWith('check')) {
                return Promise.resolve([]);
            }
            return Promise.resolve(null);
        };
    }

    // ======================================================================
    // 1. دوال المصادقة (Auth)
    // ======================================================================

    // تسجيل الدخول بالبريد وكلمة المرور
    window.signInWithEmail = async function(email, password) {
        if (!supabase) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    };

    // إنشاء حساب جديد بالبريد وكلمة المرور
    window.signUpWithEmail = async function(email, password, name) {
        if (!supabase) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name: name || 'مستخدم' } }
        });
        if (error) throw error;
        if (data.user) {
            await supabase.from('users').upsert({
                id: data.user.id,
                email: email,
                name: name || 'مستخدم',
                avatar: '👤',
                is_online: true,
                last_seen: new Date().toISOString()
            });
        }
        return data.user;
    };

    // تسجيل الدخول برقم الهاتف (أو إنشاء حساب تلقائي)
    window.signInWithPhone = async function(phoneNumber, name) {
        if (!supabase) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        let { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', cleanPhone)
            .maybeSingle();
        if (findError && findError.code !== 'PGRST116') throw findError;
        let user;
        if (existingUser) {
            user = existingUser;
        } else {
            const newName = name || 'مستخدم_' + cleanPhone.slice(-4);
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    phone: cleanPhone,
                    name: newName,
                    avatar: newName.charAt(0),
                    is_online: true,
                    last_seen: new Date().toISOString()
                })
                .select()
                .single();
            if (insertError) throw insertError;
            user = newUser;
        }
        await supabase.from('users').update({
            is_online: true,
            last_seen: new Date().toISOString()
        }).eq('id', user.id);
        return user;
    };

    // الدخول كضيف
    window.signInAsGuest = async function() {
        if (!supabase) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const guestId = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
        const guestEmail = `guest_${guestId}@ramzapp.local`;
        const guestPassword = 'Guest@' + guestId;
        let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: guestEmail,
            password: guestPassword
        });
        let user;
        if (signInError) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: guestEmail,
                password: guestPassword,
                options: { data: { name: 'زائر' } }
            });
            if (signUpError) throw signUpError;
            user = signUpData.user;
            await supabase.from('users').upsert({
                id: user.id,
                email: guestEmail,
                name: 'زائر',
                avatar: '👤',
                is_guest: true,
                is_online: true,
                last_seen: new Date().toISOString()
            });
        } else {
            user = signInData.user;
            await supabase.from('users').update({
                is_online: true,
                last_seen: new Date().toISOString()
            }).eq('id', user.id);
        }
        return user;
    };

    // تسجيل الخروج
    window.signOut = async function() {
        const userId = getCurrentUserId();
        if (userId && supabase) {
            await supabase.from('users').update({
                is_online: false,
                last_seen: new Date().toISOString()
            }).eq('id', userId);
        }
        if (supabase) await supabase.auth.signOut();
        localStorage.removeItem('ramzapp_user');
    };

    // الحصول على الجلسة الحالية
    window.getCurrentSession = async function() {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data.session;
    };

    // ======================================================================
    // 2. المزامنة الفورية (Realtime) – قنوات المحادثات
    // ======================================================================

    window.activeChannels = activeChannels;

    // الاشتراك في محادثة معينة
    window.subscribeToChat = function(chatId, onMessage, onTyping) {
        if (!supabase || !isOnline) {
            console.warn('⚠️ Supabase غير متاح أو غير متصل، لن يتم الاشتراك في الوقت الفعلي');
            return null;
        }
        if (!chatId) return null;
        if (activeChannels[chatId]) {
            supabase.removeChannel(activeChannels[chatId]);
            delete activeChannels[chatId];
        }
        const userId = getCurrentUserId();
        const channel = supabase.channel(`chat:${chatId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: userId || 'anonymous' }
            }
        });
        // استقبال الرسائل الجديدة
        channel.on('broadcast', { event: 'new_message' }, (payload) => {
            if (!isOnline) return;
            const msg = {
                ...payload.payload,
                chat_id: chatId,
                sync_status: 'delivered',
                status: 'delivered'
            };
            if (msg.sender_id !== userId) {
                window.markMessagesAsRead?.(chatId, [msg.id]);
            }
            onMessage?.(msg);
        });
        // استقبال إشارات الكتابة
        channel.on('broadcast', { event: 'typing' }, (payload) => {
            if (!isOnline) return;
            const { userId: senderId, isTyping } = payload.payload;
            if (senderId !== userId) {
                onTyping?.(senderId, isTyping);
            }
        });
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                activeChannels[chatId] = channel;
                await fetchPendingMessages(chatId);
            }
        });
        return channel;
    };

    // إلغاء الاشتراك من محادثة
    window.unsubscribeFromChat = function(chatId) {
        if (activeChannels[chatId]) {
            if (supabase) supabase.removeChannel(activeChannels[chatId]);
            delete activeChannels[chatId];
            return true;
        }
        return false;
    };

    // إرسال رسالة عبر Realtime (وتخزينها مؤقتاً)
    window.sendMessageRealtime = async function(message) {
        if (!supabase || !isOnline) return { success: false, offline: true };
        const chatId = message.chat_id || message.sid;
        let channel = activeChannels[chatId];
        if (!channel) {
            channel = supabase.channel(`chat:${chatId}`, {
                config: { broadcast: { self: false } }
            });
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
                    likes: message.likes || 0,
                    liked: message.liked || false
                }
            });
            // تخزين كرسالة معلقة لضمان وصولها للآخرين
            await supabase.from('pending_messages').insert({
                message_id: message.id,
                chat_id: chatId,
                sender_id: message.sender_id || 'me',
                recipient_chat_id: chatId,
                payload: message,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    };

    // إرسال إشارة "يكتب الآن..."
    window.sendTypingEvent = function(chatId, isTyping) {
        if (!isOnline || !chatId) return;
        const channel = activeChannels[chatId];
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: {
                    chatId,
                    isTyping,
                    userId: getCurrentUserId()
                }
            }).catch(() => {});
        }
    };

    // تعليم رسائل كمقروءة
    window.markMessagesAsRead = async function(chatId, messageIds) {
        if (!supabase || !isOnline || !messageIds?.length) return;
        try {
            await supabase
                .from('messages')
                .update({ status: 'read', read_at: new Date().toISOString() })
                .in('id', messageIds);
        } catch (e) { /* تجاهل */ }
    };

    // جلب الرسائل المعلقة للمحادثة
    async function fetchPendingMessages(chatId) {
        if (!supabase) return;
        const userId = getCurrentUserId();
        if (!userId) return;
        try {
            const { data } = await supabase
                .from('pending_messages')
                .select('*')
                .eq('recipient_chat_id', chatId)
                .neq('sender_id', userId)
                .gt('expires_at', new Date().toISOString());
            if (data?.length) {
                const readIds = [];
                for (const record of data) {
                    const msg = record.payload;
                    msg.sync_status = 'delivered';
                    msg.status = 'delivered';
                    window._onMessageCallback?.(msg);
                    if (msg.sender_id !== userId) {
                        readIds.push(msg.id);
                    }
                }
                if (readIds.length > 0) {
                    await window.markMessagesAsRead?.(chatId, readIds);
                }
                await supabase.from('pending_messages').delete().in('message_id', data.map(r => r.message_id));
            }
        } catch (e) { /* تجاهل */ }
    }

    // ======================================================================
    // 3. دوال جلب البيانات (Queries)
    // ======================================================================

    // جلب محادثات المستخدم
    window.fetchUserChats = async function(userId) {
        if (!supabase || !isOnline) return [];
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', userId)
            .order('last_time', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    // جلب رسائل محادثة
    window.fetchMessages = async function(chatId, limit = 100) {
        if (!supabase || !isOnline) return [];
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('time', { ascending: true })
            .limit(limit);
        if (error) throw error;
        return data || [];
    };

    // جلب جهات الاتصال الخاصة بالمستخدم
    window.fetchContacts = async function(userId) {
        if (!supabase || !isOnline) return [];
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data || [];
    };

    // جلب جميع المستخدمين المسجلين (للمزامنة مع جهات الاتصال)
    window.fetchAllRegisteredUsers = async function() {
        if (!supabase || !isOnline) return [];
        const { data, error } = await supabase
            .from('users')
            .select('id, name, avatar, phone, email')
            .order('name');
        if (error) throw error;
        return data || [];
    };

    // التحقق من الأرقام المسجلة في التطبيق
    window.checkRegisteredPhones = async function(phones) {
        if (!supabase || !isOnline || !phones?.length) {
            return { registered: [], unregistered: phones || [] };
        }
        try {
            const { data, error } = await supabase
                .from('users')
                .select('phone, name, id')
                .in('phone', phones);
            if (error) throw error;
            const registeredMap = {};
            (data || []).forEach(user => {
                if (user.phone) {
                    registeredMap[user.phone] = {
                        phone: user.phone,
                        name: user.name,
                        id: user.id
                    };
                }
            });
            const registered = [];
            const unregistered = [];
            phones.forEach(phone => {
                if (registeredMap[phone]) {
                    registered.push(registeredMap[phone]);
                } else {
                    unregistered.push(phone);
                }
            });
            return { registered, unregistered };
        } catch (e) {
            console.error('❌ فشل التحقق من الأرقام المسجلة', e);
            return { registered: [], unregistered: phones };
        }
    };

    // جلب جميع الرسائل المعلقة للمستخدم الحالي
    window.fetchAllPendingMessages = async function() {
        if (!supabase || !isOnline) return [];
        const userId = getCurrentUserId();
        if (!userId) return [];
        try {
            const { data, error } = await supabase
                .from('pending_messages')
                .select('*')
                .neq('sender_id', userId)
                .gt('expires_at', new Date().toISOString());
            if (error) throw error;
            if (data?.length) {
                await supabase.from('pending_messages')
                    .delete()
                    .in('message_id', data.map(r => r.message_id));
            }
            return data?.map(r => r.payload) || [];
        } catch (e) {
            console.warn('⚠️ فشل جلب الرسائل المعلقة', e);
            return [];
        }
    };

    // ======================================================================
    // 4. دوال التحديث (Updates)
    // ======================================================================

    // تحديث حالة الاتصال للمستخدم
    window.setUserOnlineStatus = function(status) {
        if (!supabase) return;
        const userId = getCurrentUserId();
        if (!userId) return;
        supabase.from('users')
            .update({ is_online: status, last_seen: new Date().toISOString() })
            .eq('id', userId)
            .catch(() => {});
    };

    // تحديث بيانات الملف الشخصي
    window.updateUserProfile = async function(updates) {
        if (!supabase) throw new Error('Supabase غير متاح');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    };

    // حذف الحساب
    window.deleteUserAccount = async function() {
        if (!supabase) throw new Error('Supabase غير متاح');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        await supabase.from('users').delete().eq('id', userId);
        await supabase.auth.signOut();
        localStorage.removeItem('ramzapp_user');
    };

    // ======================================================================
    // 5. دوال القصص (Stories)
    // ======================================================================

    // جلب القصص من الخادم
    window.fetchStories = async function() {
        if (!supabase || !isOnline) return [];
        try {
            const { data, error } = await supabase
                .from('stories')
                .select('*')
                .gt('expires_at', new Date().toISOString())
                .order('time', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('⚠️ فشل جلب القصص:', e);
            return [];
        }
    };

    // إضافة قصة إلى الخادم
    window.addStoryToSupabase = async function(storyData) {
        if (!supabase || !isOnline) return null;
        try {
            const { data, error } = await supabase
                .from('stories')
                .insert({
                    id: storyData.id,
                    user_id: storyData.user_id,
                    name: storyData.name,
                    avatar: storyData.avatar,
                    type: storyData.type,
                    content: storyData.content,
                    caption: storyData.caption || '',
                    time: storyData.time,
                    expires_at: storyData.expires_at,
                    isViewed: storyData.isViewed || false,
                    color: storyData.color || '#ff0050'
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('⚠️ فشل إضافة القصة إلى Supabase:', e);
            return null;
        }
    };

    // حذف قصة من الخادم
    window.deleteStoryFromSupabase = async function(storyId) {
        if (!supabase || !isOnline) return false;
        try {
            const { error } = await supabase
                .from('stories')
                .delete()
                .eq('id', storyId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('⚠️ فشل حذف القصة:', e);
            return false;
        }
    };

    // مزامنة القصص بين المحلي والخادم
    window.syncStories = async function() {
        if (!supabase || !isOnline) {
            console.warn('⚠️ لا يمكن مزامنة القصص: غير متصل أو Supabase غير جاهز');
            return { synced: 0, failed: 0 };
        }
        let synced = 0, failed = 0;
        try {
            const serverStories = await window.fetchStories();
            const localStories = window.getStories?.() || [];
            const now = new Date().toISOString();

            // حذف المنتهية محلياً
            const expiredLocal = localStories.filter(s => s.expires_at < now);
            for (const story of expiredLocal) {
                window.deleteStory?.(story.id);
                synced++;
            }

            // إضافة الجديدة من الخادم
            const localIds = localStories.map(s => s.id);
            for (const story of serverStories) {
                if (!localIds.includes(story.id) && story.expires_at > now) {
                    window.addStory?.(story);
                    synced++;
                }
            }

            // رفع المحلية غير الموجودة على الخادم
            const serverIds = serverStories.map(s => s.id);
            for (const story of localStories) {
                if (!serverIds.includes(story.id) && story.expires_at > now) {
                    await window.addStoryToSupabase(story);
                    synced++;
                }
            }

            // تحديث حالة المشاهدة
            for (const story of localStories) {
                if (story.isViewed) {
                    await supabase
                        .from('stories')
                        .update({ isViewed: true })
                        .eq('id', story.id)
                        .catch(() => {});
                }
            }

            // تحديث الواجهة
            if (typeof renderStories === 'function') renderStories();
            console.log(`✅ تمت مزامنة القصص: ${synced} محدثة, ${failed} فاشلة`);
            return { synced, failed };
        } catch (e) {
            console.warn('⚠️ فشل مزامنة القصص:', e);
            return { synced, failed: 1 };
        }
    };

    // ======================================================================
    // 6. دوال القنوات (Channels)
    // ======================================================================

    // جلب القنوات المتاحة
    window.fetchChannels = async function() {
        if (!supabase || !isOnline) return [];
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .order('followers', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    // الاشتراك في قناة
    window.subscribeToChannel = async function(channelId) {
        if (!supabase || !isOnline) throw new Error('📡 غير متصل');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        const { error } = await supabase
            .from('channel_subscribers')
            .upsert({ channel_id: channelId, user_id: userId });
        if (error) throw error;
        // زيادة عدد المتابعين باستخدام دالة RPC
        await supabase.rpc('increment_channel_followers', { channel_id: channelId });
        return true;
    };

    // ======================================================================
    // 7. دوال المكالمات وإشارات WebRTC
    // ======================================================================

    // إرسال إشارة WebRTC إلى مستخدم معين
    window.sendCallSignal = async function(targetUserId, signalData) {
        if (!supabase || !isOnline) return false;
        try {
            const channel = supabase.channel(`call:${targetUserId}`, {
                config: { broadcast: { self: false } }
            });
            await channel.subscribe();
            await channel.send({
                type: 'broadcast',
                event: 'call_signal',
                payload: {
                    from: getCurrentUserId(),
                    signal: signalData,
                    timestamp: new Date().toISOString()
                }
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
            return true;
        } catch (e) {
            console.warn('⚠️ فشل إرسال إشارة المكالمة:', e);
            return false;
        }
    };

    // الاشتراك في إشارات المكالمات القادمة
    window.subscribeToCallSignals = function(callback) {
        if (!supabase || !isOnline) return null;
        const userId = getCurrentUserId();
        if (!userId) return null;
        const channel = supabase.channel(`call:${userId}`, {
            config: { broadcast: { self: false } }
        });
        channel.on('broadcast', { event: 'call_signal' }, (payload) => {
            callback(payload.payload);
        });
        channel.subscribe();
        return channel;
    };

    // ======================================================================
    // 8. دوال الوسائط (Media) – التخزين في Supabase Storage
    // ======================================================================

    // رفع ملف إلى Supabase Storage
    window.uploadMedia = async function(file, path) {
        if (!supabase || !isOnline) throw new Error('📡 غير متصل');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        const filePath = `users/${userId}/${path || file.name}`;
        const { data, error } = await supabase.storage
            .from('ramz-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage
            .from('ramz-images')
            .getPublicUrl(filePath);
        return urlData.publicUrl;
    };

    // حذف ملف من Supabase Storage
    window.deleteMedia = async function(path) {
        if (!supabase || !isOnline) throw new Error('📡 غير متصل');
        const { error } = await supabase.storage
            .from('ramz-images')
            .remove([path]);
        if (error) throw error;
        return true;
    };

    // ======================================================================
    // 9. إدارة الأحداث العامة
    // ======================================================================

    window._onMessageCallback = null;
    window.setOnMessageCallback = function(callback) {
        window._onMessageCallback = callback;
    };

    // ======================================================================
    // 10. التنظيف الدوري
    // ======================================================================

    // حذف الرسائل المعلقة المنتهية كل ساعة
    setInterval(async () => {
        if (!supabase || !isOnline) return;
        try {
            await supabase
                .from('pending_messages')
                .delete()
                .lt('expires_at', new Date().toISOString());
        } catch (e) { /* تجاهل */ }
    }, 3600000);

    // تحديث حالة الاتصال كل 30 ثانية
    setInterval(() => {
        if (isOnline && supabase) {
            const userId = getCurrentUserId();
            if (userId) {
                supabase.from('users')
                    .update({ is_online: true, last_seen: new Date().toISOString() })
                    .eq('id', userId)
                    .catch(() => {});
            }
        }
    }, 30000);

    // ======================================================================
    // 11. مستمعي أحداث الشبكة
    // ======================================================================

    window.addEventListener('online', async () => {
        isOnline = true;
        window.dispatchEvent(new Event('ramzapp:online'));
        if (!supabase && !isInitialized) {
            const retryResult = initSupabase();
            if (retryResult) {
                isInitialized = true;
                window.supabaseClient = supabase;
                console.log('✅ Supabase re-initialized after online');
            }
        }
        if (supabase) {
            await updatePresence(true);
        }
        if (window.syncAllPendingMessages) window.syncAllPendingMessages();
        if (window.syncStories) window.syncStories();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        window.dispatchEvent(new Event('ramzapp:offline'));
    });

    // ======================================================================
    // 12. تصدير دوال إضافية
    // ======================================================================

    window.isSupabaseOnline = () => isOnline && supabase !== null;
    window.getSupabaseInstance = () => supabase;

    // ======================================================================
    // 13. دوال الدعوة (Invite)
    // ======================================================================

    window.getInviteCode = async function() {
        if (!supabase) return null;
        const userId = getCurrentUserId();
        if (!userId) return null;
        try {
            const { data, error } = await supabase
                .from('users')
                .select('invite_code')
                .eq('id', userId)
                .single();
            if (error) throw error;
            return data?.invite_code || null;
        } catch (e) {
            return null;
        }
    };

    window.createInviteLink = function(code) {
        return `${window.location.origin}/redirect.html?ref=${code}`;
    };

    // ======================================================================
    // رسالة إتمام التهيئة
    // ======================================================================

    console.log('✅ supabase.js (الإصدار النهائي الكامل) جاهز');
    if (supabase) {
        console.log('🔗 متصل بـ:', SUPABASE_URL);
    } else {
        console.warn('⚠️ يعمل في وضع عدم الاتصال (Supabase غير متاح) - سيتم إعادة المحاولة عند الاتصال.');
    }

})();
