// supabase.js - وسيط Supabase المتكامل (نسخة نهائية حقيقية)
// يدير المصادقة، المزامنة الفورية (Realtime)، استعلامات قاعدة البيانات، وإدارة الحالة
(async function() {
    // ================== التكوين ==================
    // ⚠️ تحذير أمني: في الإنتاج الفعلي، يجب نقل هذه المفاتيح إلى متغيرات بيئة (Environment Variables)
    // واستخدام خدمة وسيطة (Backend Proxy) بدلاً من كشفها في الكود الأمامي.
    const SUPABASE_URL = 'https://serlegwdzjulfcxabxzv.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_4_c97KxnG_7HTvfv-pKeNQ_FTlnK6Yx';

    // استيراد المكتبة
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabase;

    let isOnline = navigator.onLine;
    let activeChannels = {}; // تخزين القنوات النشطة

    // ================== مستمعات حالة الشبكة ==================
    window.addEventListener('online', () => {
        isOnline = true;
        window.dispatchEvent(new Event('ramzapp:online'));
        updatePresence(true);
        if (window.syncAllPendingMessages) window.syncAllPendingMessages();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        window.dispatchEvent(new Event('ramzapp:offline'));
        updatePresence(false);
    });

    // ================== دوال مساعدة ==================
    function getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
        return user?.id || null;
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('ramzapp_user') || 'null');
    }

    // ================== 1. دوال المصادقة (Auth) ==================
    
    // تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
    window.signInWithEmail = async function(email, password) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    };

    // التسجيل بحساب جديد بالبريد الإلكتروني
    window.signUpWithEmail = async function(email, password, name) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name: name || 'مستخدم' } }
        });
        if (error) throw error;
        // إنشاء سجل في جدول users
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

    // تسجيل الدخول برقم الهاتف (أو إنشاء حساب إذا لم يكن موجوداً)
    window.signInWithPhone = async function(phoneNumber, name) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        // تنظيف الرقم
        const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // البحث عن مستخدم بهذا الرقم
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
            // إنشاء مستخدم جديد
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

        // تحديث حالة الاتصال
        await supabase.from('users').update({ 
            is_online: true, 
            last_seen: new Date().toISOString() 
        }).eq('id', user.id);

        return user;
    };

    // تسجيل الدخول كضيف (Guest)
    window.signInAsGuest = async function() {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        
        const guestId = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
        const guestEmail = `guest_${guestId}@ramzapp.local`;
        const guestPassword = 'Guest@' + guestId;

        // محاولة تسجيل الدخول أولاً (في حال كان الحساب موجوداً)
        let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: guestEmail,
            password: guestPassword
        });

        let user;
        if (signInError) {
            // إنشاء حساب جديد
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: guestEmail,
                password: guestPassword,
                options: { data: { name: 'زائر' } }
            });
            if (signUpError) throw signUpError;
            user = signUpData.user;
            // إنشاء سجل في جدول users
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
            // تحديث حالة الاتصال
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
        if (userId) {
            await supabase.from('users').update({ 
                is_online: false, 
                last_seen: new Date().toISOString() 
            }).eq('id', userId);
        }
        await supabase.auth.signOut();
        localStorage.removeItem('ramzapp_user');
    };

    // التحقق من الجلسة الحالية
    window.getCurrentSession = async function() {
        const { data } = await supabase.auth.getSession();
        return data.session;
    };

    // ================== 2. دوال المزامنة الفورية (Realtime) ==================

    // الاشتراك في محادثة معينة
    window.subscribeToChat = function(chatId, onMessage, onTyping) {
        if (!chatId) return null;
        
        // إلغاء الاشتراك السابق إن وجد
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

        // استماع للرسائل الجديدة
        channel.on('broadcast', { event: 'new_message' }, (payload) => {
            if (!isOnline) return;
            const msg = {
                ...payload.payload,
                chat_id: chatId,
                sync_status: 'delivered',
                status: 'delivered'
            };
            // إرسال إشارة "قراءة" تلقائياً للرسائل الواردة
            if (msg.sender_id !== userId) {
                markMessagesAsRead(chatId, [msg.id]);
            }
            onMessage?.(msg);
        });

        // استماع لحالة "يكتب الآن..."
        channel.on('broadcast', { event: 'typing' }, (payload) => {
            if (!isOnline) return;
            const { userId: senderId, isTyping } = payload.payload;
            if (senderId !== userId) {
                onTyping?.(senderId, isTyping);
            }
        });

        // الاشتراك في القناة
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                activeChannels[chatId] = channel;
                // جلب الرسائل المعلقة عند الاشتراك
                await fetchPendingMessages(chatId);
            }
        });

        return channel;
    };

    // إلغاء الاشتراك من محادثة
    window.unsubscribeFromChat = function(chatId) {
        if (activeChannels[chatId]) {
            supabase.removeChannel(activeChannels[chatId]);
            delete activeChannels[chatId];
            return true;
        }
        return false;
    };

    // إرسال رسالة عبر Realtime
    window.sendMessageRealtime = async function(message) {
        if (!isOnline) return { success: false, offline: true };
        
        const chatId = message.chat_id || message.sid;
        let channel = activeChannels[chatId];
        
        // إذا لم تكن القناة موجودة، نقوم بإنشائها
        if (!channel) {
            channel = supabase.channel(`chat:${chatId}`, {
                config: { broadcast: { self: false } }
            });
            await channel.subscribe();
            activeChannels[chatId] = channel;
        }

        try {
            // بث الرسالة إلى جميع المشتركين
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

            // تخزين الرسالة في جدول الرسائل المعلقة (لضمان وصولها لمن هم غير متصلين)
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

    // إرسال حدث "يكتب الآن..."
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

    // جلب الرسائل المعلقة من الخادم
    async function fetchPendingMessages(chatId) {
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
                // تعليمها كمقروءة
                if (readIds.length > 0) {
                    await markMessagesAsRead(chatId, readIds);
                }
                // حذفها من الجدول بعد استلامها
                await supabase.from('pending_messages').delete().in('message_id', data.map(r => r.message_id));
            }
        } catch (e) {}
    }

    // ================== 3. دوال جلب البيانات (Queries) ==================

    // جلب جميع المحادثات الخاصة بالمستخدم
    window.fetchUserChats = async function(userId) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('user_id', userId)
            .order('last_time', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    // جلب رسائل محادثة معينة
    window.fetchMessages = async function(chatId, limit = 100) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
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
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data || [];
    };

    // جلب جميع المستخدمين المسجلين (للمزامنة مع جهات الاتصال)
    window.fetchAllRegisteredUsers = async function() {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase
            .from('users')
            .select('id, name, avatar, phone, email')
            .order('name');
        if (error) throw error;
        return data || [];
    };

    // التحقق من الأرقام المسجلة في التطبيق (استعلام مباشر)
    window.checkRegisteredPhones = async function(phones) {
        if (!isOnline || !phones?.length) {
            return { registered: [], unregistered: phones || [] };
        }

        try {
            // استعلام مباشر على جدول users للتحقق من الأرقام
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
        const userId = getCurrentUserId();
        if (!userId || !isOnline) return [];

        try {
            const { data, error } = await supabase
                .from('pending_messages')
                .select('*')
                .neq('sender_id', userId)
                .gt('expires_at', new Date().toISOString());

            if (error) throw error;

            // حذفها بعد جلبها
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

    // ================== 4. دوال التحديث (Updates) ==================

    // تحديث حالة الاتصال للمستخدم
    window.setUserOnlineStatus = function(status) {
        updatePresence(status);
    };

    function updatePresence(online) {
        const userId = getCurrentUserId();
        if (!userId) return;
        supabase.from('users')
            .update({ 
                is_online: online, 
                last_seen: new Date().toISOString() 
            })
            .eq('id', userId)
            .catch(() => {});
    }

    // تعليم الرسائل كمقروءة
    window.markMessagesAsRead = async function(chatId, messageIds) {
        if (!isOnline || !messageIds?.length) return;
        try {
            await supabase
                .from('messages')
                .update({ status: 'read', read_at: new Date().toISOString() })
                .in('id', messageIds);
        } catch (e) {
            // تجاهل الأخطاء لأنها غير حرجة
        }
    };

    // ================== 5. دوال الدعوة ==================

    // الحصول على كود الدعوة للمستخدم
    window.getInviteCode = async function() {
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

    // إنشاء رابط الدعوة
    window.createInviteLink = function(code) {
        return `${window.location.origin}/login.html?ref=${code}`;
    };

    // ================== 6. دوال إدارة الحساب ==================

    // تحديث بيانات المستخدم
    window.updateUserProfile = async function(updates) {
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
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        await supabase.from('users').delete().eq('id', userId);
        await supabase.auth.signOut();
        localStorage.removeItem('ramzapp_user');
    };

    // ================== 7. دوال إدارة القنوات (Channels) ==================

    // جلب القنوات المتاحة
    window.fetchChannels = async function() {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .order('followers', { ascending: false });
        if (error) throw error;
        return data || [];
    };

    // الاشتراك في قناة
    window.subscribeToChannel = async function(channelId) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        const { error } = await supabase
            .from('channel_subscribers')
            .upsert({ channel_id: channelId, user_id: userId });
        if (error) throw error;
        // زيادة عدد المتابعين
        await supabase.rpc('increment_channel_followers', { channel_id: channelId });
        return true;
    };

    // ================== 8. دوال الوسائط (Media) ==================

    // رفع ملف إلى Supabase Storage
    window.uploadMedia = async function(file, path) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const userId = getCurrentUserId();
        if (!userId) throw new Error('المستخدم غير مسجل');
        
        const filePath = `users/${userId}/${path || file.name}`;
        const { data, error } = await supabase.storage
            .from('media')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        // الحصول على الرابط العام
        const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
        return urlData.publicUrl;
    };

    // حذف ملف من Supabase Storage
    window.deleteMedia = async function(path) {
        if (!isOnline) throw new Error('📡 لا يوجد اتصال بالإنترنت');
        const { error } = await supabase.storage
            .from('media')
            .remove([path]);
        if (error) throw error;
        return true;
    };

    // ================== 9. إدارة الأحداث العامة ==================

    // تعيين دالة استقبال الرسائل (للاتصال من common.js)
    window._onMessageCallback = null;
    window.setOnMessageCallback = function(callback) {
        window._onMessageCallback = callback;
    };

    // ================== 10. التنظيف الدوري ==================

    // تنظيف الرسائل المنتهية الصلاحية كل ساعة
    setInterval(async () => {
        if (!isOnline) return;
        try {
            await supabase
                .from('pending_messages')
                .delete()
                .lt('expires_at', new Date().toISOString());
        } catch (e) {
            // تجاهل
        }
    }, 3600000); // كل ساعة

    // تحديث حالة "متصل" كل 30 ثانية
    setInterval(() => {
        if (isOnline) updatePresence(true);
    }, 30000);

    console.log('✅ supabase.js (نسخة نهائية حقيقية) جاهز');
    console.log('🔗 متصل بـ:', SUPABASE_URL);

    // ================== تصدير الدوال كاملة ==================
    // جميع الدوال معرفة على window بالفعل، لكن نضمن وضوحها
    window.isSupabaseOnline = () => isOnline;

})();
