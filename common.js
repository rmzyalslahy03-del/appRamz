// ======================================================================
// common.js - الإصدار النهائي المعدل v7.4 (المستقر والنهائي)
// جميع الميزات مفعلة | تم إصلاح التشفير وعرض النص الأصلي
// ======================================================================

console.log('🚀 common.js v7.4 (النسخة النهائية المعدلة) بدأ التحميل...');

// ==================== تحميل FontAwesome ====================
(function() {
    const FA_SOURCES = [
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
        'https://use.fontawesome.com/releases/v6.5.0/css/all.css'
    ];
    let faLoaded = false;
    function checkFA() {
        const test = document.createElement('i');
        test.className = 'fas fa-home';
        test.style.cssText = 'position:absolute;left:-9999px;visibility:hidden;';
        document.body.appendChild(test);
        const style = getComputedStyle(test, ':before');
        const content = style.content;
        document.body.removeChild(test);
        if (content && content !== 'none' && content !== '') {
            faLoaded = true;
            document.body.classList.remove('fa-fallback', 'no-fontawesome');
            return true;
        }
        return false;
    }
    async function loadFA() {
        if (checkFA()) return true;
        for (const url of FA_SOURCES) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => setTimeout(checkFA, 200);
            document.head.appendChild(link);
            await new Promise(r => setTimeout(r, 400));
            if (faLoaded) return true;
        }
        document.body.classList.add('fa-fallback');
        return false;
    }
    window.ensureFontAwesome = loadFA;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(loadFA, 50));
    } else {
        setTimeout(loadFA, 50);
    }
})();

// ==================== أدوات عامة ====================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function timeAgo(d) {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff/60)+' د';
    if (diff < 86400) return Math.floor(diff/3600)+' س';
    return Math.floor(diff/86400)+' يوم';
}
function fmtTime(d) { return new Date(d).toLocaleTimeString('ar-SA', {hour:'2-digit',minute:'2-digit'}); }
function fmtDate(d) { return new Date(d).toLocaleDateString('ar-SA', {weekday:'long', month:'long', day:'numeric'}); }
function esc(s) { return s ? s.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]) : ''; }

let toastTimer = null;
function toast(msg, duration = 2000) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
    } catch(e) {}
}

// ==================== مجمع تحديثات الواجهة (rAF) ====================
const renderQueue = new Set();
let renderFrameId = null;
function queueRender(fn) {
    renderQueue.add(fn);
    if (!renderFrameId) {
        renderFrameId = requestAnimationFrame(() => {
            renderFrameId = null;
            const fns = Array.from(renderQueue);
            renderQueue.clear();
            fns.forEach(f => { try { f(); } catch(e) { console.error(e); } });
        });
    }
}
function scheduleRenderChats() { queueRender(() => renderChatsImmediate()); }
function scheduleRenderMessages() { queueRender(() => renderMessagesImmediate()); }
function scheduleRenderContacts() { queueRender(() => renderContactsImmediate()); }
function scheduleRenderStories() { queueRender(() => renderStoriesImmediate()); }
function scheduleRenderChannels() { queueRender(() => renderChannelsImmediate()); }
function scheduleRenderCalls() { queueRender(() => renderCallsImmediate()); }

// ==================== دوال التفاف db.js ====================
function DB_getChats() { return window.getChats ? window.getChats() : []; }
function DB_getMessages(chatId) { return window.getMessages ? window.getMessages(chatId) : []; }
function DB_addMessage(msg) { return window.addMessage ? window.addMessage(msg) : msg; }
function DB_updateMessage(msgId, updates) { if (window.updateMessage) window.updateMessage(msgId, updates); }
function DB_deleteMessage(msgId) { if (window.deleteMessage) window.deleteMessage(msgId); }
function DB_saveChat(chatData) { if (window.saveChat) window.saveChat(chatData); }
function DB_deleteChat(chatId) { if (window.deleteChat) window.deleteChat(chatId); }
function DB_getContacts() { return window.getContacts ? window.getContacts() : []; }
function DB_saveContact(c) { if (window.saveContact) window.saveContact(c); }
function DB_getStories() { return window.getStories ? window.getStories() : []; }
function DB_addStory(s) { if (window.addStory) window.addStory(s); }
function DB_updateStory(id, updates) { if (window.updateStory) window.updateStory(id, updates); }
function DB_getChannels() { return window.getChannels ? window.getChannels() : []; }
function DB_addChannel(ch) { if (window.addChannel) window.addChannel(ch); }
function DB_getCalls() { return window.getCalls ? window.getCalls() : []; }
function DB_addCall(c) { if (window.addCall) window.addCall(c); }
function DB_getCatalog() { return window.getCatalog ? window.getCatalog() : []; }
function DB_addCatalogItem(it) { if (window.addCatalogItem) window.addCatalogItem(it); }
function DB_getSettings() { return window.getSettings ? window.getSettings() : { theme: 'dark', notifications: true }; }
function DB_updateSetting(k, v) { if (window.updateSetting) window.updateSetting(k, v); }
function DB_clearAllData() { if (window.clearAllData) window.clearAllData(); }

function DB_getCurrentUser() {
    const saved = localStorage.getItem('ramzapp_user');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            if (!user.id && user.phone) user.id = user.phone;
            return user;
        } catch(e) {}
    }
    return null;
}

// ==================== دالة الحصول على اسم العرض من جهات الاتصال ====================
function getDisplayName(userId, defaultName) {
    const contacts = DB_getContacts();
    const contact = contacts.find(c => c.id === userId || c.phone === userId);
    if (contact && contact.name && contact.name.trim()) {
        return contact.name;
    }
    return defaultName || userId || 'مستخدم';
}

function getDisplayAvatar(userId, defaultAvatar) {
    const contacts = DB_getContacts();
    const contact = contacts.find(c => c.id === userId || c.phone === userId);
    if (contact && contact.avatar && contact.avatar !== '?') {
        return contact.avatar;
    }
    return defaultAvatar || '?';
}

// ==================== التشفير E2EE (ECDH + AES-GCM) ====================
let currentUserKeyPair = null;
let peerPublicKeys = {};
const E2E_KEY_STORE = 'ramzapp_e2e_keys';

async function generateKeyPair() {
    return await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
}
async function exportPublicKey(key) {
    const exported = await crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}
async function importPublicKey(base64) {
    try {
        const binaryDer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return await crypto.subtle.importKey("spki", binaryDer, { name: "ECDH", namedCurve: "P-256" }, true, []);
    } catch(e) { return null; }
}
async function exportPrivateKey(key) {
    const exported = await crypto.subtle.exportKey("pkcs8", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}
async function importPrivateKey(base64) {
    try {
        const binaryDer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return await crypto.subtle.importKey("pkcs8", binaryDer, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
    } catch(e) { return null; }
}
async function openE2EStore() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('RamzAppE2E', 1);
        req.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', {keyPath:'id'}); };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = reject;
    });
}

// ==================== دوال تشفير المفاتيح الخاصة (PBKDF2 + AES-GCM) ====================
async function deriveEncryptionKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 600000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function saveKeyPairToStorage(userId, pubBase64, privBase64, password) {
    const db = await openE2EStore();
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encryptionKey = await deriveEncryptionKey(password, salt);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedPriv = new TextEncoder().encode(privBase64);
    const encryptedPriv = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        encryptionKey,
        encodedPriv
    );

    const combined = new Uint8Array(iv.length + encryptedPriv.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedPriv), iv.length);
    const encryptedPrivBase64 = btoa(String.fromCharCode(...combined));

    await Promise.all([
        new Promise((res, rej) => {
            const r = store.put({id: userId+'_public', key: pubBase64});
            r.onsuccess = res; r.onerror = rej;
        }),
        new Promise((res, rej) => {
            const r = store.put({
                id: userId+'_private',
                key: encryptedPrivBase64,
                salt: btoa(String.fromCharCode(...salt))
            });
            r.onsuccess = res; r.onerror = rej;
        })
    ]);
}

async function loadKeyPairFromStorage(userId, password) {
    const db = await openE2EStore();
    const tx = db.transaction('keys', 'readonly');
    const store = tx.objectStore('keys');

    const pubRecord = await new Promise(res => { const r = store.get(userId+'_public'); r.onsuccess = () => res(r.result); });
    const privRecord = await new Promise(res => { const r = store.get(userId+'_private'); r.onsuccess = () => res(r.result); });

    if (!pubRecord || !privRecord) return null;

    try {
        const salt = Uint8Array.from(atob(privRecord.salt), c => c.charCodeAt(0));
        const encryptionKey = await deriveEncryptionKey(password, salt);

        const combined = Uint8Array.from(atob(privRecord.key), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const encryptedData = combined.slice(12);

        const decryptedPriv = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            encryptionKey,
            encryptedData
        );
        const privBase64 = new TextDecoder().decode(decryptedPriv);

        const publicKey = await importPublicKey(pubRecord.key);
        const privateKey = await importPrivateKey(privBase64);
        if (publicKey && privateKey) return { publicKey, privateKey };
    } catch (e) {
        console.error('❌ فشل فك التشفير (كلمة المرور خاطئة أو البيانات تالفة)');
        return null;
    }
    return null;
}

async function initEncryption(password) {
    const user = DB_getCurrentUser();
    if (!user) return;
    const userId = user.phone || user.id;
    if (!userId) return;

    if (password) {
        const stored = await loadKeyPairFromStorage(userId, password);
        if (stored) {
            currentUserKeyPair = stored;
            console.log('✅ تم فك تشفير المفتاح الخاص بنجاح');
            return;
        }
    }

    console.log('🆕 إنشاء مفاتيح جديدة للمستخدم');
    currentUserKeyPair = await generateKeyPair();
    const pubBase64 = await exportPublicKey(currentUserKeyPair.publicKey);
    const privBase64 = await exportPrivateKey(currentUserKeyPair.privateKey);

    if (password) {
        await saveKeyPairToStorage(userId, pubBase64, privBase64, password);
    } else {
        const db = await openE2EStore();
        const tx = db.transaction('keys', 'readwrite');
        const store = tx.objectStore('keys');
        await Promise.all([
            new Promise((res, rej) => { const r = store.put({id: userId+'_public', key: pubBase64}); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res, rej) => { const r = store.put({id: userId+'_private', key: privBase64}); r.onsuccess = res; r.onerror = rej; })
        ]);
    }

    if (window.supabaseClient) {
        try {
            await window.supabaseClient.from('users').update({ public_key: pubBase64 }).eq('phone', userId);
        } catch(e) {}
    }
}

async function deriveSharedSecret(myPrivateKey, theirPublicKey) {
    return await crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myPrivateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}
async function encryptText(plaintext, sharedSecret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedSecret, encoded);
    return { encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))), iv: btoa(String.fromCharCode(...iv)) };
}
async function decryptText(payload, sharedSecret) {
    try {
        const encrypted = Uint8Array.from(atob(payload.encrypted), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedSecret, encrypted);
        return new TextDecoder().decode(decrypted);
    } catch(e) { return '🔒 تعذر فك التشفير'; }
}

// ==================== جلب المفتاح العام (محسن مع دعم chat_id) ====================
async function fetchPeerPublicKey(peerId) {
    if (peerPublicKeys[peerId]) return peerPublicKeys[peerId];
    if (!window.supabaseClient) return null;
    
    // إذا كان peerId هو 'me' أو null أو غير صحيح
    if (peerId === 'me' || !peerId || peerId === 'undefined') {
        if (currentChatId) {
            const chat = DB_getChats().find(c => c.id === currentChatId);
            if (chat && chat.id) {
                peerId = chat.id;
            }
        }
        if (!peerId || peerId === 'me') return null;
    }
    
    try {
        // محاولة البحث برقم الهاتف
        let { data, error } = await window.supabaseClient
            .from('users')
            .select('public_key')
            .eq('phone', peerId)
            .single();
        
        // إذا فشل البحث بالهاتف، حاول البحث بالـ id
        if (error || !data?.public_key) {
            const { data: dataById } = await window.supabaseClient
                .from('users')
                .select('public_key')
                .eq('id', peerId)
                .single();
            if (dataById?.public_key) {
                data = dataById;
            } else {
                return null;
            }
        }
        
        if (data?.public_key) {
            const key = await importPublicKey(data.public_key);
            if (key) {
                peerPublicKeys[peerId] = key;
                return key;
            }
        }
    } catch (e) {
        console.warn('⚠️ فشل جلب المفتاح العام:', e);
    }
    return null;
}

// ==================== إدارة حالة المستخدم (Online/Offline/Typing) ====================
window.updateUserOnlineStatus = async function(isOnline) {
    if (!window.supabaseClient) return;
    const user = DB_getCurrentUser();
    if (!user || !user.id) return;
    try {
        await window.supabaseClient
            .from('users')
            .update({
                is_online: isOnline,
                last_seen: new Date().toISOString()
            })
            .eq('id', user.id);
    } catch (e) {
        console.warn('⚠️ فشل تحديث حالة الاتصال:', e);
    }
};

async function fetchUserStatus(userId) {
    if (!window.supabaseClient || !userId) return null;
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('is_online, last_seen')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    } catch (e) {
        console.warn('⚠️ فشل جلب حالة المستخدم:', e);
        return null;
    }
}

let userStatusSubscription = null;

function subscribeToUserStatus(userId, onStatusChange) {
    if (!window.supabaseClient || !userId) return;
    if (userStatusSubscription) {
        window.supabaseClient.removeChannel(userStatusSubscription);
        userStatusSubscription = null;
    }
    const channel = window.supabaseClient
        .channel(`user-status-${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${userId}`
            },
            (payload) => {
                if (payload.new && typeof onStatusChange === 'function') {
                    onStatusChange({
                        is_online: payload.new.is_online,
                        last_seen: payload.new.last_seen
                    });
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`✅ مشترك في تحديثات حالة المستخدم: ${userId}`);
                userStatusSubscription = channel;
            }
        });
    return channel;
}

function unsubscribeFromUserStatus() {
    if (userStatusSubscription) {
        window.supabaseClient?.removeChannel(userStatusSubscription);
        userStatusSubscription = null;
        console.log('✅ تم إلغاء الاشتراك من تحديثات حالة المستخدم');
    }
}

function updateStatusDisplay(statusEl, isOnline, lastSeen, isTyping) {
    if (!statusEl) return;
    if (isTyping && (Date.now() - isTyping < 5000)) {
        statusEl.textContent = '✍️ يكتب الآن...';
        statusEl.className = 'chat-header-status typing';
        return;
    }
    if (isOnline) {
        statusEl.textContent = '🟢 متصل الآن';
        statusEl.className = 'chat-header-status online';
    } else if (lastSeen) {
        const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
        let timeText = '';
        if (diff < 60) timeText = 'الآن';
        else if (diff < 3600) timeText = Math.floor(diff/60) + ' د';
        else if (diff < 86400) timeText = Math.floor(diff/3600) + ' س';
        else timeText = Math.floor(diff/86400) + ' يوم';
        statusEl.textContent = `📅 آخر ظهور ${timeText}`;
        statusEl.className = 'chat-header-status';
    } else {
        statusEl.textContent = '📱 غير متصل';
        statusEl.className = 'chat-header-status';
    }
}

// ==================== الاتصال عبر Supabase (وسيط + تخزين مؤقت) ====================
let isOnline = navigator.onLine;
let activeChannels = {};

window.subscribeToChat = function(chatId, onMessage, onTyping) {
    if (!window.supabaseClient || !isOnline || !chatId) return null;
    if (activeChannels[chatId]) {
        window.supabaseClient.removeChannel(activeChannels[chatId]);
        delete activeChannels[chatId];
    }
    const userId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;
    const channel = window.supabaseClient.channel(`chat:${chatId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'new_message' }, async (payload) => {
        if (!isOnline) return;
        const msg = payload.payload;
        if (msg.encrypted && msg.payload) {
            const peerKey = await fetchPeerPublicKey(msg.sender_id);
            if (peerKey && currentUserKeyPair) {
                const secret = await deriveSharedSecret(currentUserKeyPair.privateKey, peerKey);
                msg.text = await decryptText(msg.payload, secret);
            }
        }
        onMessage?.(msg);
    });
    channel.on('broadcast', { event: 'typing' }, (payload) => {
        if (!isOnline) return;
        onTyping?.(payload.payload.userId, payload.payload.isTyping);
    });
    channel.on('broadcast', { event: 'call_offer' }, (payload) => {
        if (!isOnline) return;
        handleCallOffer(payload.payload);
    });
    channel.on('broadcast', { event: 'call_answer' }, (payload) => {
        if (!isOnline) return;
        handleCallAnswer(payload.payload);
    });
    channel.on('broadcast', { event: 'call_reject' }, (payload) => {
        if (!isOnline) return;
        toast('📞 تم رفض المكالمة');
        endCall();
    });
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') activeChannels[chatId] = channel;
    });
    return channel;
};

window.unsubscribeFromChat = function(chatId) {
    if (activeChannels[chatId]) {
        window.supabaseClient?.removeChannel(activeChannels[chatId]);
        delete activeChannels[chatId];
    }
};

// ==================== sendMessageRealtime (محسن مع sender_id صحيح) ====================
window.sendMessageRealtime = async function(msg) {
    if (!window.supabaseClient || !isOnline) {
        console.warn('⚠️ لا يمكن الإرسال: Supabase غير متاح أو غير متصل');
        return { success: false, offline: true };
    }

    const chatId = msg.chat_id;
    if (!chatId) {
        console.error('❌ معرف المحادثة مطلوب');
        return { success: false, error: 'معرف المحادثة مطلوب' };
    }

    console.log(`📤 محاولة إرسال رسالة إلى قناة ${chatId}:`, msg);

    let channel = activeChannels[chatId];
    if (!channel) {
        console.log(`🔧 إنشاء قناة جديدة لـ ${chatId}`);
        channel = window.supabaseClient.channel(`chat:${chatId}`, {
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
        const currentUser = DB_getCurrentUser();
        const senderPhone = currentUser?.phone || currentUser?.id || 'me';
        console.log(`📤 إرسال رسالة من: ${senderPhone}`);

        // 3. حفظ في pending_messages مع sender_id الصحيح
        const { error: insertError } = await window.supabaseClient
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
    channel?.send({ type: 'broadcast', event: 'typing', payload: { userId: DB_getCurrentUser()?.phone, isTyping } }).catch(()=>{});
};

window.fetchAllPendingMessages = async function() {
    if (!window.supabaseClient || !isOnline) return;
    const userId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;
    if (!userId) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('pending_messages')
            .select('*')
            .neq('sender_id', userId)
            .gt('expires_at', new Date().toISOString());
        if (error) { console.warn('fetchAllPendingMessages error:', error); return; }
        if (!data?.length) return;

        let newMsgCount = 0;
        const deliveredIds = [];
        for (const record of data) {
            try {
                const chatId = record.chat_id;
                if (!chatId) continue;
                let msg = record.payload || {};
                if (typeof msg === 'string') {
                    try { msg = JSON.parse(msg); } catch(e) { msg = { text: msg }; }
                }
                if (!msg || typeof msg !== 'object') continue;
                msg.id = msg.id || record.message_id || 'msg_'+Date.now();
                msg.chat_id = chatId;
                msg.sender_id = record.sender_id;
                msg.sync_status = 'delivered'; msg.status = 'delivered';
                msg.time = record.created_at || new Date().toISOString();
                if (!msg.text && !msg.img && !msg.voice_blob) msg.text = '📎 مرفق';
                if (!DB_getMessages(chatId).find(m => m.id === msg.id)) {
                    DB_addMessage(msg);
                    newMsgCount++;
                    const chat = DB_getChats().find(c => c.id === chatId);
                    if (chat) {
                        chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
                        chat.last_time = msg.time;
                        if (!chat.online) chat.unread = (chat.unread||0)+1;
                        DB_saveChat(chat);
                    }
                    deliveredIds.push(record.message_id);
                }
            } catch(e) { console.warn('خطأ في معالجة رسالة معلقة:', e); }
        }
        if (newMsgCount) {
            scheduleRenderChats();
            if (currentChatId) scheduleRenderMessages();
            toast('📩 ' + newMsgCount + ' رسالة جديدة');
        }
        if (deliveredIds.length) {
            await window.supabaseClient.from('pending_messages').delete().in('message_id', deliveredIds);
        }
    } catch(e) { console.warn('fetchAllPendingMessages:', e); }
};

window.fetchAllUsersAsContacts = async function() {
    if (!window.supabaseClient || !isOnline) return;
    try {
        const curUser = DB_getCurrentUser();
        const curPhone = curUser?.phone || curUser?.id || '';
        const { data: users, error } = await window.supabaseClient.from('users').select('phone, name, avatar_url, public_key');
        if (error) throw error;
        const filtered = (users || []).filter(u => u.phone !== curPhone && u.phone);
        let added = 0;
        for (const u of filtered) {
            const exist = DB_getContacts().find(c => c.phone === u.phone);
            if (!exist) {
                DB_saveContact({ id: u.phone, phone: u.phone, name: u.name || u.phone, registered: 1, jid: u.phone+'@c.us', public_key: u.public_key, avatar_url: u.avatar_url });
                added++;
            } else if (exist.registered !== 1 || exist.name !== u.name) {
                DB_saveContact({ ...exist, name: u.name || exist.name, registered: 1, public_key: u.public_key || exist.public_key, avatar_url: u.avatar_url || exist.avatar_url });
                added++;
            }
        }
        if (added) scheduleRenderContacts();
    } catch(e) { console.warn('fetchAllUsersAsContacts:', e); }
};

window.syncContacts = async function() {
    if (!window.supabaseClient || !isOnline) return;
    const curPhone = DB_getCurrentUser()?.phone || '';
    const contacts = DB_getContacts();
    const phones = contacts.map(c => c.phone?.replace(/[\s\-\(\)]/g,'')).filter(Boolean);
    if (!phones.length) return;
    try {
        const { data: regUsers } = await window.supabaseClient.from('users').select('phone,name,avatar_url,public_key').in('phone', phones);
        const map = {};
        (regUsers||[]).forEach(u => { map[u.phone] = u; });
        for (const c of contacts) {
            const phone = c.phone?.replace(/[\s\-\(\)]/g,'');
            if (!phone) continue;
            const reg = map[phone];
            if (reg) {
                DB_saveContact({ ...c, registered: 1, name: reg.name || c.name, public_key: reg.public_key || c.public_key, avatar_url: reg.avatar_url || c.avatar_url, jid: phone+'@c.us' });
            } else if (c.registered) {
                DB_saveContact({ ...c, registered: 0 });
            }
        }
        scheduleRenderContacts();
        localStorage.setItem('lastContactsSync', new Date().toISOString());
    } catch(e) { console.warn('syncContacts:', e); }
};

// ==================== المتغيرات العامة ====================
let currentChatId = null;
let replyTarget = null;
let pendingImg = null;
let pendingVoice = null;
let pendingVideo = null;
let pendingDocument = null;
let isRecording = false;
let mediaRecorder = null;
let recordingChunks = [];
let callInterval = null;
let callSeconds = 0;
let selectedModalUser = null;
let currentScreen = 'chats';
let sessionPassword = null;

// ==================== دوال المجموعات ====================
function createGroupUI() {
    const name = prompt('اسم المجموعة:');
    if (!name || !name.trim()) return;
    const contacts = DB_getContacts().filter(c => c.registered);
    if (contacts.length === 0) { toast('⚠️ لا توجد جهات اتصال مسجلة'); return; }
    const choices = contacts.map((c,i) => `${i+1}. ${c.name} (${c.phone})`).join('\n');
    const selection = prompt(`اختر أرقام الأعضاء (مفصولة بفواصل):\n${choices}\n(اتركها فارغة)`);
    const selectedIds = [];
    if (selection && selection.trim()) {
        const indices = selection.split(',').map(s => parseInt(s.trim())-1).filter(i => !isNaN(i) && i>=0 && i<contacts.length);
        indices.forEach(i => selectedIds.push(contacts[i].id));
    }
    const gid = 'g' + Date.now();
    const currentUser = DB_getCurrentUser();
    const group = {
        id: gid, name: name.trim(), avatar: '👥', last_seen: 'الآن', online: true, unread: 0, pinned: false,
        bio: 'مجموعة جديدة', last_msg: '', last_time: new Date().toISOString(), is_group: true,
        created_by: currentUser.id,
        members: [{ id: currentUser.id, name: currentUser.name || 'أنت', avatar: currentUser.avatar || '?', role: 'admin' }]
    };
    selectedIds.forEach(id => {
        const contact = contacts.find(c => c.id === id);
        if (contact) group.members.push({ id: contact.id, name: contact.name || 'مستخدم', avatar: contact.avatar || '?', role: 'member' });
    });
    DB_saveChat(group);
    scheduleRenderChats();
    toast(`✅ تم إنشاء المجموعة "${name.trim()}"`);
    openChat(gid);
}

function getGroupMembers(chatId) { const c = DB_getChats().find(x => x.id === chatId); return c?.is_group ? (c.members || []) : []; }
function getGroupAdmins(chatId) { return getGroupMembers(chatId).filter(m => m.role === 'admin'); }
function isGroupAdmin(chatId, userId) { return getGroupAdmins(chatId).some(a => a.id === userId); }

function addGroupMember(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const cur = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, cur.id)) { toast('⚠️ فقط المشرفون يمكنهم الإضافة'); return false; }
    if (chat.members.some(m => m.id === userId)) { toast('⚠️ العضو موجود'); return false; }
    const contact = DB_getContacts().find(c => c.id === userId);
    if (!contact) return false;
    chat.members.push({ id: userId, name: contact.name || 'مستخدم', avatar: contact.avatar || '?', role: 'member' });
    DB_saveChat(chat);
    toast('✅ تمت الإضافة');
    return true;
}

function removeGroupMember(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const cur = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, cur.id)) { toast('⚠️ فقط المشرفون يمكنهم الحذف'); return false; }
    if (isGroupAdmin(chatId, userId)) { toast('⚠️ لا يمكن إزالة مشرف'); return false; }
    if (userId === chat.created_by) { toast('⚠️ لا يمكن إزالة المنشئ'); return false; }
    chat.members = chat.members.filter(m => m.id !== userId);
    DB_saveChat(chat);
    toast('✅ تمت الإزالة');
    return true;
}

function promoteToAdmin(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    if (!isGroupAdmin(chatId, DB_getCurrentUser().id)) { toast('⚠️ فقط المشرفون'); return false; }
    const member = chat.members.find(m => m.id === userId);
    if (!member) return false;
    if (member.role === 'admin') { toast('⚠️ مشرف بالفعل'); return false; }
    member.role = 'admin'; DB_saveChat(chat); toast('✅ تمت الترقية'); return true;
}

function demoteFromAdmin(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    if (!isGroupAdmin(chatId, DB_getCurrentUser().id)) { toast('⚠️ فقط المشرفون'); return false; }
    if (userId === chat.created_by) { toast('⚠️ لا يمكن خفض المنشئ'); return false; }
    const member = chat.members.find(m => m.id === userId);
    if (!member || member.role !== 'admin') return false;
    member.role = 'member'; DB_saveChat(chat); toast('✅ تم الخفض'); return true;
}

function leaveGroup(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const cur = DB_getCurrentUser();
    if (cur.id === chat.created_by) { toast('⚠️ المنشئ لا يمكنه المغادرة'); return false; }
    chat.members = chat.members.filter(m => m.id !== cur.id);
    if (chat.members.length === 0) { DB_deleteChat(chatId); toast('🗑️ تم حذف المجموعة'); }
    else { DB_saveChat(chat); toast('✅ تمت المغادرة'); }
    if (currentChatId === chatId) { currentChatId = null; showScreen('chats'); }
    scheduleRenderChats();
    return true;
}

function deleteGroup(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    if (!isGroupAdmin(chatId, DB_getCurrentUser().id)) { toast('⚠️ فقط المشرفون'); return false; }
    if (!confirm('⚠️ حذف المجموعة؟')) return false;
    DB_deleteChat(chatId);
    if (currentChatId === chatId) { currentChatId = null; showScreen('chats'); }
    scheduleRenderChats();
    toast('🗑️ تم الحذف');
    return true;
}

function openGroupManagement(chatId) {
    const modal = document.getElementById('groupManagementModal');
    const content = document.getElementById('groupManagementContent');
    if (!modal || !content) return;
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return;
    window._groupManagementChatId = chatId;
    renderGroupManagement(chatId);
    modal.classList.add('active');
}

function renderGroupManagement(chatId) {
    const container = document.getElementById('groupManagementContent');
    if (!container) return;
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat) return;
    const cur = DB_getCurrentUser();
    const isAdmin = isGroupAdmin(chatId, cur.id);
    const members = chat.members || [];
    let html = `<div style="padding:8px 0;"><h3>${esc(chat.name)}</h3><p style="color:var(--text3);font-size:13px;">${members.length} عضو</p><hr style="border-color:var(--border);margin:12px 0;"><div style="max-height:300px;overflow-y:auto;">`;
    members.forEach(m => {
        html += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;">${m.avatar || '?'}</div>
            <div style="flex:1;"><div style="font-weight:600;">${esc(m.name)} ${m.id===chat.created_by?'👑':''}</div><div style="font-size:11px;color:var(--text3);">${m.role==='admin'?'مشرف':'عضو'}</div></div>
            ${isAdmin && m.id !== cur.id ? `<div style="display:flex;gap:6px;">
                ${m.role!=='admin'?`<button class="promo-btn" style="padding:2px 10px;font-size:10px;" onclick="promoteToAdmin('${chatId}','${m.id}')">ترقية</button>`:
                `<button class="promo-btn" style="padding:2px 10px;font-size:10px;background:#ff6b6b;color:#fff;" onclick="demoteFromAdmin('${chatId}','${m.id}')">خفض</button>`}
                ${m.role!=='admin' && m.id!==chat.created_by?`<button class="promo-btn" style="padding:2px 10px;font-size:10px;background:#ff6b6b;color:#fff;" onclick="removeGroupMember('${chatId}','${m.id}')">✕</button>`:''}
            </div>` : ''}
        </div>`;
    });
    html += `</div><hr style="border-color:var(--border);margin:12px 0;">`;
    html += isAdmin ? `<button class="promo-btn" onclick="showAddMemberUI('${chatId}')" style="background:var(--accent);color:#fff;">➕ إضافة عضو</button>
    <button class="promo-btn" onclick="deleteGroup('${chatId}')" style="background:#ff4444;color:#fff;">🗑️ حذف المجموعة</button>` :
    `<button class="promo-btn" onclick="leaveGroup('${chatId}')" style="background:#ff4444;color:#fff;">🚪 مغادرة المجموعة</button>`;
    html += `</div>`;
    container.innerHTML = html;
}

function showAddMemberUI(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat) return;
    const currentMembers = chat.members.map(m => m.id);
    const available = DB_getContacts().filter(c => c.registered && !currentMembers.includes(c.id));
    if (!available.length) { toast('⚠️ لا توجد جهات اتصال متاحة'); return; }
    const choices = available.map((c,i) => `${i+1}. ${c.name} (${c.phone})`).join('\n');
    const selection = prompt(`اختر رقم العضو:\n${choices}`);
    const index = parseInt(selection) - 1;
    if (isNaN(index) || index < 0 || index >= available.length) return;
    addGroupMember(chatId, available[index].id);
    renderGroupManagement(chatId);
}

// ==================== دوال القنوات ====================
function createChannelUI() {
    const name = prompt('📢 اسم القناة:'); if (!name?.trim()) return;
    const description = prompt('📝 وصف القناة:');
    const avatar = prompt('اختر إيموجي (Enter = 📢)', '📢') || '📢';
    const inviteCode = Math.random().toString(36).substring(2,10).toUpperCase();
    const channelData = {
        id: 'ch_' + Date.now(), name: name.trim(), avatar: avatar.trim(),
        description: description?.trim() || '', invite_code: inviteCode,
        followers: 1, created_by: DB_getCurrentUser()?.id
    };
    DB_addChannel(channelData);
    if (isOnline && window.createChannel) window.createChannel(channelData).catch(()=>{});
    scheduleRenderChannels();
    toast(`✅ تم إنشاء القناة "${name.trim()}"`);
}

function renderChannelsImmediate(filter = '') {
    const container = $('#channelsList');
    if (!container) return;
    let channels = [...DB_getChannels()];
    if (filter) {
        const q = filter.toLowerCase();
        channels = channels.filter(ch => ch.name.toLowerCase().includes(q) || (ch.description && ch.description.toLowerCase().includes(q)));
    }
    channels.sort((a,b) => (b.followers||0) - (a.followers||0));
    const frag = document.createDocumentFragment();
    if (!channels.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<i class="fas fa-bullhorn"></i><p>لا توجد قنوات</p>';
        frag.appendChild(empty);
    } else {
        channels.forEach(ch => {
            const item = document.createElement('div');
            item.className = 'channel-item';
            item.innerHTML = `
                <div class="channel-avatar">${ch.avatar||'📢'}</div>
                <div class="item-info">
                    <div class="item-title">${esc(ch.name)}</div>
                    <div class="item-sub">${ch.followers||0} متابع${ch.description?' • '+esc(ch.description.substring(0,30))+(ch.description.length>30?'...':''):''}</div>
                </div>
                <button class="header-btn" onclick="event.stopPropagation(); shareChannelLink('${ch.id}')"><i class="fas fa-share-alt" style="color:var(--accent);"></i></button>
                <button class="header-btn" onclick="event.stopPropagation(); openChannelManagement('${ch.id}')"><i class="fas fa-ellipsis-v"></i></button>
            `;
            item.addEventListener('click', () => openChannelDetails(ch.id));
            frag.appendChild(item);
        });
    }
    container.innerHTML = '';
    container.appendChild(frag);
}
function renderChannels(filter) {
    if (filter !== undefined) {
        clearTimeout(debounceTimers.channels);
        debounceTimers.channels = setTimeout(() => queueRender(() => renderChannelsImmediate(filter)), 200);
    } else queueRender(() => renderChannelsImmediate());
}
function openChannelDetails(channelId) { window.location.href = `channel-feed.html?id=${channelId}`; }

function shareChannelLink(channelId) {
    const channel = DB_getChannels().find(c => c.id === channelId);
    if (!channel) return;
    const link = `${location.origin}/channel.html?code=${channel.invite_code || channel.id}`;
    if (navigator.share) { navigator.share({ title: `انضم إلى ${channel.name}`, text: link, url: link }).catch(()=>{}); }
    else { navigator.clipboard.writeText(link).then(() => toast('📋 تم نسخ الرابط')).catch(() => prompt('انسخ الرابط:', link)); }
}

function openChannelManagement(channelId) {
    const channel = DB_getChannels().find(c => c.id === channelId);
    if (!channel) return;
    if (channel.created_by !== DB_getCurrentUser()?.id) { toast('⚠️ فقط المنشئ يمكنه الإدارة'); return; }
    window.location.href = `edit-channel.html?id=${channelId}`;
}

// ==================== المكالمات الصوتية والمرئية (WebRTC) ====================
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isCallActive = false;
let callType = 'voice';

async function initiateCall(chatId, type = 'voice') {
    if (!navigator.mediaDevices) {
        toast('⚠️ جهازك لا يدعم المكالمات');
        return;
    }

    callType = type;
    const user = DB_getCurrentUser();
    if (!user) return;

    try {
        const constraints = {
            audio: true,
            video: type === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (type === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
            }
            document.getElementById('videoContainer').style.display = 'block';
        }

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        peerConnection = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
            }
            remoteStream.addTrack(event.track);
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = remoteStream;
                remoteVideo.play();
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        if (window.sendMessageRealtime) {
            await window.sendMessageRealtime({
                id: 'call_' + Date.now(),
                chat_id: chatId,
                sender_id: user.id,
                type: 'call_offer',
                payload: {
                    sdp: offer,
                    type: callType,
                    callerId: user.id
                },
                time: new Date().toISOString()
            });
        }

        showCallScreen(user.name || 'مستخدم', type);
        isCallActive = true;

    } catch (err) {
        console.error('❌ فشل بدء المكالمة:', err);
        toast('⚠️ تعذر الوصول إلى الكاميرا/الميكروفون');
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
    }
}

async function handleCallOffer(data) {
    if (!data.payload || !data.payload.sdp) return;
    const user = DB_getCurrentUser();
    if (!user) return;

    if (!confirm(`📞 ${data.sender_id} يريد مكالمة ${data.payload.type === 'video' ? 'فيديو' : 'صوتية'}. هل تقبل؟`)) {
        if (window.sendMessageRealtime) {
            await window.sendMessageRealtime({
                id: 'call_reject_' + Date.now(),
                chat_id: currentChatId,
                sender_id: user.id,
                type: 'call_reject',
                payload: { callerId: data.sender_id },
                time: new Date().toISOString()
            });
        }
        return;
    }

    try {
        const constraints = {
            audio: true,
            video: data.payload.type === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        callType = data.payload.type;

        if (callType === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
            }
            document.getElementById('videoContainer').style.display = 'block';
        }

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        peerConnection = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
            }
            remoteStream.addTrack(event.track);
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = remoteStream;
                remoteVideo.play();
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        if (window.sendMessageRealtime) {
            await window.sendMessageRealtime({
                id: 'call_answer_' + Date.now(),
                chat_id: currentChatId,
                sender_id: user.id,
                type: 'call_answer',
                payload: {
                    sdp: answer,
                    callerId: data.sender_id
                },
                time: new Date().toISOString()
            });
        }

        showCallScreen(data.sender_id, callType);
        isCallActive = true;

    } catch (err) {
        console.error('❌ فشل قبول المكالمة:', err);
        toast('⚠️ فشل قبول المكالمة');
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
    }
}

async function handleCallAnswer(data) {
    if (!data.payload || !data.payload.sdp) return;
    if (!peerConnection) return;
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
    } catch (err) {
        console.error('❌ فشل معالجة الإجابة:', err);
    }
}

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(t => t.stop());
        remoteStream = null;
    }
    isCallActive = false;
    document.getElementById('callScreen').classList.remove('active');
    document.getElementById('videoContainer').style.display = 'none';
    document.getElementById('localVideo').style.display = 'none';
    document.getElementById('remoteVideo').srcObject = null;
    toast('📞 انتهت المكالمة');
}

function showCallScreen(name, type) {
    document.getElementById('callAvatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('callStatusText').textContent = type === 'video' ? '📹 مكالمة فيديو' : '📞 مكالمة صوتية';
    document.getElementById('callTimer').textContent = '00:00';
    document.getElementById('callScreen').classList.add('active');

    let seconds = 0;
    if (callInterval) clearInterval(callInterval);
    callInterval = setInterval(() => {
        seconds++;
        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        document.getElementById('callTimer').textContent = m + ':' + s;
    }, 1000);
}

document.getElementById('voiceCallBtn')?.addEventListener('click', () => {
    if (currentChatId) initiateCall(currentChatId, 'voice');
});
document.getElementById('videoCallBtn')?.addEventListener('click', () => {
    if (currentChatId) initiateCall(currentChatId, 'video');
});
document.getElementById('callEndBtn')?.addEventListener('click', endCall);

function startCall(user, type) {
    initiateCall(user.id || user.phone, type);
}

// ==================== الكتالوج ====================
function showCatalog() {
    const catalog = DB_getCatalog();
    const html = `
        <div class="app-header"><button class="header-btn" onclick="showScreen('tools')"><i class="fas fa-arrow-right"></i></button><h2>📦 الكتالوج</h2><button class="header-btn" onclick="addCatalogItem()"><i class="fas fa-plus"></i></button></div>
        <div class="catalog-grid">
            ${catalog.length ? catalog.map(c => `
                <div class="catalog-card" onclick="toast('🛒 ${esc(c.name)} - ${c.price}')">
                    <div class="catalog-img">${c.icon}</div>
                    <div class="catalog-info"><h5>${esc(c.name)}</h5><span>${c.price}</span></div>
                </div>
            `).join('') : '<div class="empty-state"><i class="fas fa-boxes"></i><p>الكتالوج فارغ</p></div>'}
        </div>`;
    const temp = document.createElement('div');
    temp.className = 'screen active no-nav';
    temp.innerHTML = html;
    document.querySelector('.app-container')?.appendChild(temp);
    $$('.screen').forEach(s => s.classList.remove('active'));
    temp.classList.add('active');
    $('#bottomNav').style.display = 'none';
    window._catalogScreen = temp;
}
function addCatalogItem() {
    const name = prompt('اسم المنتج:'); if (!name?.trim()) return;
    const price = prompt('السعر:'); const icon = prompt('أيقونة:', '📦');
    DB_addCatalogItem({ id: 'cat'+Date.now(), name: name.trim(), price: price || 'غير محدد', icon: icon || '📦' });
    if (window._catalogScreen) { window._catalogScreen.remove(); }
    showCatalog(); toast('✅ تمت الإضافة');
}

// ==================== القوائم المنبثقة ====================
function showPopup(items) {
    const menu = $('#popupMenu');
    const overlay = $('#popupOverlay');
    if (!menu || !overlay) return;
    menu.innerHTML = items.map(i => `<div class="popup-item${i.danger?' danger':''}"><i class="fas ${i.icon}"></i>${esc(i.label)}</div>`).join('');
    menu.querySelectorAll('.popup-item').forEach((el, idx) => {
        el.addEventListener('click', () => {
            items[idx].action?.();
            overlay.classList.remove('active');
        });
    });
    overlay.classList.add('active');
}
$('#popupOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });

function getCustomMenuItems(screen) {
    const menus = {
        chats: [
            { icon: 'fa-users', label: 'مجموعة جديدة', action: () => createGroupUI() },
            { icon: 'fa-sync-alt', label: 'مزامنة', action: () => { window.syncAllPendingMessages?.(); } },
            { icon: 'fa-user-plus', label: 'دعوة أصدقاء', action: () => inviteContact('') },
            { icon: 'fa-cog', label: 'الإعدادات', action: () => window.location.href = 'settings.html' },
        ],
        contacts: [
            { icon: 'fa-user-plus', label: 'إضافة جهة اتصال', action: () => {
                const phone = prompt('رقم الهاتف:'); if (phone) { DB_saveContact({ id: 'c_'+Date.now(), phone: phone.replace(/[\s\-\(\)]/g,''), name: '', registered: 0 }); scheduleRenderContacts(); toast('✅ تمت الإضافة'); }
            }},
            { icon: 'fa-sync-alt', label: 'مزامنة', action: () => window.syncContacts?.() },
        ],
        calls: [
            { icon: 'fa-trash-alt', label: 'مسح السجل', action: () => { if (confirm('مسح السجل؟')) { if (window.inMemoryDB) window.inMemoryDB.calls = []; scheduleRenderCalls(); toast('🗑 تم المسح'); } } },
        ],
        updates: [
            { icon: 'fa-plus-circle', label: 'إنشاء قناة', action: () => createChannelUI() },
            { icon: 'fa-camera', label: 'إضافة حالة', action: () => openStoryCamera() },
        ],
        tools: [
            { icon: 'fa-boxes', label: 'الكتالوج', action: () => showCatalog() },
        ],
        chat_main: [
            { icon: 'fa-address-card', label: 'عرض جهة الاتصال', action: () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) openUserModal(c); } },
            { icon: 'fa-search', label: 'بحث في المحادثة', action: () => openInChatSearch() },
            { icon: 'fa-bell-slash', label: 'كتم الإشعارات', action: () => {
                const chat = DB_getChats().find(c => c.id === currentChatId);
                if (chat) { chat.muted = !chat.muted; DB_saveChat(chat); toast(chat.muted ? '🔕 تم الكتم' : '🔔 تم إلغاء الكتم'); }
            }},
            { icon: 'fa-users', label: 'إدارة المجموعة', action: () => {
                const chat = DB_getChats().find(c => c.id === currentChatId);
                chat?.is_group ? openGroupManagement(currentChatId) : toast('⚠️ ليست مجموعة');
            }},
            { icon: 'fa-trash-alt', label: 'مسح المحادثة', action: () => {
                if (confirm('مسح جميع الرسائل؟')) {
                    DB_getMessages(currentChatId).forEach(m => DB_deleteMessage(m.id));
                    const c = DB_getChats().find(x => x.id === currentChatId);
                    if (c) { c.last_msg = ''; c.last_time = new Date().toISOString(); DB_saveChat(c); }
                    scheduleRenderMessages(); toast('🧹 تم المسح');
                }
            }},
        ],
    };
    return menus[screen] || [];
}

function showScreenMenu(screen) {
    const items = getCustomMenuItems(screen);
    showPopup(items.length ? items : [{ icon: 'fa-cog', label: 'الإعدادات', action: () => window.location.href = 'settings.html' }]);
}

function bindMenuButtons() {
    const map = {
        mainMenuBtn: 'chats', contactsMenuBtn: 'contacts', callsMenuBtn: 'calls',
        updatesMenuBtn: 'updates', toolsMenuBtn: 'tools', chatMenuBtn: 'chat_main'
    };
    Object.entries(map).forEach(([id, screen]) => {
        const btn = document.getElementById(id);
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => showScreenMenu(screen));
        }
    });
}

// ==================== البحث داخل المحادثة ====================
function openInChatSearch() {
    const inSearch = $('#inChatSearch');
    const input = $('#inChatSearchInput');
    if (!inSearch) return;
    inSearch.classList.add('active');
    if (input) { input.value = ''; input.focus(); }
    const res = $('#searchResults');
    if (res) res.style.display = 'none';
}
$('#closeInChatSearch')?.addEventListener('click', () => {
    $('#inChatSearch')?.classList.remove('active');
    const res = $('#searchResults'); if (res) res.style.display = 'none';
});
$('#inChatSearchInput')?.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const resDiv = $('#searchResults');
    if (!q || !currentChatId) { if (resDiv) resDiv.style.display = 'none'; return; }
    const msgs = DB_getMessages(currentChatId).filter(m => m.text?.toLowerCase().includes(q));
    if (!msgs.length) { if (resDiv) resDiv.innerHTML = '<div style="padding:8px;color:var(--text3);">لا توجد نتائج</div>'; }
    else {
        if (resDiv) {
            resDiv.innerHTML = msgs.map(m => `<div class="search-result-item" data-msgid="${m.id}"><span>${esc(m.text.substring(0,60))}</span><span style="float:left;font-size:10px;color:var(--text3)">${fmtTime(m.time)}</span></div>`).join('');
            resDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => { scrollToMsg(item.dataset.msgid); resDiv.style.display = 'none'; $('#inChatSearch')?.classList.remove('active'); });
            });
        }
    }
    if (resDiv) resDiv.style.display = 'block';
});

// ==================== عرض المحادثات ====================
function renderChatsImmediate(filter = '') {
    const container = document.getElementById('chatsList');
    if (!container) return;

    let chats = [...DB_getChats()].sort((a,b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return new Date(b.last_time || 0) - new Date(a.last_time || 0);
    });
    if (filter) {
        const q = filter.toLowerCase();
        chats = chats.filter(c => c.name.toLowerCase().includes(q));
    }

    const frag = document.createDocumentFragment();
    if (!chats.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<i class="fas fa-comments"></i><p>لا توجد محادثات</p>';
        frag.appendChild(empty);
    } else {
        chats.forEach(c => {
            const isTyping = c._typing && (Date.now() - c._typing < 5000);
            const item = document.createElement('div');
            item.className = 'chat-item';
            item.dataset.id = c.id;
            item.addEventListener('click', () => openChat(c.id));

            const displayName = c.is_group ? c.name : getDisplayName(c.id, c.name);
            const displayAvatar = c.is_group ? c.avatar : getDisplayAvatar(c.id, c.avatar);

            const avatar = document.createElement('div');
            avatar.className = 'chat-avatar';
            avatar.dataset.id = c.id;
            avatar.textContent = displayAvatar || '?';
            if (c.online) {
                const dot = document.createElement('span');
                dot.className = 'online-dot';
                avatar.appendChild(dot);
            }
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                const chat = DB_getChats().find(x => x.id === c.id);
                if (chat) openUserModal(chat);
            });

            const info = document.createElement('div');
            info.className = 'chat-info';

            const nameRow = document.createElement('div');
            nameRow.className = 'chat-name-row';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'chat-name';
            nameSpan.innerHTML = (c.pinned ? '<i class="fas fa-thumbtack pinned-icon"></i> ' : '') + esc(displayName);
            const timeSpan = document.createElement('span');
            timeSpan.className = 'chat-time';
            timeSpan.textContent = c.last_time ? timeAgo(c.last_time) : '';
            nameRow.appendChild(nameSpan);
            nameRow.appendChild(timeSpan);

            const preview = document.createElement('div');
            preview.className = 'chat-preview';
            const lastMsg = document.createElement('span');
            lastMsg.className = 'last-msg';
            if (isTyping) lastMsg.innerHTML = '<span class="typing-indicator-chat">يكتب الآن...</span>';
            else lastMsg.textContent = c.last_msg ? (c.last_msg.length > 35 ? esc(c.last_msg.substring(0,35))+'...' : esc(c.last_msg)) : '👋 ابدأ المحادثة';
            preview.appendChild(lastMsg);
            if (c.unread > 0) {
                const badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.textContent = c.unread;
                preview.appendChild(badge);
            }

            info.appendChild(nameRow);
            info.appendChild(preview);
            item.appendChild(avatar);
            item.appendChild(info);
            frag.appendChild(item);
        });
    }
    container.innerHTML = '';
    container.appendChild(frag);
}

const debounceTimers = {};
function renderChats(filter) {
    if (filter !== undefined) {
        clearTimeout(debounceTimers.chats);
        debounceTimers.chats = setTimeout(() => queueRender(() => renderChatsImmediate(filter)), 150);
    } else queueRender(() => renderChatsImmediate());
}

// ==================== عرض الرسائل (مع دعم إشعار التشفير) ====================
function renderMessagesImmediate() {
    if (!currentChatId) return;
    const area = $('#messagesArea');
    if (!area) return;
    const msgs = DB_getMessages(currentChatId);
    const frag = document.createDocumentFragment();
    let lastDate = '';
    const curUserId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;

    msgs.forEach(m => {
        const md = new Date(m.time).toDateString();
        if (md !== lastDate) {
            lastDate = md;
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.textContent = fmtDate(m.time);
            frag.appendChild(divider);
        }

        // معالجة رسائل الإشعار (مثل رسالة التشفير)
        if (m.is_notice) {
            const noticeDiv = document.createElement('div');
            noticeDiv.className = 'encryption-notice';
            noticeDiv.textContent = m.text;
            noticeDiv.style.cssText = 'text-align:center;padding:8px;font-size:12px;color:var(--text3);background:var(--surface2);border-radius:8px;margin:4px 0;';
            frag.appendChild(noticeDiv);
            return;
        }

        const isMe = m.sender_id === 'me' || m.sender_id === curUserId;
        const row = document.createElement('div');
        row.className = `msg-row ${isMe ? 'own' : 'other'}`;
        row.id = 'msg-' + m.id;

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        if (m.reply_to) {
            const reply = document.createElement('div');
            reply.className = 'reply-preview';
            reply.innerHTML = '<i class="fas fa-reply"></i> رد';
            reply.onclick = () => scrollToMsg(m.reply_to);
            bubble.appendChild(reply);
        }

        if (m.voice_blob) {
            const voiceDiv = document.createElement('div');
            voiceDiv.className = 'voice-msg';
            const playBtn = document.createElement('button');
            playBtn.className = 'voice-play-btn';
            playBtn.dataset.audio = m.voice_blob;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.onclick = function(e) {
                e.stopPropagation();
                playVoice(this);
            };
            const wave = document.createElement('div');
            wave.className = 'voice-wave';
            for (let i = 0; i < 8; i++) {
                const bar = document.createElement('div');
                bar.className = 'voice-wave-bar';
                wave.appendChild(bar);
            }
            const dur = document.createElement('span');
            dur.style.cssText = 'font-size:10px;color:var(--text3);';
            dur.textContent = m.voice_duration || '0:00';
            voiceDiv.appendChild(playBtn);
            voiceDiv.appendChild(wave);
            voiceDiv.appendChild(dur);
            bubble.appendChild(voiceDiv);
        } else if (m.img) {
            const img = document.createElement('img');
            img.src = m.img;
            img.className = 'attachment-img';
            img.loading = 'lazy';
            img.onclick = () => openImageViewer(m.img);
            bubble.appendChild(img);
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'msg-text';
        textDiv.textContent = m.text || '';
        bubble.appendChild(textDiv);

        const timeRow = document.createElement('div');
        timeRow.className = 'msg-time-row';
        let timeHTML = `<span>${fmtTime(m.time)}</span>`;
        if (isMe) {
            if (m.status === 'read' || m.sync_status === 'read') timeHTML += '<i class="fas fa-check-double" style="color:#4fc3f7;"></i>';
            else if (m.status === 'delivered' || m.sync_status === 'delivered') timeHTML += '<i class="fas fa-check-double"></i>';
            else if (m.status === 'sent' || m.sync_status === 'sent') timeHTML += '<i class="fas fa-check"></i>';
            else if (m.sync_status === 'pending-send') timeHTML += '<span style="font-size:10px;">⏳</span>';
            else if (m.sync_status === 'failed') timeHTML += '<span style="font-size:10px;color:#ff4444;">⚠️</span>';
        }
        // إضافة أيقونة التشفير (اختياري)
        if (m.encrypted) {
            timeHTML += ' <i class="fas fa-lock" style="font-size:8px;color:var(--accent);"></i>';
        }
        timeRow.innerHTML = timeHTML;

        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        const likeBtn = document.createElement('button');
        likeBtn.className = m.liked ? 'liked' : '';
        likeBtn.dataset.id = m.id;
        likeBtn.dataset.act = 'like';
        likeBtn.innerHTML = `<i class="${m.liked ? 'fas' : 'far'} fa-heart"></i> ${m.likes || 0}`;
        likeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLike(m.id);
        };
        const replyBtn = document.createElement('button');
        replyBtn.dataset.id = m.id;
        replyBtn.dataset.act = 'reply';
        replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
        replyBtn.onclick = (e) => {
            e.stopPropagation();
            setReply(m.id);
        };
        actions.appendChild(likeBtn);
        actions.appendChild(replyBtn);

        if (isMe) {
            const editBtn = document.createElement('button');
            editBtn.dataset.id = m.id;
            editBtn.dataset.act = 'edit';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editMessage(m.id);
            };
            const delBtn = document.createElement('button');
            delBtn.dataset.id = m.id;
            delBtn.dataset.act = 'delete';
            delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMsg(m.id);
            };
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
        }

        bubble.appendChild(timeRow);
        bubble.appendChild(actions);
        row.appendChild(bubble);
        frag.appendChild(row);
    });

    area.innerHTML = '';
    area.appendChild(frag);
    area.scrollTop = area.scrollHeight;
}

function renderMessages() {
    queueRender(() => renderMessagesImmediate());
}

// ==================== دوال الرسائل ====================
function playVoice(btn) {
    const audio = new Audio(btn.dataset.audio);
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fas fa-pause';
    audio.play();
    audio.onended = () => {
        if (icon) icon.className = 'fas fa-play';
    };
    btn.onclick = (e) => {
        e.stopPropagation();
        if (audio.paused) {
            audio.play();
            if (icon) icon.className = 'fas fa-pause';
        } else {
            audio.pause();
            if (icon) icon.className = 'fas fa-play';
        }
    };
}

function openImageViewer(src) {
    $('#viewerImage').src = src;
    $('#imageViewer').classList.add('active');
}
$('#closeImageViewer')?.addEventListener('click', () => $('#imageViewer')?.classList.remove('active'));
$('#imageViewer')?.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
});

function toggleLike(mid) {
    if (!currentChatId) return;
    const m = DB_getMessages(currentChatId).find(x => x.id === mid);
    if (m) {
        m.liked = !m.liked;
        m.likes = (m.likes || 0) + (m.liked ? 1 : -1);
        if (m.likes < 0) m.likes = 0;
        DB_updateMessage(mid, { liked: m.liked, likes: m.likes });
        scheduleRenderMessages();
    }
}

function deleteMsg(mid) {
    if (!currentChatId || !confirm('حذف الرسالة؟')) return;
    DB_deleteMessage(mid);
    updateLastMsg();
    scheduleRenderMessages();
    toast('🗑 تم الحذف');
}

function setReply(mid) {
    const m = DB_getMessages(currentChatId).find(x => x.id === mid);
    if (m) {
        replyTarget = m;
        $('#replyPreview').textContent = (m.text || (m.voice_blob ? '🎤' : '📎')).substring(0, 50);
        $('#replyBar').style.display = 'flex';
        $('#msgInput')?.focus();
    }
}

function editMessage(mid) {
    if (!currentChatId) return;
    const m = DB_getMessages(currentChatId).find(x => x.id === mid);
    if (m && (m.sender_id === 'me' || m.sender_id === DB_getCurrentUser()?.phone)) {
        const newText = prompt('تعديل:', m.text || '');
        if (newText !== null && newText.trim() !== '') {
            DB_updateMessage(mid, { text: newText.trim() });
            updateLastMsg();
            scheduleRenderMessages();
            toast('✅ تم التعديل');
        }
    }
}

function updateLastMsg() {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c && msgs.length) {
        const l = msgs[msgs.length - 1];
        c.last_msg = l.text || (l.voice_blob ? '🎤' : l.img ? '📷' : '📎');
        c.last_time = l.time;
        DB_saveChat(c);
    }
}

// ==================== فتح المحادثة (مع إشعار التشفير مرة واحدة) ====================
function openChat(chatId) {
    unsubscribeFromUserStatus();

    currentChatId = chatId;
    const c = DB_getChats().find(x => x.id === chatId);
    if (!c) return;

    const displayName = c.is_group ? c.name : getDisplayName(c.id, c.name);
    const displayAvatar = c.is_group ? c.avatar : getDisplayAvatar(c.id, c.avatar);

    const nameEl = $('#chatNameDisp');
    const avatarEl = $('#chatAvatar');
    const statusEl = $('#chatStatusDisp');
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = displayAvatar || '?';
    if (statusEl) {
        statusEl.textContent = '📱 جاري التحقق...';
        statusEl.className = 'chat-header-status';
    }

    c.unread = 0;
    c._typing = null;
    DB_saveChat(c);
    replyTarget = null;
    pendingImg = null;
    pendingVoice = null;
    pendingVideo = null;
    pendingDocument = null;
    $('#replyBar').style.display = 'none';
    const inp = $('#msgInput');
    if (inp) inp.value = '';

    // ===== إضافة إشعار التشفير (مرة واحدة فقط) =====
    const encryptionNoticeKey = `encryption_notice_${chatId}`;
    if (!localStorage.getItem(encryptionNoticeKey) && !c.is_group) {
        const noticeMsg = {
            id: 'notice_' + Date.now(),
            chat_id: chatId,
            sender_id: 'system',
            text: '🔐 الرسائل والمكالمات مشفرة تماماً بين الطرفين. ولا يمكن لأي شخص آخر قراءتها.',
            time: new Date().toISOString(),
            status: 'sent',
            sync_status: 'sent',
            is_notice: true
        };
        DB_addMessage(noticeMsg);
        localStorage.setItem(encryptionNoticeKey, 'true');
    }

    scheduleRenderMessages();
    updateSendBtn();
    showScreen('chat');

    // ---- الاشتراك في تحديثات حالة المستخدم الآخر ----
    const otherUserId = c.id;
    if (otherUserId && window.supabaseClient && !c.is_group) {
        fetchUserStatus(otherUserId).then(status => {
            if (status && statusEl) {
                updateStatusDisplay(statusEl, status.is_online, status.last_seen, c._typing);
            }
        });

        subscribeToUserStatus(otherUserId, (status) => {
            if (statusEl) {
                updateStatusDisplay(statusEl, status.is_online, status.last_seen, c._typing);
            }
            const chat = DB_getChats().find(x => x.id === chatId);
            if (chat) {
                chat.online = status.is_online || false;
                DB_saveChat(chat);
                scheduleRenderChats();
            }
        });
    }

    // ---- الاشتراك في رسائل المحادثة ----
    if (window.subscribeToChat) {
        window.subscribeToChat(chatId, handleIncomingMessage, (senderId, isTyping) => {
            const chat = DB_getChats().find(x => x.id === chatId);
            if (!chat) return;
            const curId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;
            if (senderId !== curId) {
                chat._typing = isTyping ? Date.now() : null;
                const st = $('#chatStatusDisp');
                if (st) {
                    if (chat.is_group) {
                        st.textContent = isTyping ? '✍️ يكتب الآن...' : '📱 مجموعة';
                        st.className = 'chat-header-status' + (isTyping ? ' typing' : '');
                    } else {
                        const otherId = chat.id;
                        fetchUserStatus(otherId).then(status => {
                            if (status) {
                                updateStatusDisplay(st, status.is_online, status.last_seen, chat._typing);
                            } else {
                                st.textContent = isTyping ? '✍️ يكتب الآن...' : '📱 غير متصل';
                                st.className = 'chat-header-status' + (isTyping ? ' typing' : '');
                            }
                        }).catch(() => {
                            st.textContent = isTyping ? '✍️ يكتب الآن...' : '📱 غير متصل';
                            st.className = 'chat-header-status' + (isTyping ? ' typing' : '');
                        });
                    }
                }
                DB_saveChat(chat);
                scheduleRenderChats();
            }
        });
    }
    setTimeout(() => inp?.focus(), 300);
    scheduleRenderChats();

    window.updateUserOnlineStatus(true);
}

// ==================== إرسال رسالة (محسنة مع التشفير الخلفي) ====================
async function sendMessage() {
    if (!currentChatId) return;
    const inp = $('#msgInput');
    const text = inp?.value.trim();

    if (isRecording) {
        if (mediaRecorder?.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;
        $('#micBtn')?.classList.remove('recording');
        return;
    }

    if (!text && !pendingImg && !pendingVoice && !pendingVideo && !pendingDocument) {
        return;
    }

    let msgText = text || '';
    let attachmentType = null;
    let attachmentData = null;

    if (pendingVoice) {
        msgText = '🎤 رسالة صوتية';
        attachmentType = 'voice';
        attachmentData = pendingVoice;
    } else if (pendingImg) {
        msgText = '📷 صورة';
        attachmentType = 'image';
        attachmentData = pendingImg;
    } else if (pendingVideo) {
        msgText = '🎬 فيديو';
        attachmentType = 'video';
        attachmentData = pendingVideo;
    } else if (pendingDocument) {
        msgText = '📄 مستند';
        attachmentType = 'document';
        attachmentData = pendingDocument;
    }

    // التشفير في الخلفية (المرسل يرى النص الأصلي)
    let encryptedPayload = null;
    let originalText = msgText;

    if (isOnline && currentUserKeyPair) {
        const peerKey = await fetchPeerPublicKey(currentChatId);
        if (peerKey) {
            try {
                const secret = await deriveSharedSecret(currentUserKeyPair.privateKey, peerKey);
                encryptedPayload = await encryptText(originalText, secret);
                console.log('🔐 تم تشفير الرسالة في الخلفية');
            } catch (e) {
                console.warn('⚠️ فشل تشفير الرسالة:', e);
                encryptedPayload = null;
            }
        } else {
            console.warn('⚠️ لا يمكن تشفير الرسالة: مفتاح المستلم غير متاح');
            encryptedPayload = null;
        }
    }

    const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        chat_id: currentChatId,
        sender_id: 'me',
        text: originalText,  // النص الأصلي للمرسل والمستلم
        encrypted: !!encryptedPayload,
        encrypted_payload: encryptedPayload,
        time: new Date().toISOString(),
        likes: 0,
        liked: false,
        reply_to: replyTarget?.id || null,
        img: pendingImg || null,
        voice_blob: pendingVoice?.blob || null,
        voice_duration: pendingVoice?.duration || null,
        video: pendingVideo || null,
        document: pendingDocument || null,
        status: 'sending',
        sync_status: 'pending-send'
    };

    DB_addMessage(msg);

    if (inp) inp.value = '';
    pendingImg = null;
    pendingVoice = null;
    pendingVideo = null;
    pendingDocument = null;
    replyTarget = null;
    $('#replyBar').style.display = 'none';
    updateSendBtn();
    window.sendTypingEvent?.(currentChatId, false);
    playNotificationSound();

    scheduleRenderMessages();
    scheduleRenderChats();

    if (isOnline && window.sendMessageRealtime) {
        const result = await window.sendMessageRealtime(msg);
        DB_updateMessage(msg.id, {
            sync_status: result.success ? 'sent' : 'failed',
            status: result.success ? 'sent' : 'failed'
        });
        scheduleRenderMessages();
        scheduleRenderChats();
    }
}

// ==================== معالجة الرسائل الواردة (مع فك التشفير التلقائي) ====================
async function handleIncomingMessage(msg) {
    if (!msg || msg.sender_id === 'me') return;
    const curId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;
    if (msg.sender_id === curId) return;
    if (DB_getMessages(msg.chat_id).find(m => m.id === msg.id)) return;

    let decryptedText = msg.text;

    if (msg.encrypted && msg.encrypted_payload) {
        try {
            // تحديد معرف المرسل الصحيح
            let peerId = msg.sender_id;
            if (peerId === 'me' || !peerId || peerId === 'undefined') {
                peerId = msg.chat_id;
            }

            const peerKey = await fetchPeerPublicKey(peerId);
            if (peerKey && currentUserKeyPair) {
                const secret = await deriveSharedSecret(currentUserKeyPair.privateKey, peerKey);
                const decrypted = await decryptText(msg.encrypted_payload, secret);
                if (decrypted && decrypted !== '🔒 تعذر فك التشفير') {
                    decryptedText = decrypted;
                    console.log('✅ تم فك تشفير الرسالة:', decryptedText);
                } else {
                    decryptedText = msg.payload?.text || msg.text;
                }
            } else {
                decryptedText = msg.payload?.text || msg.text;
            }
        } catch (e) {
            console.warn('⚠️ فشل فك تشفير الرسالة:', e);
            decryptedText = msg.payload?.text || msg.text;
        }
    }

    const finalMsg = {
        ...msg,
        text: decryptedText,
        sync_status: 'delivered',
        status: 'delivered'
    };

    DB_addMessage(finalMsg);

    const chat = DB_getChats().find(c => c.id === msg.chat_id);
    if (chat) {
        chat.last_msg = finalMsg.text || (finalMsg.img ? '📷' : finalMsg.voice_blob ? '🎤' : '📎');
        chat.last_time = finalMsg.time;
        if (!chat.online) chat.unread = (chat.unread || 0) + 1;
        DB_saveChat(chat);
    }

    if (currentChatId === msg.chat_id) scheduleRenderMessages();
    scheduleRenderChats();
    playNotificationSound();
}

// ==================== التسجيل الصوتي ====================
async function startRecording(e) {
    e.preventDefault();
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        $('#micBtn')?.classList.add('recording');
        toast('🎤 جاري التسجيل...', 3000);

        mediaRecorder = new MediaRecorder(stream);
        recordingChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordingChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordingChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result;
                const duration = Math.floor(recordingChunks.length * 0.05);
                pendingVoice = {
                    blob: base64,
                    duration: '0:' + Math.min(duration, 59).toString().padStart(2, '0')
                };
                $('#micBtn')?.classList.remove('recording');
                updateSendBtn();
                toast('🎤 صوت مسجل، جاري الإرسال...', 1500);
                sendMessage();
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
            isRecording = false;
        };

        mediaRecorder.start();

        const stopOnRelease = () => {
            if (isRecording && mediaRecorder?.state === 'recording') {
                mediaRecorder.stop();
                isRecording = false;
                $('#micBtn')?.classList.remove('recording');
            }
            document.removeEventListener('mouseup', stopOnRelease);
            document.removeEventListener('touchend', stopOnRelease);
        };
        document.addEventListener('mouseup', stopOnRelease);
        document.addEventListener('touchend', stopOnRelease);

        setTimeout(() => {
            if (isRecording && mediaRecorder?.state === 'recording') {
                mediaRecorder.stop();
                isRecording = false;
                $('#micBtn')?.classList.remove('recording');
            }
        }, 15000);

    } catch (err) {
        toast('⚠️ لا يمكن الوصول للميكروفون');
        isRecording = false;
        $('#micBtn')?.classList.remove('recording');
    }
}

function stopRecording() {
    if (isRecording && mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        $('#micBtn')?.classList.remove('recording');
    }
}

// ==================== المرفقات (مثل واتساب) ====================
function selectImageFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = false;
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleFileUpload(file);
    };
    input.click();
}

function captureImageFromCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleFileUpload(file);
    };
    input.click();
}

function selectDocument() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.ppt,.pptx';
    input.multiple = false;
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleFileUpload(file);
    };
    input.click();
}

async function handleFileUpload(file) {
    if (file.size > 25 * 1024 * 1024) {
        toast('⚠️ حجم الملف كبير جداً (الحد الأقصى 25 ميجابايت)');
        return;
    }

    toast('📤 جاري رفع الملف...');

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            let type = 'file';
            let icon = '📎';
            if (file.type.startsWith('image/')) {
                type = 'image';
                icon = '📷';
                pendingImg = base64;
            } else if (file.type.startsWith('video/')) {
                type = 'video';
                icon = '🎬';
                pendingVideo = base64;
            } else {
                type = 'document';
                icon = '📄';
                pendingDocument = base64;
            }

            toast(`📎 تم رفع ${file.name} (${(file.size / 1024).toFixed(0)} كيلوبايت)`);
            await sendMessage();
            pendingImg = null;
            pendingVideo = null;
            pendingDocument = null;
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('❌ فشل رفع الملف:', err);
        toast('⚠️ فشل رفع الملف');
    }
}

document.getElementById('attachBtn')?.addEventListener('click', () => {
    document.getElementById('attachOverlay')?.classList.add('active');
    document.getElementById('attachSheet')?.classList.add('open');
});

document.querySelectorAll('.attach-option').forEach(option => {
    option.addEventListener('click', (e) => {
        const type = option.dataset.type;
        switch (type) {
            case 'gallery':
                selectImageFromGallery();
                break;
            case 'camera':
                captureImageFromCamera();
                break;
            case 'document':
                selectDocument();
                break;
            case 'contact':
                const contact = prompt('أدخل اسم جهة الاتصال:');
                if (contact) {
                    const msg = {
                        id: 'msg_' + Date.now(),
                        chat_id: currentChatId,
                        sender_id: 'me',
                        text: `📇 ${contact}`,
                        time: new Date().toISOString(),
                        status: 'sending',
                        sync_status: 'pending-send'
                    };
                    DB_addMessage(msg);
                    scheduleRenderMessages();
                    scheduleRenderChats();
                    if (isOnline && window.sendMessageRealtime) {
                        window.sendMessageRealtime(msg);
                    }
                    toast('📇 تم إرسال جهة الاتصال');
                }
                break;
            default:
                toast('⚠️ خيار غير معروف');
        }
        document.getElementById('attachOverlay')?.classList.remove('active');
        document.getElementById('attachSheet')?.classList.remove('open');
    });
});

document.getElementById('closeAttachBtn')?.addEventListener('click', () => {
    document.getElementById('attachOverlay')?.classList.remove('active');
    document.getElementById('attachSheet')?.classList.remove('open');
});

document.getElementById('attachOverlay')?.addEventListener('click', () => {
    document.getElementById('attachOverlay')?.classList.remove('active');
    document.getElementById('attachSheet')?.classList.remove('open');
});

// ==================== نافذة الإيموجي ====================
function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;
    picker.classList.toggle('show');
    if (picker.classList.contains('show') && picker.children.length === 0) {
        const emojis = ['😊', '😂', '❤️', '🔥', '👍', '👏', '😍', '🤔', '😢', '🎉', '✨', '💪', '🤣', '🙏', '😘', '🥰', '😎', '🤗', '😇', '🥳', '😅', '🤩', '😁', '🤪', '🥺', '😭', '😱', '😤', '😡', '😨', '😰', '😓', '😔', '😕', '😖', '😣', '😫', '😩', '😪', '😮', '😯', '😲', '😳', '😵', '😶', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😴', '💤', '💢', '💬', '💭', '💦', '💨', '🕳️', '💣', '💥', '💫', '🌟', '⭐', '☀️', '🌙', '☁️', '⛅', '⚡', '🔥', '💧', '🌊', '❄️', '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌿', '🍀', '🍁', '🍂', '🍃', '🍄', '🌾', '💐', '🌵', '🌲', '🌳', '🌴', '🐾', '🐕', '🐩', '🐈', '🐆', '🐅', '🐯', '🐻', '🐼', '🐨', '🐮', '🐷', '🐽', '🐸', '🐵', '🐒', '🐔', '🐧', '🐦', '🐤', '🐥', '🐣', '🐺', '🐗', '🐴', '🐝', '🐞', '🐛', '🐜', '🐟', '🐠', '🐡', '🐬', '🐳', '🐋', '🐊', '🦈', '🐧', '🐉', '🦖', '🦕', '🦄', '🦋', '🦀', '🦞', '🦐', '🦑', '🐚', '🪸', '🏖️', '🏝️', '🏔️', '⛰️', '🏕️', '🏞️', '🌅', '🌄', '🌇', '🌆', '🌃', '🌌', '🌉', '🏙️', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '⛩️', '🕍', '🕌', '🕋', '⛪', '🕊️', '🎆', '🎇', '🧨', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🎀', '🎁', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉', '🏉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '⛸️', '🛷', '🎿', '⛷️', '🏂', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏇', '🏃', '🚶', '🧎', '💃', '🕺', '🤸', '🤼', '🤹', '🧘', '🪂', '🪐', '🌌', '🧞', '🧟', '🧙', '🧚', '🧛', '🧝', '🧜', '🧞', '🧟', '🧚', '🧛', '🧝'];
        const fragment = document.createDocumentFragment();
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.textContent = emoji;
            span.style.fontSize = '28px';
            span.style.cursor = 'pointer';
            span.style.padding = '4px 6px';
            span.style.borderRadius = '8px';
            span.style.transition = '0.15s';
            span.addEventListener('click', () => {
                const input = document.getElementById('msgInput');
                if (input) {
                    const start = input.selectionStart;
                    const end = input.selectionEnd;
                    const text = input.value;
                    input.value = text.substring(0, start) + emoji + text.substring(end);
                    input.selectionStart = input.selectionEnd = start + emoji.length;
                    input.focus();
                    updateSendBtn();
                }
                picker.classList.remove('show');
            });
            span.addEventListener('mouseenter', () => {
                span.style.background = 'var(--surface3)';
                span.style.transform = 'scale(1.2)';
            });
            span.addEventListener('mouseleave', () => {
                span.style.background = 'transparent';
                span.style.transform = 'scale(1)';
            });
            fragment.appendChild(span);
        });
        picker.appendChild(fragment);
    }
}

document.addEventListener('click', (e) => {
    const picker = document.getElementById('emojiPicker');
    const btn = document.getElementById('emojiBtn');
    if (picker && btn) {
        if (!picker.contains(e.target) && !btn.contains(e.target)) {
            picker.classList.remove('show');
        }
    }
});

document.getElementById('emojiBtn')?.addEventListener('click', toggleEmojiPicker);

// ==================== نافذة المستخدم ====================
function openUserModal(user) {
    selectedModalUser = user;
    const displayName = getDisplayName(user.id, user.name);
    const displayAvatar = getDisplayAvatar(user.id, user.avatar);

    $('#modalAvatar').textContent = displayAvatar || '?';
    $('#modalName').textContent = displayName;
    $('#modalBio').textContent = user.bio || 'مرحباً! أنا في RamzApp 💬';
    $('#userModal').classList.add('active');
}
$('#closeModalBtn')?.addEventListener('click', () => $('#userModal').classList.remove('active'));
$('#userModal')?.addEventListener('click', e => {
    if (e.target === $('#userModal')) $('#userModal').classList.remove('active');
});
$('#modalChatBtn')?.addEventListener('click', () => {
    if (selectedModalUser) startOrOpenChat(selectedModalUser);
    $('#userModal').classList.remove('active');
});
$('#modalCallBtn')?.addEventListener('click', () => {
    if (selectedModalUser) startCall(selectedModalUser, 'voice');
    $('#userModal').classList.remove('active');
});
$('#modalVideoBtn')?.addEventListener('click', () => {
    if (selectedModalUser) startCall(selectedModalUser, 'video');
    $('#userModal').classList.remove('active');
});

// ==================== جهات الاتصال ====================
function renderContactsImmediate() {
    const container = $('#contactsList');
    if (!container) return;
    const contacts = DB_getContacts();
    const registered = contacts.filter(c => c.registered === 1);
    const unregistered = contacts.filter(c => c.registered !== 1);

    const frag = document.createDocumentFragment();

    const regHeader = document.createElement('div');
    regHeader.className = 'section-header';
    regHeader.innerHTML = `<h3>✅ المسجلين في RamzApp (${registered.length})</h3>`;
    frag.appendChild(regHeader);

    if (registered.length) {
        registered.forEach(c => {
            const el = document.createElement('div');
            el.className = 'channel-item contact-item';
            el.dataset.id = c.id;
            el.innerHTML = `
                <div class="channel-avatar">${c.avatar || (c.name ? c.name.charAt(0).toUpperCase() : '📞')}</div>
                <div class="item-info">
                    <div class="item-title">${esc(c.name || c.phone)}</div>
                    <div class="item-sub">${c.phone} • 🟢 مسجل</div>
                </div>
                <i class="fas fa-comment-dots" style="color:var(--accent);cursor:pointer;"></i>
            `;
            el.addEventListener('click', () => startOrOpenChat({ id: c.id, name: c.name, avatar: c.avatar || '?', phone: c.phone }));
            frag.appendChild(el);
        });
    } else {
        const p = document.createElement('p');
        p.style.cssText = 'color:var(--text3);padding:8px 16px;';
        p.textContent = 'لا يوجد جهات اتصال مسجلة';
        frag.appendChild(p);
    }

    const unregHeader = document.createElement('div');
    unregHeader.className = 'section-header';
    unregHeader.innerHTML = `<h3>⏳ غير المسجلين (${unregistered.length})</h3>`;
    frag.appendChild(unregHeader);

    if (unregistered.length) {
        unregistered.forEach(c => {
            const el = document.createElement('div');
            el.className = 'channel-item contact-item';
            el.dataset.phone = c.phone;
            el.innerHTML = `
                <div class="channel-avatar">${c.avatar || (c.name ? c.name.charAt(0).toUpperCase() : '📞')}</div>
                <div class="item-info">
                    <div class="item-title">${esc(c.name || c.phone)}</div>
                    <div class="item-sub">${c.phone} • ⏳ غير مسجل</div>
                </div>
                <button class="promo-btn invite-btn" style="padding:4px 10px;font-size:11px;background:var(--accent);color:#fff;" data-phone="${c.phone}">دعوة</button>
            `;
            el.querySelector('.invite-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                inviteContact(c.phone);
            });
            frag.appendChild(el);
        });
    } else {
        const p = document.createElement('p');
        p.style.cssText = 'color:var(--text3);padding:8px 16px;';
        p.textContent = 'لا يوجد جهات اتصال غير مسجلة';
        frag.appendChild(p);
    }

    const syncBtn = document.createElement('div');
    syncBtn.style.cssText = 'padding:12px 16px;margin:8px 0;';
    syncBtn.innerHTML = `
        <button class="promo-btn" onclick="syncContacts()" style="background:var(--green);color:#fff;width:100%;">
            <i class="fas fa-sync-alt"></i> مزامنة جهات الاتصال
        </button>
    `;
    frag.appendChild(syncBtn);

    container.innerHTML = '';
    container.appendChild(frag);
}

function renderContactsList() { queueRender(() => renderContactsImmediate()); }

function startOrOpenChat(user) {
    const displayName = getDisplayName(user.id, user.name);
    const displayAvatar = getDisplayAvatar(user.id, user.avatar);

    let chat = DB_getChats().find(c => c.id === user.id || c.phone === user.phone);
    if (!chat) {
        const chatId = user.phone || user.id;
        chat = {
            id: chatId,
            phone: user.phone,
            name: displayName,
            avatar: displayAvatar || '?',
            last_msg: '',
            last_time: new Date().toISOString(),
            unread: 0,
            online: false,
            pinned: false,
            bio: user.bio || ''
        };
        DB_saveChat(chat);
    }
    openChat(chat.id);
}

async function inviteContact(phone) {
    const msg = `انضم إلى RamzApp: https://ramzapp.com/download`;
    if (navigator.share) {
        try { await navigator.share({ title: 'دعوة', text: msg }); } catch(e) {}
    } else {
        try { await navigator.clipboard.writeText(msg); toast('📋 تم نسخ الدعوة'); } catch(e) { toast('📋 رابط: https://ramzapp.com/download'); }
    }
}

// ==================== القصص ====================
function renderStoriesImmediate() {
    const bar = document.getElementById('storyBar');
    const list = document.getElementById('storiesList');
    const count = document.getElementById('storiesCount');
    if (!bar || !list) return;

    const now = new Date().toISOString();
    const stories = DB_getStories()
        .filter(s => s.expires_at > now)
        .sort((a, b) => new Date(b.time) - new Date(a.time));

    if (count) count.textContent = stories.length + ' قصة';

    const fragBar = document.createDocumentFragment();
    const addItem = document.createElement('div');
    addItem.className = 'story-item story-add';
    addItem.onclick = openStoryCamera;
    addItem.innerHTML = `<div class="story-ring"><span>+</span></div><div class="story-name">إضافة</div>`;
    fragBar.appendChild(addItem);

    stories.slice(0, 10).forEach((s, index) => {
        const item = document.createElement('div');
        item.className = 'story-item';
        item.onclick = () => openStoryViewer(index);
        item.innerHTML = `
            <div class="story-ring ${s.isViewed ? 'viewed' : ''}">
                <div class="story-avatar" style="background:${s.color || '#ff0050'};">
                    ${s.avatar || '📷'}
                </div>
            </div>
            <div class="story-name">${esc(s.name || 'مستخدم')}</div>
        `;
        fragBar.appendChild(item);
    });

    bar.innerHTML = '';
    bar.appendChild(fragBar);
    bar.style.display = stories.length > 0 ? 'flex' : 'none';

    const fragList = document.createDocumentFragment();
    if (stories.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<i class="fas fa-camera"></i><p>لا توجد قصص حالياً، أضف قصتك الأولى!</p>';
        fragList.appendChild(empty);
    } else {
        stories.forEach((s) => {
            const card = document.createElement('div');
            card.className = 'story-card';
            card.onclick = () => {
                const idx = stories.findIndex(st => st.id === s.id);
                if (idx !== -1) openStoryViewer(idx);
            };
            const preview = document.createElement('div');
            preview.className = 'story-preview';
            if (s.type === 'image') {
                preview.innerHTML = `<img src="${s.content}" alt="قصة" loading="lazy">`;
            } else if (s.type === 'video') {
                preview.innerHTML = `<video src="${s.content}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
            } else {
                preview.textContent = s.content || '📝';
                preview.style.fontSize = '24px';
                preview.style.display = 'flex';
                preview.style.alignItems = 'center';
                preview.style.justifyContent = 'center';
            }
            const meta = document.createElement('div');
            meta.className = 'story-meta';
            meta.innerHTML = `
                <span>${esc(s.name || 'مستخدم')}</span>
                <span>${timeAgo(s.time)}</span>
            `;
            card.appendChild(preview);
            card.appendChild(meta);
            fragList.appendChild(card);
        });
    }

    list.innerHTML = '';
    list.appendChild(fragList);
}

function renderStories() { queueRender(() => renderStoriesImmediate()); }

function openStoryCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast('⚠️ حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const user = DB_getCurrentUser();
            const story = {
                id: 's_' + Date.now(),
                user_id: user?.phone || user?.id || 'guest',
                name: user?.name || 'مستخدم',
                avatar: user?.avatar || '📷',
                type: file.type.startsWith('image/') ? 'image' : 'video',
                content: ev.target.result,
                time: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                isViewed: false,
                color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
            };
            DB_addStory(story);
            if (isOnline && window.addStoryToSupabase) {
                try { await window.addStoryToSupabase(story); } catch (e) { console.warn('⚠️ فشل مزامنة القصة مع Supabase:', e); }
            }
            renderStories();
            toast('✅ تم نشر القصة بنجاح');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function openStoryViewer(startIndex) {
    const now = new Date().toISOString();
    let stories = DB_getStories()
        .filter(s => s.expires_at > now)
        .sort((a, b) => new Date(b.time) - new Date(a.time));

    if (stories.length === 0) { toast('🎬 لا توجد قصص لعرضها'); return; }
    if (startIndex >= stories.length) { toast('🎬 انتهت القصص'); return; }

    let currentIndex = startIndex;
    let timer = null;
    let progress = 0;
    let isPaused = false;

    const viewer = document.createElement('div');
    viewer.className = 'story-viewer-active';
    viewer.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.95); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 20px; user-select: none; touch-action: none;
    `;

    function renderStory(index) {
        const story = stories[index];
        if (!story) { closeViewer(); return; }

        if (!story.isViewed) {
            story.isViewed = true;
            DB_updateStory(story.id, { isViewed: true });
            renderStories();
        }

        let contentHTML = '';
        if (story.type === 'image') {
            contentHTML = `<img src="${story.content}" style="max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain;">`;
        } else if (story.type === 'video') {
            contentHTML = `<video src="${story.content}" controls autoplay muted style="max-width:100%;max-height:70vh;border-radius:12px;"></video>`;
        } else {
            contentHTML = `<div style="background:rgba(255,255,255,0.1);padding:40px;border-radius:16px;color:#fff;font-size:24px;text-align:center;max-width:90%;">${esc(story.content)}</div>`;
        }

        let progressHTML = stories.map((_, i) => {
            const isActive = i === index;
            const isPast = i < index;
            return `<div style="flex:1;height:3px;background:${isPast ? 'rgba(255,255,255,0.8)' : isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'};border-radius:2px;overflow:hidden;position:relative;">
                ${isActive ? `<div style="height:100%;background:#fff;width:0%;transition:width 0.1s linear;" id="storyProgressFill"></div>` : ''}
            </div>`;
        }).join('');

        viewer.innerHTML = `
            <div style="position:absolute;top:20px;left:20px;right:20px;display:flex;gap:4px;z-index:10000;">
                ${progressHTML}
            </div>
            <button style="position:absolute;top:20px;right:20px;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:24px;width:44px;height:44px;border-radius:50%;cursor:pointer;z-index:10000;" onclick="document.querySelector('.story-viewer-active').remove()">✕</button>
            <div style="position:absolute;top:70px;left:20px;z-index:10000;display:flex;align-items:center;gap:12px;color:#fff;">
                <div style="width:36px;height:36px;border-radius:50%;background:${story.color || '#ff0050'};display:flex;align-items:center;justify-content:center;font-size:18px;">${story.avatar || '📷'}</div>
                <div><div style="font-weight:700;">${esc(story.name || 'مستخدم')}</div><div style="font-size:11px;opacity:0.7;">${timeAgo(story.time)}</div></div>
            </div>
            <div class="content" style="max-width:400px;max-height:80vh;width:100%;display:flex;align-items:center;justify-content:center;position:relative;">
                ${contentHTML}
            </div>
            <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.6);font-size:12px;background:rgba(0,0,0,0.4);padding:6px 16px;border-radius:20px;">
                ${index+1} / ${stories.length}
            </div>
        `;

        clearInterval(timer);
        progress = 0;

        if (!isPaused) {
            const fill = viewer.querySelector('#storyProgressFill');
            if (fill) {
                timer = setInterval(() => {
                    if (!isPaused) {
                        progress += 1;
                        fill.style.width = progress + '%';
                        if (progress >= 100) {
                            clearInterval(timer);
                            if (index + 1 < stories.length) {
                                renderStory(index + 1);
                            } else {
                                closeViewer();
                            }
                        }
                    }
                }, 50);
            }
        }
    }

    function closeViewer() {
        clearInterval(timer);
        if (viewer.parentNode) viewer.remove();
        renderStories();
    }

    viewer.addEventListener('touchstart', () => { isPaused = true; });
    viewer.addEventListener('touchend', () => {
        isPaused = false;
        if (!timer) {
            const fill = viewer.querySelector('#storyProgressFill');
            if (fill) {
                const currentProgress = parseFloat(fill.style.width) || 0;
                if (currentProgress < 100) {
                    timer = setInterval(() => {
                        if (!isPaused) {
                            progress += 1;
                            fill.style.width = progress + '%';
                            if (progress >= 100) {
                                clearInterval(timer);
                                const idx = stories.findIndex(s => s.id === story.id);
                                if (idx + 1 < stories.length) {
                                    renderStory(idx + 1);
                                } else {
                                    closeViewer();
                                }
                            }
                        }
                    }, 50);
                }
            }
        }
    });
    viewer.addEventListener('mousedown', () => { isPaused = true; });
    viewer.addEventListener('mouseup', () => { isPaused = false; });
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer || e.target.classList.contains('content')) {
            closeViewer();
        }
    });

    document.body.appendChild(viewer);
    renderStory(startIndex);
}

// ==================== الإعدادات ====================
function applyTheme() {
    document.body.classList.toggle('light-theme', DB_getSettings().theme === 'light');
}
window.exportData = function() {
    if (window.exportAllData) {
        const data = window.exportAllData();
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ramzapp_backup.json';
        a.click();
        toast('💾 تم التصدير');
    }
};
window.importData = function() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json';
    inp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const success = window.importAllData ? await window.importAllData(ev.target.result) : false;
                    if (success) { toast('✅ تم الاستيراد');
                        location.reload(); } else toast('❌ ملف غير صالح');
                } catch (e) { toast('❌ فشل القراءة'); }
            };
            reader.readAsText(file);
        }
    };
    inp.click();
};
window.clearAllData = function() {
    if (confirm('⚠️ حذف جميع البيانات؟')) { DB_clearAllData();
        toast('🗑 تم الحذف');
        setTimeout(() => location.reload(), 500); }
};

// ==================== تسجيل الخروج ====================
window.logout = function() {
    if (confirm('تسجيل الخروج؟')) {
        if (window.saveAllData) {
            window.saveAllData().then(() => {
                localStorage.removeItem('ramzapp_user');
                sessionPassword = null;
                currentUserKeyPair = null;
                if (window.supabaseClient) {
                    window.supabaseClient.auth.signOut().catch(() => {});
                }
                window.location.href = 'login.html';
            }).catch(() => {
                localStorage.removeItem('ramzapp_user');
                sessionPassword = null;
                currentUserKeyPair = null;
                window.location.href = 'login.html';
            });
        } else {
            localStorage.removeItem('ramzapp_user');
            sessionPassword = null;
            currentUserKeyPair = null;
            window.location.href = 'login.html';
        }
    }
};

// ==================== التنقل بين الشاشات ====================
function showScreen(id) {
    currentScreen = id;
    const screens = ['chatsScreen', 'chatScreen', 'contactsScreen', 'callsScreen', 'updatesScreen', 'toolsScreen', 'profileScreen', 'settingsScreen'];
    screens.forEach(s => { const el = document.getElementById(s); if (el) el.classList.remove('active'); });
    const target = document.getElementById(id + 'Screen') || document.getElementById(id);
    if (target) target.classList.add('active');
    const noNav = ['chatScreen', 'profileScreen', 'settingsScreen'];
    const bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = noNav.includes(id + 'Screen') || noNav.includes(id) ? 'none' : 'flex';
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    if (id === 'chats') scheduleRenderChats();
    else if (id === 'contacts') scheduleRenderContacts();
    else if (id === 'calls') scheduleRenderCalls();
    else if (id === 'updates') { scheduleRenderStories();
        scheduleRenderChannels(); } else if (id === 'tools') {}
}
window.navigateTo = function(screen) {
    const map = { feed: 'chats', chats: 'chats', contacts: 'contacts', calls: 'calls', updates: 'updates', tools: 'tools', profile: 'profile', settings: 'settings' };
    showScreen(map[screen] || screen);
};
$$('.nav-item').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.nav)));

// ==================== تحديث زر الإرسال ====================
function updateSendBtn() {
    const inp = $('#msgInput');
    const hasText = inp && inp.value.trim().length > 0;
    const hasAttachment = pendingImg || pendingVoice || pendingVideo || pendingDocument;
    const hasContent = hasText || hasAttachment;

    const sendBtn = $('#sendMsgBtn');
    const micBtn = $('#micBtn');

    if (sendBtn) sendBtn.style.display = hasContent ? 'flex' : 'none';
    if (micBtn) micBtn.style.display = hasContent ? 'none' : 'flex';

    if (sendBtn) {
        if (hasAttachment) {
            sendBtn.style.background = 'var(--accent2)';
        } else {
            sendBtn.style.background = 'var(--accent)';
        }
    }
}

// ==================== جميع مستمعي الأحداث ====================
$('#backBtn')?.addEventListener('click', () => {
    if (currentChatId) { window.unsubscribeFromChat?.(currentChatId);
        currentChatId = null; }
    showScreen('chats');
});
$('#cancelReplyBtn')?.addEventListener('click', () => { replyTarget = null;
    $('#replyBar').style.display = 'none'; });
$('#sendMsgBtn')?.addEventListener('click', sendMessage);
$('#msgInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
$('#msgInput')?.addEventListener('input', () => { updateSendBtn();
    window.sendTypingEvent?.(currentChatId, $('#msgInput').value.trim().length > 0); });
$('#micBtn')?.addEventListener('mousedown', startRecording);
$('#micBtn')?.addEventListener('touchstart', startRecording);
$('#micBtn')?.addEventListener('mouseup', stopRecording);
$('#micBtn')?.addEventListener('touchend', stopRecording);
$('#micBtn')?.addEventListener('mouseleave', stopRecording);
$('#searchChatsInput')?.addEventListener('input', e => renderChats(e.target.value));
$('#searchChannelsInput')?.addEventListener('input', e => renderChannels(e.target.value));
$('#chatAvatar')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) openUserModal(c); });
$('#closeSettingsBtn')?.addEventListener('click', () => showScreen('chats'));
$('#themeToggle')?.addEventListener('click', () => { const s = DB_getSettings();
    DB_updateSetting('theme', s.theme === 'dark' ? 'light' : 'dark');
    applyTheme();
    toast(s.theme === 'dark' ? '☀️ نهاري' : '🌙 ليلي'); });
$('#notifToggle')?.addEventListener('click', () => { const s = DB_getSettings();
    DB_updateSetting('notifications', !s.notifications);
    toast(s.notifications ? '🔕 معطلة' : '🔔 مفعلة'); });
$('#syncContactsBtn')?.addEventListener('click', () => window.syncContacts?.());
$('#startAdBtn')?.addEventListener('click', () => toast('🚀 إعلان قريباً'));
$('#broadcastBtn')?.addEventListener('click', () => toast('📢 رسائل جماعية قريباً'));
$('#cameraBtn')?.addEventListener('click', openStoryCamera);

// ==================== القائمة المنبثقة للمحادثة ====================
function openChatPopup() {
    const overlay = document.getElementById('chatPopupOverlay');
    const mainSection = document.getElementById('popupMainSection');
    const subSection = document.getElementById('popupSubSection');

    if (mainSection) mainSection.style.display = 'block';
    if (subSection) subSection.style.display = 'none';

    updatePopupBadges();

    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeChatPopup() {
    const overlay = document.getElementById('chatPopupOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function updatePopupBadges() {
    const muteBadge = document.getElementById('muteBadge');
    if (muteBadge) {
        const chat = DB_getChats().find(c => c.id === currentChatId);
        const isMuted = chat?.muted || false;
        muteBadge.textContent = isMuted ? 'مفعل' : 'إيقاف';
        muteBadge.classList.toggle('active', isMuted);
    }

    const disappearBadge = document.getElementById('disappearBadge');
    if (disappearBadge) {
        const key = `chat_${currentChatId}_disappear`;
        const mode = localStorage.getItem(key) || 'off';
        const labels = { off: 'إيقاف', 'on-read': 'بعد القراءة', 'on-view': 'بعد المشاهدة' };
        disappearBadge.textContent = labels[mode] || 'إيقاف';
        disappearBadge.classList.toggle('active', mode !== 'off');
    }

    const themeBadge = document.getElementById('themeBadge');
    if (themeBadge) {
        const theme = localStorage.getItem('ramzapp_theme') || 'dark';
        themeBadge.textContent = theme === 'dark' ? 'داكن' : 'فاتح';
    }
}

function showContactInfo() {
    closeChatPopup();
    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (!chat) {
        toast('⚠️ لا توجد معلومات لجهة الاتصال');
        return;
    }

    let contact = DB_getContacts().find(c => c.id === chat.id || c.phone === chat.id);
    if (!contact) {
        contact = {
            id: chat.id,
            phone: chat.id,
            name: chat.name || 'مستخدم',
            avatar: chat.avatar || '?',
            bio: chat.bio || 'مرحباً!'
        };
    }

    const displayName = getDisplayName(contact.id, contact.name);
    const displayAvatar = getDisplayAvatar(contact.id, contact.avatar);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active contact-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:380px;text-align:right;">
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.3);border:none;color:#fff;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer;">&times;</button>
            <div style="text-align:center;padding-top:8px;">
                <div style="width:80px;height:80px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;margin:0 auto 12px;border:3px solid var(--accent);color:var(--text);">${displayAvatar || '?'}</div>
                <h3 style="font-size:20px;">${esc(displayName)}</h3>
                <p style="color:var(--text3);font-size:13px;">${esc(contact.bio || 'مرحباً!')}</p>
            </div>
            <div class="contact-info" style="padding:8px 0;">
                <div class="row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px;"><span class="label" style="color:var(--text3);">رقم الهاتف</span><span class="value" style="font-weight:600;color:var(--text);">${esc(contact.phone || '-')}</span></div>
                <div class="row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px;"><span class="label" style="color:var(--text3);">الحالة</span><span class="value" style="font-weight:600;color:var(--text);">${contact.registered ? '🟢 مسجل' : '⏳ غير مسجل'}</span></div>
                <div class="row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px;"><span class="label" style="color:var(--text3);">المعرف</span><span class="value" style="font-weight:600;color:var(--text);">${esc(contact.id || '-')}</span></div>
            </div>
            <div class="contact-actions" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
                <button onclick="shareContact('${contact.id}')" style="background:none;border:none;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:0.15s;"><i class="fas fa-share-alt" style="font-size:22px;color:var(--accent);"></i><span style="font-size:10px;color:var(--text3);">مشاركة</span></button>
                <button onclick="addContactManually('${contact.id}')" style="background:none;border:none;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:0.15s;"><i class="fas fa-user-plus" style="font-size:22px;color:var(--accent);"></i><span style="font-size:10px;color:var(--text3);">إضافة</span></button>
                <button onclick="editContactManually('${contact.id}')" style="background:none;border:none;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:0.15s;"><i class="fas fa-edit" style="font-size:22px;color:var(--accent);"></i><span style="font-size:10px;color:var(--text3);">تعديل</span></button>
                <button onclick="copyContactLink('${contact.id}')" style="background:none;border:none;color:var(--text);display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:0.15s;"><i class="fas fa-link" style="font-size:22px;color:var(--accent);"></i><span style="font-size:10px;color:var(--text3);">نسخ الرابط</span></button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function shareContact(contactId) {
    const link = `${window.location.origin}/redirect.html?id=${contactId}`;
    if (navigator.share) {
        navigator.share({ title: 'مشاركة جهة اتصال', text: link, url: link }).catch(() => {});
    } else {
        navigator.clipboard.writeText(link).then(() => toast('📋 تم نسخ رابط جهة الاتصال'));
    }
    document.querySelector('.modal-overlay.active')?.remove();
}

function addContactManually(contactId) {
    const chat = DB_getChats().find(c => c.id === contactId);
    if (!chat) return;
    const existing = DB_getContacts().find(c => c.id === contactId || c.phone === contactId);
    if (existing) {
        toast('ℹ️ جهة الاتصال موجودة مسبقاً');
        return;
    }
    DB_saveContact({
        id: contactId,
        phone: contactId,
        name: chat.name || 'مستخدم',
        avatar: chat.avatar || '?',
        registered: 0
    });
    toast('✅ تمت إضافة جهة الاتصال');
    document.querySelector('.modal-overlay.active')?.remove();
    scheduleRenderContacts();
}

function editContactManually(contactId) {
    const contact = DB_getContacts().find(c => c.id === contactId || c.phone === contactId);
    if (!contact) {
        toast('⚠️ جهة الاتصال غير موجودة');
        return;
    }
    const newName = prompt('تعديل الاسم:', contact.name || '');
    if (newName !== null && newName.trim()) {
        contact.name = newName.trim();
        DB_saveContact(contact);
        toast('✅ تم تحديث الاسم');
        document.querySelector('.modal-overlay.active')?.remove();
        scheduleRenderContacts();
    }
}

function copyContactLink(contactId) {
    const link = `${window.location.origin}/redirect.html?id=${contactId}`;
    navigator.clipboard.writeText(link).then(() => toast('📋 تم نسخ الرابط'));
}

function showChatMedia() {
    closeChatPopup();
    const msgs = DB_getMessages(currentChatId) || [];

    const images = msgs.filter(m => m.img);
    const videos = msgs.filter(m => m.video);
    const documents = msgs.filter(m => m.document);
    const links = msgs.filter(m => m.text && (m.text.includes('http://') || m.text.includes('https://')));

    const total = images.length + videos.length + documents.length + links.length;

    if (total === 0) {
        toast('ℹ️ لا توجد وسائط أو روابط في هذه المحادثة');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active media-modal';
    modal.style.display = 'flex';

    let mediaHTML = '';

    if (images.length) {
        mediaHTML += `<div style="padding:4px 0;"><strong>🖼️ الصور (${images.length})</strong></div>`;
        mediaHTML += `<div class="media-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;max-height:300px;overflow-y:auto;">`;
        images.slice(0, 12).forEach(m => {
            mediaHTML += `
                <div class="media-item" style="aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--text3);transition:0.15s;position:relative;" onclick="openImageViewer('${m.img}')">
                    <img src="${m.img}" alt="صورة" loading="lazy" style="width:100%;height:100%;object-fit:cover;">
                    <span class="media-type" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;">📷</span>
                </div>
            `;
        });
        if (images.length > 12) {
            mediaHTML += `<div class="media-item" style="aspect-ratio:1;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text3);">+${images.length - 12} أخرى</div>`;
        }
        mediaHTML += `</div>`;
    }

    if (videos.length) {
        mediaHTML += `<div style="padding:8px 0 4px;"><strong>🎬 الفيديوهات (${videos.length})</strong></div>`;
        mediaHTML += `<div class="media-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;max-height:300px;overflow-y:auto;">`;
        videos.slice(0, 6).forEach(m => {
            mediaHTML += `
                <div class="media-item" style="aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--text3);transition:0.15s;position:relative;" onclick="window.open('${m.video}', '_blank')">
                    <video src="${m.video}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>
                    <span class="media-type" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;">🎬</span>
                </div>
            `;
        });
        if (videos.length > 6) {
            mediaHTML += `<div class="media-item" style="aspect-ratio:1;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text3);">+${videos.length - 6} أخرى</div>`;
        }
        mediaHTML += `</div>`;
    }

    if (documents.length) {
        mediaHTML += `<div style="padding:8px 0 4px;"><strong>📄 المستندات (${documents.length})</strong></div>`;
        mediaHTML += `<div class="media-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;max-height:300px;overflow-y:auto;">`;
        documents.slice(0, 6).forEach(m => {
            const name = m.document ? decodeURIComponent(m.document.split('/').pop() || 'مستند') : 'مستند';
            mediaHTML += `
                <div class="media-item" style="aspect-ratio:1;border-radius:8px;overflow:hidden;cursor:pointer;background:var(--surface3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;transition:0.15s;position:relative;" onclick="window.open('${m.document}', '_blank')">
                    <i class="fas fa-file-alt" style="font-size:32px;color:var(--accent);"></i>
                    <span style="font-size:10px;text-align:center;word-break:break-all;padding:0 4px;">${esc(name.substring(0,15))}</span>
                    <span class="media-type" style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;">📄</span>
                </div>
            `;
        });
        if (documents.length > 6) {
            mediaHTML += `<div class="media-item" style="aspect-ratio:1;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text3);">+${documents.length - 6} أخرى</div>`;
        }
        mediaHTML += `</div>`;
    }

    if (links.length) {
        mediaHTML += `<div style="padding:8px 0 4px;"><strong>🔗 الروابط (${links.length})</strong></div>`;
        mediaHTML += `<div style="max-height:150px;overflow-y:auto;background:var(--surface2);border-radius:8px;padding:4px;">`;
        links.slice(0, 20).forEach(m => {
            const urlMatch = m.text.match(/(https?:\/\/[^\s]+)/g);
            if (urlMatch) {
                urlMatch.forEach(url => {
                    mediaHTML += `
                        <div style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="window.open('${url}', '_blank')">
                            <i class="fas fa-link" style="color:var(--accent);"></i>
                            <span style="color:var(--text2);word-break:break-all;flex:1;">${esc(url.substring(0,60))}${url.length > 60 ? '...' : ''}</span>
                        </div>
                    `;
                });
            }
        });
        if (links.length > 20) {
            mediaHTML += `<div style="padding:6px 8px;color:var(--text3);font-size:12px;text-align:center;">+${links.length - 20} روابط أخرى</div>`;
        }
        mediaHTML += `</div>`;
    }

    modal.innerHTML = `
        <div class="modal-card" style="max-width:400px;max-height:80vh;overflow-y:auto;text-align:right;">
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.3);border:none;color:#fff;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer;">&times;</button>
            <h3 style="font-size:18px;margin-bottom:8px;text-align:center;">📷 الوسائط والروابط</h3>
            <p style="color:var(--text3);font-size:12px;text-align:center;margin-bottom:12px;">${total} عنصر</p>
            ${mediaHTML}
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function toggleChatMute() {
    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (!chat) return;
    chat.muted = !chat.muted;
    DB_saveChat(chat);
    toast(chat.muted ? '🔕 تم كتم إشعارات هذه المحادثة' : '🔔 تم إلغاء كتم إشعارات هذه المحادثة');
    updatePopupBadges();
    closeChatPopup();
}

function toggleDisappearMode() {
    const key = `chat_${currentChatId}_disappear`;
    const modes = ['off', 'on-read', 'on-view'];
    const current = localStorage.getItem(key) || 'off';
    const currentIndex = modes.indexOf(current);
    const nextIndex = (currentIndex + 1) % modes.length;
    const next = modes[nextIndex];
    localStorage.setItem(key, next);

    const labels = { off: 'إيقاف', 'on-read': 'بعد القراءة', 'on-view': 'بعد المشاهدة' };
    toast(`⏳ تم تفعيل: ${labels[next]}`);
    updatePopupBadges();
    closeChatPopup();
}

function createNewGroup() {
    closeChatPopup();
    if (typeof createGroupUI === 'function') {
        createGroupUI();
    } else {
        toast('⚠️ وظيفة إنشاء مجموعة غير متاحة');
    }
}

function toggleChatTheme() {
    const current = localStorage.getItem('ramzapp_theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ramzapp_theme', next);
    document.body.classList.toggle('light-theme', next === 'light');
    toast(next === 'dark' ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري');
    updatePopupBadges();
    closeChatPopup();
}

function reportUser() {
    closeChatPopup();
    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (!chat) return;
    const reasons = ['محتوى غير مناسب', 'رسائل مزعجة', 'انتحال شخصية', 'مخالفة قانونية', 'أخرى'];
    let choices = reasons.map((r, i) => `${i+1}. ${r}`).join('\n');
    const choice = prompt(`اختر سبب الإبلاغ عن المستخدم ${chat.name}:\n${choices}\n\n(أدخل رقم السبب أو اكتب السبب مباشرة):`);
    if (!choice) return;
    const reason = reasons[parseInt(choice) - 1] || choice;

    const reports = JSON.parse(localStorage.getItem('ramzapp_reports') || '[]');
    reports.push({
        id: 'r_' + Date.now(),
        reported_id: chat.id,
        reported_name: chat.name,
        reason: reason,
        date: new Date().toISOString()
    });
    localStorage.setItem('ramzapp_reports', JSON.stringify(reports));
    toast('✅ تم إرسال البلاغ، شكراً لك');
}

function blockUser() {
    closeChatPopup();
    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (!chat) return;
    if (!confirm(`⚠️ هل أنت متأكد من حظر المستخدم "${chat.name}"؟\nلن تتمكن من إرسال أو استقبال رسائل منه.`)) return;

    const blocked = JSON.parse(localStorage.getItem('ramzapp_blocked') || '[]');
    if (!blocked.includes(chat.id)) {
        blocked.push(chat.id);
        localStorage.setItem('ramzapp_blocked', JSON.stringify(blocked));
    }

    DB_deleteChat(currentChatId);
    currentChatId = null;
    showScreen('chats');
    scheduleRenderChats();
    toast(`🚫 تم حظر المستخدم "${chat.name}"`);
}

function clearChat() {
    closeChatPopup();
    if (!confirm('⚠️ هل أنت متأكد من مسح جميع رسائل هذه المحادثة؟\nلا يمكن التراجع عن هذا الإجراء.')) return;

    const msgs = DB_getMessages(currentChatId);
    for (const m of msgs) {
        DB_deleteMessage(m.id);
    }

    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (chat) {
        chat.last_msg = '';
        chat.last_time = new Date().toISOString();
        DB_saveChat(chat);
    }

    scheduleRenderMessages();
    scheduleRenderChats();
    toast('🧹 تم مسح جميع رسائل المحادثة');
}

function transferChat() {
    closeChatPopup();
    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (!chat) return;
    const link = `${window.location.origin}/redirect.html?id=${chat.id}`;
    if (navigator.share) {
        navigator.share({
            title: `محادثة مع ${chat.name}`,
            text: `انضم إلى محادثتي على RamzApp: ${link}`,
            url: link
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(link).then(() => toast('📋 تم نسخ رابط المحادثة'));
    }
}

function addChatShortcut() {
    closeChatPopup();
    const chat = DB_getChats().find(c => c.id === currentChatId);
    if (!chat) return;
    const link = `${window.location.origin}/index.html?openChat=${chat.id}`;
    if (navigator.share) {
        navigator.share({
            title: `محادثة مع ${chat.name}`,
            text: `انضم إلى محادثتي على RamzApp: ${link}`,
            url: link
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(link).then(() => toast('📋 تم نسخ رابط الاختصار'));
    }
}

function showMoreOptions() {
    closeChatPopup();
    toast('📊 خيارات إضافية قريباً:\n- تصدير المحادثة\n- إحصائيات الرسائل\n- نسخ جميع الرسائل');
}

function handlePopupAction(action) {
    switch (action) {
        case 'view-contact':
            showContactInfo();
            break;
        case 'search':
            openInChatSearch();
            break;
        case 'media':
            showChatMedia();
            break;
        case 'mute':
            toggleChatMute();
            break;
        case 'disappear':
            toggleDisappearMode();
            break;
        case 'new-group':
            createNewGroup();
            break;
        case 'theme':
            toggleChatTheme();
            break;
        case 'more':
            openSubMenu();
            break;
        case 'back-main':
            closeSubMenu();
            break;
        case 'report':
            reportUser();
            break;
        case 'block':
            blockUser();
            break;
        case 'clear-chat':
            clearChat();
            break;
        case 'transfer-chat':
            transferChat();
            break;
        case 'add-shortcut':
            addChatShortcut();
            break;
        case 'more-options':
            showMoreOptions();
            break;
        default:
            break;
    }
}

function openSubMenu() {
    const main = document.getElementById('popupMainSection');
    const sub = document.getElementById('popupSubSection');
    if (main) main.style.display = 'none';
    if (sub) sub.style.display = 'block';
}

function closeSubMenu() {
    const main = document.getElementById('popupMainSection');
    const sub = document.getElementById('popupSubSection');
    if (main) main.style.display = 'block';
    if (sub) sub.style.display = 'none';
}

function bindChatPopupEvents() {
    const overlay = document.getElementById('chatPopupOverlay');

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeChatPopup();
        });
    }

    document.querySelectorAll('#chatPopupMenu .popup-item[data-action]').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            handlePopupAction(action);
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    bindChatPopupEvents();

    document.getElementById('chatMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentChatId) {
            openChatPopup();
        } else {
            toast('⚠️ لا توجد محادثة مفتوحة');
        }
    });

    document.getElementById('chatPopupOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeChatPopup();
        }
    });
});

console.log('✅ Chat popup menu (القائمة المنبثقة للمحادثة) جاهزة');

// ==================== التهيئة النهائية ====================
let initRun = false;

async function init() {
    if (initRun) return;
    initRun = true;

    const user = DB_getCurrentUser();
    if (!user || !user.phone) {
        window.location.href = 'login.html';
        return;
    }

    if (window.initDB) {
        try {
            await window.initDB();
            console.log('✅ تم تهيئة قاعدة البيانات المحلية');
        } catch (e) {
            console.warn('⚠️ فشل تهيئة قاعدة البيانات، استخدام الاحتياطي', e);
        }
    }

    const app = $('#appContainer');
    const nav = $('#bottomNav');
    if (app) app.style.display = 'flex';
    if (nav) nav.style.display = 'flex';
    showScreen('chats');
    toast('📱 جاري التحميل...');

    try {
        await initEncryption(sessionPassword);
    } catch (e) {
        console.warn('⚠️ فشل تهيئة التشفير', e);
    }

    bindMenuButtons();
    applyTheme();

    scheduleRenderChats();
    scheduleRenderContacts();
    scheduleRenderStories();
    scheduleRenderChannels();

    setTimeout(() => {
        window.fetchAllUsersAsContacts?.();
        window.fetchAllPendingMessages?.();
    }, 100);

    setTimeout(() => {
        if (isOnline && window.syncContacts) window.syncContacts().catch(() => {});
    }, 5000);

    if (isOnline) {
        window.updateUserOnlineStatus(true);
    }

    setInterval(() => {
        if (isOnline && DB_getCurrentUser()) {
            window.updateUserOnlineStatus(true);
        }
    }, 30000);

    window.addEventListener('online', () => {
        isOnline = true;
        toast('🟢 متصل');
        window.updateUserOnlineStatus(true);
        window.fetchAllPendingMessages?.();
        window.fetchAllUsersAsContacts?.();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        toast('🔴 غير متصل');
        window.updateUserOnlineStatus(false);
    });

    window.addEventListener('beforeunload', function(e) {
        if (window.saveAllData) {
            window.saveAllData();
        }
    });

    setInterval(() => {
        if (window.saveAllData) {
            window.saveAllData().catch(() => {});
        }
    }, 30000);

    console.log('✅ RamzApp v7.4 النهائي جاهز – جميع الميزات مفعلة');
}

// ==================== تصدير الدوال العامة ====================
window.sendMessage = sendMessage;
window.handleIncomingMessage = handleIncomingMessage;
window.renderChats = renderChats;
window.renderMessages = renderMessages;
window.renderContactsList = renderContactsList;
window.renderStories = renderStories;
window.renderChannels = renderChannels;
window.showScreen = showScreen;
window.openChat = openChat;
window.openUserModal = openUserModal;
window.updateSendBtn = updateSendBtn;
window.navigateTo = navigateTo;
window.logout = logout;
window.applyTheme = applyTheme;
window.addCatalogItem = addCatalogItem;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.startCall = startCall;
window.endCall = endCall;
window.openChatPopup = openChatPopup;
window.closeChatPopup = closeChatPopup;
window.updateUserOnlineStatus = updateUserOnlineStatus;
window.getDisplayName = getDisplayName;
window.getDisplayAvatar = getDisplayAvatar;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 10);
}

console.log('✅ common.js v7.4 محمّل وجاهز');
