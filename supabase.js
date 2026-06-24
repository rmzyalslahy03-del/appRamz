// ======================================================================
// supabase.js - الإصدار النهائي المعدل v5.7 (مع دعم sender_id الحقيقي)
// جميع الميزات مفعلة | وسيط مؤقت مع تحميل ديناميكي
// ======================================================================

(function() {
    'use strict';

    // ======================================================================
    // التكوين الأساسي
    // ======================================================================
    const SUPABASE_URL = 'https://serlegwdzjulfcxabxzv.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_4_c97KxnG_7HTvfv-pKeNQ_FTlnK6Yx';

    let supabase = null;
    let isOnline = navigator.onLine;
    let isInitialized = false;
    let activeChannels = {};
    let loadingPromise = null;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 5;

    // ======================================================================
    // تحميل مكتبة Supabase ديناميكياً (إذا لم تكن محملة مسبقاً)
    // ======================================================================
    async function loadSupabaseLibrary() {
        if (loadingPromise) return loadingPromise;
        loadingPromise = new Promise((resolve) => {
            // 1. تحقق من وجود المكتبة مسبقاً (من script tag)
            if (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) {
                resolve(true);
                return;
            }
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                resolve(true);
                return;
            }

            // 2. تحميل من CDN
            console.log('⏳ تحميل مكتبة Supabase من CDN...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                if (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) {
                    console.log('✅ تم تحميل Supabase عبر UMD');
                    resolve(true);
                } else if (window.supabase && typeof window.supabase.createClient === 'function') {
                    console.log('✅ تم تحميل Supabase عبر window.supabase');
                    resolve(true);
                } else {
                    console.warn('⚠️ تحميل Supabase فشل (المكتبة غير معرفة)');
                    resolve(false);
                }
            };
            script.onerror = () => {
                console.warn('⚠️ تعذر تحميل سكربت Supabase');
                resolve(false);
            };
            document.head.appendChild(script);
        });
        return loadingPromise;
    }

    // ======================================================================
    // تهيئة عميل Supabase
    // ======================================================================
    async function initSupabase() {
        if (initAttempts >= MAX_INIT_ATTEMPTS) {
            console.warn('⚠️ تم تجاوز الحد الأقصى لمحاولات تهيئة Supabase');
            return false;
        }
        initAttempts++;

        const loaded = await loadSupabaseLibrary();
        if (!loaded) {
            supabase = null;
            return false;
        }

        try {
            if (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) {
                supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
            } else if (window.supabase && typeof window.supabase.createClient === 'function') {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            } else {
                throw new Error('لا يمكن تهيئة عميل Supabase');
            }
            console.log('✅ Supabase client initialized successfully');
            isInitialized = true;
            window.supabaseClient = supabase;
            return true;
        } catch (e) {
            console.warn('⚠️ Supabase initialization failed:', e.message);
            supabase = null;
            window.supabaseClient = null;
            return false;
        }
    }

    // ======================================================================
    // التأكد من جاهزية العميل (مع إعادة المحاولة)
    // ======================================================================
    function ensureSupabase() {
        if (supabase) return supabase;
        // محاولة التهيئة فوراً إذا لم تكن جاهزة (غير متزامنة)
        if (!loadingPromise) {
            initSupabase().catch(() => {});
        }
        return supabase;
    }

    // تهيئة فورية (غير متزامنة)
    initSupabase().catch(() => {});
    window.supabaseClient = supabase;

    // ======================================================================
    // دوال مساعدة
    // ======================================================================
    function getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        return user?.id || user?.phone || null;
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
    }

    function normalizePhone(phone) {
        if (!phone) return phone;
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }
        return cleaned;
    }

    // ======================================================================
    // 1. دوال المصادقة (Auth)
    // ======================================================================

    // ----- البريد الإلكتروني -----

    window.signUpWithEmail = async function(email, password, name) {
        const client = ensureSupabase();
        if (!client) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');

        // 1. تسجيل المستخدم في Supabase Auth
        const { data: authData, error: authError } = await client.auth.signUp({
            email: email,
            password: password,
            options: { data: { name: name || 'مستخدم' } }
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('فشل إنشاء الحساب');

        const userId = authData.user.id;

        // 2. إدراج المستخدم في جدول users
        const { error: insertError } = await client
            .from('users')
            .insert({
                id: userId,
                email: email,
                name: name || 'مستخدم',
                jid: userId + '@c.us',
                lid: 'lid_' + Math.random().toString(36).substr(2, 8),
                avatar_url: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'مستخدم') + '&background=ff0050&color=fff&size=200',
                public_key: null,
                is_online: true,
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString()
            });
        if (insertError) {
            console.error('❌ فشل إدراج المستخدم:', insertError);
            throw new Error('فشل حفظ بيانات المستخدم');
        }

        // 3. تخزين بيانات المستخدم محلياً
        const userData = {
            id: userId,
            email: email,
            name: name || 'مستخدم',
            avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || 'مستخدم') + '&background=ff0050&color=fff&size=200'
        };
        localStorage.setItem('ramzapp_user', JSON.stringify(userData));
        return userData;
    };

    window.signInWithEmail = async function(email, password) {
        const client = ensureSupabase();
        if (!client) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');

        const { data: authData, error: authError } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('المستخدم غير موجود');

        const userId = authData.user.id;

        // جلب بيانات المستخدم من جدول users
        let { data: userData, error: userError } = await client
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            // إذا لم يكن في جدول users، نحاول إنشاؤه تلقائياً
            const { error: insertError } = await client
                .from('users')
                .insert({
                    id: userId,
                    email: email,
                    name: authData.user.user_metadata?.name || 'مستخدم',
                    jid: userId + '@c.us',
                    lid: 'lid_' + Math.random().toString(36).substr(2, 8),
                    avatar_url: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(authData.user.user_metadata?.name || 'مستخدم') + '&background=ff0050&color=fff&size=200',
                    public_key: null,
                    is_online: true,
                    last_seen: new Date().toISOString(),
                    created_at: new Date().toISOString()
                });
            if (insertError) throw new Error('فشل حفظ بيانات المستخدم');

            // جلب البيانات مرة أخرى
            const { data: newUserData } = await client
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            userData = newUserData;
        }

        // تحديث حالة الاتصال
        await client
            .from('users')
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq('id', userId);

        const result = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            avatar: userData.avatar_url
        };
        localStorage.setItem('ramzapp_user', JSON.stringify(result));
        return result;
    };

    // ----- رقم الهاتف (محسن مع دعم تسجيل رقم جديد) -----

    window.signUpWithPhone = async function(phone, name, publicKey) {
        const client = ensureSupabase();
        if (!client) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');

        const cleanPhone = normalizePhone(phone);
        console.log('📱 جاري تسجيل رقم جديد:', cleanPhone);

        // التحقق من عدم وجود الرقم
        const { data: existing, error: findError } = await client
            .from('users')
            .select('phone')
            .eq('phone', cleanPhone)
            .maybeSingle();

        if (findError && findError.code !== 'PGRST116') throw findError;
        if (existing) throw new Error('⚠️ هذا الرقم مسجل بالفعل');

        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const userName = name || 'مستخدم';

        // إدراج المستخدم
        const { data: newUser, error: insertError } = await client
            .from('users')
            .insert({
                id: userId,
                phone: cleanPhone,
                jid: cleanPhone + '@c.us',
                lid: 'lid_' + Math.random().toString(36).substr(2, 8),
                name: userName,
                avatar_url: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=ff0050&color=fff&size=200',
                public_key: publicKey || null,
                status: 'مرحباً!',
                is_online: true,
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('❌ فشل إدراج المستخدم:', insertError);
            throw new Error('فشل حفظ بيانات المستخدم: ' + insertError.message);
        }

        console.log('✅ تم إنشاء الحساب بنجاح:', newUser);

        const userData = {
            id: newUser.phone,
            phone: newUser.phone,
            name: newUser.name,
            avatar: newUser.avatar_url,
            public_key: newUser.public_key
        };
        localStorage.setItem('ramzapp_user', JSON.stringify(userData));
        return userData;
    };

    window.signInWithPhone = async function(phone) {
        const client = ensureSupabase();
        if (!client) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');

        const cleanPhone = normalizePhone(phone);
        console.log('🔍 جاري البحث عن الرقم (لتسجيل الدخول):', cleanPhone);

        const { data: user, error } = await client
            .from('users')
            .select('phone, name, avatar_url, public_key, is_online, last_seen')
            .eq('phone', cleanPhone)
            .single();

        if (error) {
            console.error('❌ خطأ في الاستعلام:', error);
            if (error.code === 'PGRST116') {
                throw new Error('⚠️ هذا الرقم غير مسجل في التطبيق');
            }
            throw error;
        }

        if (!user) {
            console.error('❌ المستخدم غير موجود:', cleanPhone);
            throw new Error('⚠️ هذا الرقم غير مسجل في التطبيق');
        }

        console.log('✅ تم العثور على المستخدم:', user.name);

        // تحديث حالة الاتصال
        const { error: updateError } = await client
            .from('users')
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq('phone', cleanPhone);

        if (updateError) {
            console.warn('⚠️ فشل تحديث حالة الاتصال:', updateError);
        }

        const userData = {
            id: user.phone,
            phone: user.phone,
            name: user.name,
            avatar: user.avatar_url,
            public_key: user.public_key
        };
        localStorage.setItem('ramzapp_user', JSON.stringify(userData));
        return userData;
    };

    // ----- ضيف -----

    window.signInAsGuest = async function() {
        const client = ensureSupabase();
        if (!client) throw new Error('📡 Supabase غير متاح.');
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');

        const guestId = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
        const guestName = 'زائر_' + Math.random().toString(36).substr(2, 4);

        const { data: newUser, error } = await client
            .from('users')
            .insert({
                id: guestId,
                phone: guestId,
                jid: guestId + '@c.us',
                lid: 'lid_guest_' + Math.random().toString(36).substr(2, 6),
                name: guestName,
                avatar_url: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(guestName) + '&background=666&color=fff&size=200',
                public_key: null,
                is_guest: true,
                is_online: true,
                last_seen: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        const userData = {
            id: newUser.id,
            phone: null,
            name: newUser.name,
            avatar: newUser.avatar_url,
            public_key: null,
            is_guest: true
        };
        localStorage.setItem('ramzapp_user', JSON.stringify(userData));
        return userData;
    };

    // ----- تسجيل الخروج -----

    window.signOut = async function() {
        const client = ensureSupabase();
        const userId = getCurrentUserId();
        if (userId && client) {
            await client
                .from('users')
                .update({ is_online: false, last_seen: new Date().toISOString() })
                .eq('id', userId)
                .catch(() => {});
            try {
                await client.auth.signOut();
            } catch(e) {}
        }
        localStorage.removeItem('ramzapp_user');
        // إلغاء الاشتراك من جميع القنوات
        for (const key in activeChannels) {
            client?.removeChannel(activeChannels[key]);
            delete activeChannels[key];
        }
    };

    // ======================================================================
    // 2. دوال الاستعلام عن المستخدمين
    // ======================================================================

    window.fetchUserByPhone = async function(phone) {
        const client = ensureSupabase();
        if (!client || !isOnline) return null;
        const cleanPhone = normalizePhone(phone);
        const { data, error } = await client
            .from('users')
            .select('id, phone, name, avatar_url, public_key, is_online, last_seen')
            .eq('phone', cleanPhone)
            .maybeSingle();
        if (error || !data) return null;
        return data;
    };

    window.fetchUsersByPhones = async function(phones) {
        const client = ensureSupabase();
        if (!client || !isOnline || !phones?.length) return [];
        const cleanPhones = phones.map(p => normalizePhone(p));
        const { data, error } = await client
            .from('users')
            .select('id, phone, name, avatar_url, public_key, is_online, last_seen')
            .in('phone', cleanPhones);
        if (error) return [];
        return data || [];
    };

    window.fetchUserById = async function(userId) {
        const client = ensureSupabase();
        if (!client || !isOnline) return null;
        const { data, error } = await client
            .from('users')
            .select('id, phone, name, avatar_url, public_key, is_online, last_seen')
            .eq('id', userId)
            .single();
        if (error || !data) return null;
        return data;
    };

    // ======================================================================
    // 3. الوسيط (Broker) – Realtime لتوجيه الرسائل
    // ======================================================================

    window.activeChannels = activeChannels;

    window.subscribeToChat = function(chatId, onMessage, onTyping) {
        const client = ensureSupabase();
        if (!client || !isOnline || !chatId) {
            console.warn('⚠️ لا يمكن الاشتراك: Supabase غير متاح أو غير متصل');
            return null;
        }

        if (activeChannels[chatId]) {
            client.removeChannel(activeChannels[chatId]);
            delete activeChannels[chatId];
        }

        const userId = getCurrentUserId();
        const channel = client.channel(`chat:${chatId}`, {
            config: { broadcast: { self: false } }
        });

        // استقبال الرسائل الجديدة
        channel.on('broadcast', { event: 'new_message' }, (payload) => {
            if (!isOnline) return;
            const msg = payload.payload;
            console.log(`📩 رسالة واردة من قناة ${chatId}:`, msg);
            if (!msg.chat_id) msg.chat_id = chatId;
            if (typeof onMessage === 'function') onMessage(msg);
        });

        // استقبال إشارات الكتابة
        channel.on('broadcast', { event: 'typing' }, (payload) => {
            if (!isOnline) return;
            const { userId: senderId, isTyping } = payload.payload;
            if (senderId !== userId && typeof onTyping === 'function') {
                onTyping(senderId, isTyping);
            }
        });

        // استقبال إشارات القراءة
        channel.on('broadcast', { event: 'read_receipt' }, (payload) => {
            if (!isOnline) return;
            const { messageId, readerId } = payload.payload;
            if (typeof window.updateMessageStatus === 'function') {
                window.updateMessageStatus(messageId, { status: 'read' });
            }
        });

        // استقبال طلبات المكالمات
        channel.on('broadcast', { event: 'call_offer' }, (payload) => {
            if (!isOnline) return;
            if (typeof onMessage === 'function') {
                onMessage(payload.payload);
            }
        });

        channel.on('broadcast', { event: 'call_answer' }, (payload) => {
            if (!isOnline) return;
            if (typeof onMessage === 'function') {
                onMessage(payload.payload);
            }
        });

        channel.on('broadcast', { event: 'call_reject' }, (payload) => {
            if (!isOnline) return;
            if (typeof onMessage === 'function') {
                onMessage(payload.payload);
            }
        });

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                activeChannels[chatId] = channel;
                console.log(`✅ مشترك في قناة: ${chatId}`);
                window.fetchPendingMessages(chatId);
            } else if (status === 'CHANNEL_ERROR') {
                console.warn(`⚠️ خطأ في قناة: ${chatId}`);
            } else {
                console.log(`📡 حالة القناة ${chatId}:`, status);
            }
        });

        return channel;
    };

    window.unsubscribeFromChat = function(chatId) {
        const client = ensureSupabase();
        if (activeChannels[chatId]) {
            client?.removeChannel(activeChannels[chatId]);
            delete activeChannels[chatId];
            return true;
        }
        return false;
    };

    // ======================================================================
    // 4. إرسال الرسائل (مع sender_id الحقيقي بدلاً من 'me')
    // ======================================================================

    window.sendMessageRealtime = async function(msg) {
        const client = ensureSupabase();
        if (!client || !isOnline) {
            console.warn('⚠️ لا يمكن الإرسال: Supabase غير متاح أو غير متصل');
            return { success: false, offline: true };
        }

        const chatId = msg.chat_id || msg.sid;
        if (!chatId) {
            console.error('❌ معرف المحادثة مطلوب');
            return { success: false, error: 'معرف المحادثة مطلوب' };
        }

        console.log(`📤 محاولة إرسال رسالة إلى قناة ${chatId}:`, msg);

        let channel = activeChannels[chatId];
        if (!channel) {
            console.log(`🔧 إنشاء قناة جديدة لـ ${chatId}`);
            channel = client.channel(`chat:${chatId}`, {
                config: { broadcast: { self: false } }
            });
            try {
                await channel.subscribe();
                activeChannels[chatId] = channel;
                console.log(`✅ تم إنشاء قناة ${chatId}`);
            } catch (err) {
                console.error(`❌ فشل إنشاء قناة ${chatId}:`, err);
                return { success: false, error: err.message };
            }
        }

        try {
            // 1. إرسال عبر WebSocket
            await channel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: msg
            });
            console.log(`✅ تم إرسال الرسالة عبر WebSocket إلى قناة ${chatId}`);

            // 2. الحصول على رقم المستخدم الحقيقي (بدلاً من 'me')
            const currentUser = getCurrentUser();
            const senderPhone = currentUser?.phone || currentUser?.id || 'me';
            console.log(`📤 إرسال رسالة من: ${senderPhone}`);

            // 3. حفظ في pending_messages مع sender_id الصحيح
            const { error: insertError } = await client
                .from('pending_messages')
                .insert({
                    message_id: msg.id,
                    chat_id: chatId,
                    sender_id: senderPhone,  // رقم حقيقي وليس 'me'
                    recipient_chat_id: chatId,
                    payload: msg,
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
                });

            if (insertError) {
                console.warn('⚠️ فشل حفظ الرسالة في pending_messages:', insertError);
            } else {
                console.log(`✅ تم حفظ الرسالة في pending_messages (${msg.id})`);
            }

            return { success: true };
        } catch (e) {
            console.error('❌ فشل إرسال الرسالة:', e);
            return { success: false, error: e.message };
        }
    };

    window.sendTypingEvent = function(chatId, isTyping) {
        if (!isOnline || !chatId) return;
        const channel = activeChannels[chatId];
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: {
                    userId: getCurrentUserId(),
                    isTyping: isTyping || false
                }
            }).catch(() => {});
        }
    };

    window.sendReadReceipt = function(chatId, messageId) {
        if (!isOnline || !chatId) return;
        const channel = activeChannels[chatId];
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'read_receipt',
                payload: {
                    messageId: messageId,
                    readerId: getCurrentUserId()
                }
            }).catch(() => {});
        }
    };

    // ======================================================================
    // 5. الرسائل المعلقة (Pending Messages) – تخزين مؤقت 10 أيام
    // ======================================================================

    window.fetchPendingMessages = async function(chatId) {
        const client = ensureSupabase();
        if (!client || !isOnline) {
            console.warn('⚠️ لا يمكن جلب الرسائل المعلقة: غير متصل');
            return;
        }
        const userId = getCurrentUserId();
        if (!userId) {
            console.warn('⚠️ لا يمكن جلب الرسائل المعلقة: المستخدم غير مسجل');
            return;
        }

        try {
            console.log(`📥 جلب الرسائل المعلقة للمحادثة ${chatId} (المستخدم: ${userId})`);
            const { data, error } = await client
                .from('pending_messages')
                .select('*')
                .eq('recipient_chat_id', chatId)
                .neq('sender_id', userId)
                .gt('expires_at', new Date().toISOString());

            if (error) {
                console.warn('⚠️ فشل جلب الرسائل المعلقة:', error);
                return;
            }
            if (!data || !data.length) {
                console.log(`ℹ️ لا توجد رسائل معلقة للمحادثة ${chatId}`);
                return;
            }

            console.log(`📥 جلب ${data.length} رسالة معلقة للمحادثة ${chatId}`);

            for (const record of data) {
                try {
                    const msg = record.payload;
                    msg.sync_status = 'delivered';
                    msg.status = 'delivered';
                    msg.chat_id = chatId;

                    // إضافة الرسالة إلى التخزين المحلي (عبر common.js)
                    if (typeof window.addMessage === 'function') {
                        window.addMessage(msg);
                        console.log(`✅ تمت إضافة الرسالة ${msg.id} إلى التخزين المحلي`);
                    } else {
                        console.warn('⚠️ window.addMessage غير متوفرة');
                    }

                    // حذف الرسالة من pending_messages بعد استلامها
                    const { error: deleteError } = await client
                        .from('pending_messages')
                        .delete()
                        .eq('message_id', record.message_id);
                    if (deleteError) {
                        console.warn('⚠️ فشل حذف الرسالة المعلقة:', deleteError);
                    } else {
                        console.log(`✅ تم حذف الرسالة المعلقة ${record.message_id}`);
                    }
                } catch (e) {
                    console.warn('⚠️ خطأ في معالجة رسالة معلقة:', e);
                }
            }

            // تحديث الواجهة (يتم عبر common.js)
            if (typeof window.renderMessages === 'function') window.renderMessages();
            if (typeof window.renderChats === 'function') window.renderChats();

        } catch (e) {
            console.warn('⚠️ فشل جلب الرسائل المعلقة:', e);
        }
    };

    window.fetchAllPendingMessages = async function() {
        const client = ensureSupabase();
        if (!client || !isOnline) return [];
        const userId = getCurrentUserId();
        if (!userId) return [];

        try {
            console.log(`📥 جلب جميع الرسائل المعلقة للمستخدم ${userId}`);
            const { data, error } = await client
                .from('pending_messages')
                .select('*')
                .neq('sender_id', userId)
                .gt('expires_at', new Date().toISOString());

            if (error) {
                console.warn('⚠️ فشل جلب جميع الرسائل المعلقة:', error);
                return [];
            }
            if (!data || !data.length) {
                console.log('ℹ️ لا توجد رسائل معلقة');
                return [];
            }

            console.log(`📥 جلب ${data.length} رسالة معلقة`);

            // تجميع الرسائل حسب المحادثة
            const grouped = {};
            for (const record of data) {
                const chatId = record.recipient_chat_id;
                if (!grouped[chatId]) grouped[chatId] = [];
                grouped[chatId].push(record.payload);
            }

            // معالجة كل محادثة
            for (const [chatId, msgs] of Object.entries(grouped)) {
                for (const msg of msgs) {
                    msg.sync_status = 'delivered';
                    msg.status = 'delivered';
                    msg.chat_id = chatId;
                    if (typeof window.addMessage === 'function') {
                        window.addMessage(msg);
                    }
                }
                // حذف الرسائل المعالجة
                const msgIds = msgs.map(m => m.id);
                await client
                    .from('pending_messages')
                    .delete()
                    .in('message_id', msgIds);
            }

            return data.map(r => r.payload);
        } catch (e) {
            console.warn('⚠️ فشل جلب جميع الرسائل المعلقة:', e);
            return [];
        }
    };

    // ======================================================================
    // 6. إدارة الحالة (Online / Offline)
    // ======================================================================

    window.setUserOnlineStatus = function(status) {
        const client = ensureSupabase();
        if (!client) return;
        const userId = getCurrentUserId();
        if (!userId) return;
        client
            .from('users')
            .update({ is_online: status, last_seen: new Date().toISOString() })
            .eq('id', userId)
            .catch(() => {});
    };

    // ======================================================================
    // 7. دوال الدعوة (Invite)
    // ======================================================================

    window.getInviteCode = async function() {
        const client = ensureSupabase();
        if (!client) return null;
        const userId = getCurrentUserId();
        if (!userId) return null;
        try {
            const { data, error } = await client
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
        return window.location.origin + '/redirect.html?ref=' + code;
    };

    // ======================================================================
    // 8. تحديث المفتاح العام
    // ======================================================================

    window.updateUserPublicKey = async function(publicKey) {
        const client = ensureSupabase();
        if (!client) throw new Error('Supabase غير متاح');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        const { error } = await client
            .from('users')
            .update({ public_key: publicKey })
            .eq('id', userId);
        if (error) throw error;
        const user = getCurrentUser();
        if (user) {
            user.public_key = publicKey;
            localStorage.setItem('ramzapp_user', JSON.stringify(user));
        }
        return true;
    };

    // ======================================================================
    // 9. مستمعي أحداث الشبكة
    // ======================================================================

    window.addEventListener('online', async () => {
        isOnline = true;
        console.log('🟢 عودة الاتصال بالإنترنت');
        if (!supabase) {
            const retry = await initSupabase();
            if (retry) {
                isInitialized = true;
                window.supabaseClient = supabase;
            }
        }
        if (supabase) {
            window.setUserOnlineStatus(true);
            setTimeout(() => window.fetchAllPendingMessages(), 1000);
        }
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        console.log('🔴 انقطع الاتصال بالإنترنت');
        if (supabase) {
            window.setUserOnlineStatus(false);
        }
    });

    // ======================================================================
    // 10. التنظيف الدوري للرسائل المنتهية (يتم عبر Trigger في SQL)
    // ولكن يمكن استدعاء دالة تنظيف هنا كاحتياطي
    // ======================================================================

    async function cleanupExpiredPendingMessages() {
        const client = ensureSupabase();
        if (!client || !isOnline) return;
        try {
            await client
                .from('pending_messages')
                .delete()
                .lt('expires_at', new Date().toISOString());
        } catch (e) { /* تجاهل */ }
    }

    // تنظيف كل ساعة
    setInterval(cleanupExpiredPendingMessages, 3600000);

    // ======================================================================
    // 11. حالة الاتصال بالوسيط
    // ======================================================================

    window.isSupabaseOnline = () => isOnline && supabase !== null;
    window.getSupabaseInstance = () => supabase;

    // ======================================================================
    // رسالة الإتمام
    // ======================================================================

    console.log('✅ supabase.js (الإصدار النهائي v5.7) جاهز');
    console.log('🔗 متصل بـ:', SUPABASE_URL);
    console.log('📡 الوضع: ' + (isOnline ? '🟢 متصل' : '🔴 غير متصل'));

    if (!supabase) {
        console.warn('⚠️ Supabase غير متاح حالياً، سيتم إعادة المحاولة عند الاتصال.');
    }

})();
