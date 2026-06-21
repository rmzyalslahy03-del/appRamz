// ======================================================================
// common.js - الإصدار النهائي v6.4 (المستقر والكامل)
// جميع الميزات مفعلة | الهاتف هو المصدر | Supabase وسيط مؤقت
// ======================================================================

console.log('🚀 common.js v6.4 (النسخة النهائية الكاملة) بدأ التحميل...');

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

    // إنشاء مفاتيح جديدة (لأول مرة)
    console.log('🆕 إنشاء مفاتيح جديدة للمستخدم');
    currentUserKeyPair = await generateKeyPair();
    const pubBase64 = await exportPublicKey(currentUserKeyPair.publicKey);
    const privBase64 = await exportPrivateKey(currentUserKeyPair.privateKey);

    // إذا كان هناك كلمة مرور، نخزن المفاتيح مشفرة
    if (password) {
        await saveKeyPairToStorage(userId, pubBase64, privBase64, password);
    } else {
        // وضع الضيف: تخزين عادي (أقل أماناً)
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
async function fetchPeerPublicKey(peerId) {
    if (peerPublicKeys[peerId]) return peerPublicKeys[peerId];
    if (!window.supabaseClient) return null;
    try {
        const { data } = await window.supabaseClient.from('users').select('public_key').eq('phone', peerId).single();
        if (data?.public_key) {
            const key = await importPublicKey(data.public_key);
            if (key) { peerPublicKeys[peerId] = key; return key; }
        }
    } catch(e) {}
    return null;
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
            } else msg.text = '🔒 رسالة مشفرة';
        }
        onMessage?.(msg);
    });
    channel.on('broadcast', { event: 'typing' }, (payload) => {
        if (!isOnline) return;
        onTyping?.(payload.payload.userId, payload.payload.isTyping);
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

window.sendMessageRealtime = async function(msg) {
    if (!window.supabaseClient || !isOnline) return { success: false, offline: true };
    const chatId = msg.chat_id;
    if (!chatId) return { success: false, error: 'معرف المحادثة مطلوب' };

    let channel = activeChannels[chatId];
    if (!channel) {
        channel = window.supabaseClient.channel(`chat:${chatId}`, { config: { broadcast: { self: false } } });
        await channel.subscribe();
        activeChannels[chatId] = channel;
    }

    try {
        await channel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: msg
        });
        await window.supabaseClient.from('pending_messages').insert({
            message_id: msg.id,
            chat_id: chatId,
            sender_id: msg.sender_id || 'me',
            recipient_chat_id: chatId,
            payload: msg,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        });
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
let sessionPassword = null; // كلمة المرور المؤقتة للتشفير

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

// ==================== المكالمات ====================
function startCall(user, type) {
    $('#callAvatar').textContent = user.avatar || '?';
    $('#callStatusText').textContent = type === 'video' ? '📹 جاري الاتصال فيديو...' : '📞 جاري الاتصال...';
    $('#callTimer').textContent = '00:00';
    callSeconds = 0;
    $('#callScreen').classList.add('active');
    DB_addCall({ id: 'ca'+Date.now(), name: user.name, avatar: user.avatar, time: 'الآن', type: type==='video'?'video':'outgoing' });
    setTimeout(() => {
        $('#callStatusText').textContent = 'متصل 🟢';
        if (callInterval) clearInterval(callInterval);
        callInterval = setInterval(() => {
            callSeconds++;
            const m = Math.floor(callSeconds/60).toString().padStart(2,'0');
            const s = (callSeconds%60).toString().padStart(2,'0');
            $('#callTimer').textContent = m+':'+s;
        }, 1000);
    }, 2000);
}
function endCall() {
    if (callInterval) clearInterval(callInterval);
    callInterval = null; callSeconds = 0;
    $('#callScreen').classList.remove('active');
}
function renderCallsImmediate() {
    const container = $('#callsList');
    if (!container) return;
    const calls = DB_getCalls();
    const frag = document.createDocumentFragment();
    if (!calls.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<i class="fas fa-phone-slash"></i><p>لا توجد مكالمات</p>';
        frag.appendChild(empty);
    } else {
        calls.forEach(c => {
            const item = document.createElement('div');
            item.className = 'call-item';
            item.innerHTML = `<div class="call-avatar">${c.avatar}</div><div class="item-info"><div class="item-title">${esc(c.name)}</div><div class="item-sub">${c.type==='incoming'?'📥 واردة':c.type==='video'?'📹 فيديو':'📤 صادرة'} • ${c.time}</div></div><i class="fas fa-phone" style="color:var(--accent);"></i>`;
            item.addEventListener('click', () => toast('📞 إعادة الاتصال بـ '+esc(c.name)));
            frag.appendChild(item);
        });
    }
    container.innerHTML = '';
    container.appendChild(frag);
}
function renderCalls() { queueRender(() => renderCallsImmediate()); }

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

            const avatar = document.createElement('div');
            avatar.className = 'chat-avatar';
            avatar.dataset.id = c.id;
            avatar.textContent = c.avatar || '?';
            if (c.online) {
                const dot = document.createElement('span');
                dot.className = 'online-dot';
                avatar.appendChild(dot);
            }
            avatar.addEventListener('click', (e) => { e.stopPropagation(); const chat = DB_getChats().find(x => x.id === c.id); if (chat) openUserModal(chat); });

            const info = document.createElement('div');
            info.className = 'chat-info';

            const nameRow = document.createElement('div');
            nameRow.className = 'chat-name-row';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'chat-name';
            nameSpan.innerHTML = (c.pinned ? '<i class="fas fa-thumbtack pinned-icon"></i> ' : '') + esc(c.name);
            const timeSpan = document.createElement('span');
            timeSpan.className = 'chat-time';
            timeSpan.textContent = c.last_time ? timeAgo(c.last_time) : '';
            nameRow.appendChild(nameSpan); nameRow.appendChild(timeSpan);

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

            info.appendChild(nameRow); info.appendChild(preview);
            item.appendChild(avatar); item.appendChild(info);
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

// ==================== عرض الرسائل ====================
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
            playBtn.onclick = function(e) { e.stopPropagation(); playVoice(this); };
            const wave = document.createElement('div');
            wave.className = 'voice-wave';
            for (let i=0;i<8;i++) { const bar = document.createElement('div'); bar.className = 'voice-wave-bar'; wave.appendChild(bar); }
            const dur = document.createElement('span');
            dur.style.cssText = 'font-size:10px;color:var(--text3);';
            dur.textContent = m.voice_duration || '0:00';
            voiceDiv.appendChild(playBtn); voiceDiv.appendChild(wave); voiceDiv.appendChild(dur);
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
        timeRow.innerHTML = `<span>${fmtTime(m.time)}</span>`;
        if (isMe) {
            if (m.status === 'read' || m.sync_status === 'read') timeRow.innerHTML += '<i class="fas fa-check-double" style="color:#4fc3f7;"></i>';
            else if (m.status === 'delivered' || m.sync_status === 'delivered') timeRow.innerHTML += '<i class="fas fa-check-double"></i>';
            else if (m.status === 'sent' || m.sync_status === 'sent') timeRow.innerHTML += '<i class="fas fa-check"></i>';
            else if (m.sync_status === 'pending-send') timeRow.innerHTML += '<span style="font-size:10px;">⏳</span>';
            else if (m.sync_status === 'failed') timeRow.innerHTML += '<span style="font-size:10px;color:#ff4444;">⚠️</span>';
        }

        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        const likeBtn = document.createElement('button');
        likeBtn.className = m.liked ? 'liked' : '';
        likeBtn.dataset.id = m.id; likeBtn.dataset.act = 'like';
        likeBtn.innerHTML = `<i class="${m.liked?'fas':'far'} fa-heart"></i> ${m.likes||0}`;
        likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(m.id); };
        const replyBtn = document.createElement('button');
        replyBtn.dataset.id = m.id; replyBtn.dataset.act = 'reply';
        replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
        replyBtn.onclick = (e) => { e.stopPropagation(); setReply(m.id); };
        actions.appendChild(likeBtn); actions.appendChild(replyBtn);

        if (isMe) {
            const editBtn = document.createElement('button');
            editBtn.dataset.id = m.id; editBtn.dataset.act = 'edit';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.onclick = (e) => { e.stopPropagation(); editMessage(m.id); };
            const delBtn = document.createElement('button');
            delBtn.dataset.id = m.id; delBtn.dataset.act = 'delete';
            delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            delBtn.onclick = (e) => { e.stopPropagation(); deleteMsg(m.id); };
            actions.appendChild(editBtn); actions.appendChild(delBtn);
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
function renderMessages() { queueRender(() => renderMessagesImmediate()); }

// ==================== دوال الرسائل ====================
function playVoice(btn) {
    const audio = new Audio(btn.dataset.audio);
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fas fa-pause';
    audio.play();
    audio.onended = () => { if (icon) icon.className = 'fas fa-play'; };
    btn.onclick = (e) => { e.stopPropagation(); if (audio.paused) { audio.play(); if (icon) icon.className = 'fas fa-pause'; } else { audio.pause(); if (icon) icon.className = 'fas fa-play'; } };
}
function openImageViewer(src) { $('#viewerImage').src = src; $('#imageViewer').classList.add('active'); }
$('#closeImageViewer')?.addEventListener('click', () => $('#imageViewer')?.classList.remove('active'));
$('#imageViewer')?.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });

function toggleLike(mid) {
    if (!currentChatId) return;
    const m = DB_getMessages(currentChatId).find(x => x.id === mid);
    if (m) { m.liked = !m.liked; m.likes = (m.likes||0)+(m.liked?1:-1); if (m.likes<0) m.likes=0; DB_updateMessage(mid, { liked: m.liked, likes: m.likes }); scheduleRenderMessages(); }
}
function deleteMsg(mid) { if (!currentChatId || !confirm('حذف الرسالة؟')) return; DB_deleteMessage(mid); updateLastMsg(); scheduleRenderMessages(); toast('🗑 تم الحذف'); }
function setReply(mid) {
    const m = DB_getMessages(currentChatId).find(x => x.id === mid);
    if (m) { replyTarget = m; $('#replyPreview').textContent = (m.text||(m.voice_blob?'🎤':'📎')).substring(0,50); $('#replyBar').style.display = 'flex'; $('#msgInput')?.focus(); }
}
function editMessage(mid) {
    if (!currentChatId) return;
    const m = DB_getMessages(currentChatId).find(x => x.id === mid);
    if (m && (m.sender_id==='me'||m.sender_id===DB_getCurrentUser()?.phone)) {
        const newText = prompt('تعديل:', m.text||'');
        if (newText !== null && newText.trim()!=='') { DB_updateMessage(mid, { text: newText.trim() }); updateLastMsg(); scheduleRenderMessages(); toast('✅ تم التعديل'); }
    }
}
function updateLastMsg() {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c && msgs.length) { const l = msgs[msgs.length-1]; c.last_msg = l.text || (l.voice_blob?'🎤':l.img?'📷':'📎'); c.last_time = l.time; DB_saveChat(c); }
}

// ==================== فتح المحادثة ====================
function openChat(chatId) {
    currentChatId = chatId;
    const c = DB_getChats().find(x => x.id === chatId);
    if (!c) return;

    const nameEl = $('#chatNameDisp');
    const avatarEl = $('#chatAvatar');
    const statusEl = $('#chatStatusDisp');
    if (nameEl) nameEl.textContent = c.name || 'محادثة';
    if (avatarEl) avatarEl.textContent = c.avatar || '?';
    if (statusEl) {
        statusEl.textContent = c.online ? '🟢 متصل الآن' : '📱 غير متصل';
        statusEl.className = 'chat-header-status' + (c.online ? ' online' : '');
    }

    c.unread = 0; c._typing = null; DB_saveChat(c);
    replyTarget = null; pendingImg = null; pendingVoice = null; pendingVideo = null; pendingDocument = null;
    $('#replyBar').style.display = 'none';
    const inp = $('#msgInput'); if (inp) inp.value = '';

    scheduleRenderMessages();
    updateSendBtn();
    showScreen('chat');

    if (window.subscribeToChat) {
        window.subscribeToChat(chatId, handleIncomingMessage, (senderId, isTyping) => {
            const chat = DB_getChats().find(x => x.id === chatId);
            if (!chat) return;
            const curId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;
            if (senderId !== curId) {
                chat._typing = isTyping ? Date.now() : null;
                const st = $('#chatStatusDisp');
                if (st) {
                    st.textContent = isTyping ? '✍️ يكتب الآن...' : (chat.online ? '🟢 متصل الآن' : '📱 غير متصل');
                    st.className = 'chat-header-status' + (isTyping ? ' typing' : (chat.online ? ' online' : ''));
                }
                DB_saveChat(chat);
                scheduleRenderChats();
            }
        });
    }
    setTimeout(() => inp?.focus(), 300);
    scheduleRenderChats();
}

// ==================== إرسال رسالة (محسن بالكامل) ====================
async function sendMessage() {
    if (!currentChatId) return;
    const inp = $('#msgInput');
    const text = inp?.value.trim();

    // إذا كان هناك تسجيل صوتي قيد التقدم، ننهيه أولاً
    if (isRecording) {
        if (mediaRecorder?.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;
        $('#micBtn')?.classList.remove('recording');
        // ننتظر حتى يتم معالجة الصوت في onstop
        return;
    }

    // التحقق من وجود محتوى
    if (!text && !pendingImg && !pendingVoice && !pendingVideo && !pendingDocument) {
        return;
    }

    // تحديد نوع المحتوى
    let msgText = text || '';
    if (pendingVoice) msgText = '🎤 رسالة صوتية';
    else if (pendingImg) msgText = '📷 صورة';
    else if (pendingVideo) msgText = '🎬 فيديو';
    else if (pendingDocument) msgText = '📄 مستند';

    // تشفير الرسالة (E2EE)
    let encryptedPayload = null;
    if (isOnline && currentUserKeyPair) {
        const peerKey = await fetchPeerPublicKey(currentChatId);
        if (peerKey) {
            const secret = await deriveSharedSecret(currentUserKeyPair.privateKey, peerKey);
            encryptedPayload = await encryptText(msgText, secret);
            msgText = '🔒 رسالة مشفرة';
        }
    }

    const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        chat_id: currentChatId,
        sender_id: 'me',
        text: msgText,
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

    // إضافة الرسالة للتخزين المحلي
    DB_addMessage(msg);

    // تنظيف المدخلات
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

    // محاولة الإرسال عبر Supabase
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

// ==================== معالجة الرسائل الواردة ====================
async function handleIncomingMessage(msg) {
    if (!msg || msg.sender_id === 'me') return;
    const curId = DB_getCurrentUser()?.phone || DB_getCurrentUser()?.id;
    if (msg.sender_id === curId) return;
    if (DB_getMessages(msg.chat_id).find(m => m.id === msg.id)) return;

    msg.sync_status = 'delivered'; msg.status = 'delivered';
    DB_addMessage(msg);

    const chat = DB_getChats().find(c => c.id === msg.chat_id);
    if (chat) {
        chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
        chat.last_time = msg.time;
        if (!chat.online) chat.unread = (chat.unread||0)+1;
        DB_saveChat(chat);
    }

    if (currentChatId === msg.chat_id) scheduleRenderMessages();
    scheduleRenderChats();
    playNotificationSound();
}

// ==================== التسجيل الصوتي (محسن بالكامل) ====================
async function startRecording(e) {
    e.preventDefault();
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        $('#micBtn')?.classList.add('recording');
        toast('🎤 جاري التسجيل... اضغط زر الإرسال لإنهاء', 3000);

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
                // إرسال الصوت تلقائياً بعد التسجيل
                sendMessage();
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
            isRecording = false;
        };

        mediaRecorder.start();

        // إيقاف التسجيل عند رفع الإصبع (حدث mouseup/touchend)
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

        // حد أقصى للتسجيل 15 ثانية (احتياطي)
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

// ==================== إرفاق ملفات (محسن) ====================
$('#attachBtn')?.addEventListener('click', () => {
    $('#attachSheet')?.classList.add('open');
    $('#attachOverlay')?.classList.add('active');
});

$('#closeAttachBtn')?.addEventListener('click', () => {
    $('#attachSheet')?.classList.remove('open');
    $('#attachOverlay')?.classList.remove('active');
});

$('#attachOverlay')?.addEventListener('click', () => {
    $('#attachSheet')?.classList.remove('open');
    $('#attachOverlay')?.classList.remove('active');
});

const hiddenFileInput = $('#hiddenFileInput');
$$('.attach-option')?.forEach(o => o.addEventListener('click', () => {
    const type = o.dataset.type;
    if (type === 'gallery') {
        hiddenFileInput.accept = 'image/*,video/*';
        hiddenFileInput.click();
    } else if (type === 'camera') {
        hiddenFileInput.accept = 'image/*';
        hiddenFileInput.capture = 'environment';
        hiddenFileInput.click();
    } else if (type === 'document') {
        hiddenFileInput.accept = '.pdf,.doc,.docx,.txt,.zip';
        hiddenFileInput.click();
    } else if (type === 'contact') {
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
    }
    $('#attachSheet')?.classList.remove('open');
    $('#attachOverlay')?.classList.remove('active');
}));

hiddenFileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                const r = new FileReader();
                r.onload = ev => {
                    pendingImg = ev.target.result;
                    toast('📷 صورة جاهزة، جاري الإرسال...');
                    updateSendBtn();
                    sendMessage(); // إرسال مباشر
                };
                r.readAsDataURL(f);
            } else if (f.type.startsWith('video/')) {
                const r = new FileReader();
                r.onload = ev => {
                    pendingVideo = ev.target.result;
                    toast('🎬 فيديو جاهز، جاري الإرسال...');
                    updateSendBtn();
                    sendMessage();
                };
                r.readAsDataURL(f);
            } else {
                // ملفات أخرى (مستندات)
                const r = new FileReader();
                r.onload = ev => {
                    pendingDocument = ev.target.result;
                    toast('📄 مستند جاهز، جاري الإرسال...');
                    updateSendBtn();
                    sendMessage();
                };
                r.readAsDataURL(f);
            }
        });
    }
    hiddenFileInput.value = '';
});

// ==================== نافذة المستخدم ====================
function openUserModal(user) {
    selectedModalUser = user;
    $('#modalAvatar').textContent = user.avatar || '?';
    $('#modalName').textContent = user.name || 'مستخدم';
    $('#modalBio').textContent = user.bio || 'مرحباً! أنا في RamzApp 💬';
    $('#userModal').classList.add('active');
}
$('#closeModalBtn')?.addEventListener('click', () => $('#userModal').classList.remove('active'));
$('#userModal')?.addEventListener('click', e => { if (e.target === $('#userModal')) $('#userModal').classList.remove('active'); });
$('#modalChatBtn')?.addEventListener('click', () => { if (selectedModalUser) startOrOpenChat(selectedModalUser); $('#userModal').classList.remove('active'); });
$('#modalCallBtn')?.addEventListener('click', () => { if (selectedModalUser) startCall(selectedModalUser, 'voice'); $('#userModal').classList.remove('active'); });
$('#modalVideoBtn')?.addEventListener('click', () => { if (selectedModalUser) startCall(selectedModalUser, 'video'); $('#userModal').classList.remove('active'); });

// ==================== جهات الاتصال ====================
function renderContactsImmediate() {
    const container = $('#contactsList');
    if (!container) return;
    const contacts = DB_getContacts();
    const reg = contacts.filter(c => c.registered);
    const unreg = contacts.filter(c => !c.registered);
    const frag = document.createDocumentFragment();

    const addHeader = (title, count) => {
        const h = document.createElement('div');
        h.className = 'section-header';
        h.innerHTML = `<h3>${title} (${count})</h3>`;
        frag.appendChild(h);
    };

    addHeader('✅ المسجلين في RamzApp', reg.length);
    if (reg.length) {
        reg.forEach(c => {
            const el = document.createElement('div');
            el.className = 'channel-item contact-item';
            el.dataset.id = c.id;
            el.innerHTML = `
                <div class="channel-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '📞'}</div>
                <div class="item-info"><div class="item-title">${esc(c.name||c.phone)}</div><div class="item-sub">${c.phone} • مسجل</div></div>
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

    addHeader('⏳ غير المسجلين', unreg.length);
    if (unreg.length) {
        unreg.forEach(c => {
            const el = document.createElement('div');
            el.className = 'channel-item contact-item';
            el.dataset.phone = c.phone;
            el.innerHTML = `
                <div class="channel-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '📞'}</div>
                <div class="item-info"><div class="item-title">${esc(c.name||c.phone)}</div><div class="item-sub">${c.phone} • غير مسجل</div></div>
                <button class="promo-btn invite-btn" style="padding:4px 10px;font-size:11px;" data-phone="${c.phone}">دعوة</button>
            `;
            el.querySelector('.invite-btn')?.addEventListener('click', (e) => { e.stopPropagation(); inviteContact(c.phone); });
            frag.appendChild(el);
        });
    } else {
        const p = document.createElement('p');
        p.style.cssText = 'color:var(--text3);padding:8px 16px;';
        p.textContent = 'لا يوجد جهات اتصال غير مسجلة';
        frag.appendChild(p);
    }

    container.innerHTML = '';
    container.appendChild(frag);
}
function renderContactsList() { queueRender(() => renderContactsImmediate()); }

function startOrOpenChat(user) {
    let chat = DB_getChats().find(c => c.id === user.id || c.phone === user.phone);
    if (!chat) {
        const chatId = user.phone || user.id;
        chat = { id: chatId, phone: user.phone, name: user.name, avatar: user.avatar || '?', last_msg: '', last_time: new Date().toISOString(), unread:0, online:false, pinned:false, bio: user.bio || '' };
        DB_saveChat(chat);
    }
    openChat(chat.id);
}

async function inviteContact(phone) {
    const msg = `انضم إلى RamzApp: https://ramzapp.com/download`;
    if (navigator.share) { try { await navigator.share({ title: 'دعوة', text: msg }); } catch(e) {} }
    else { try { await navigator.clipboard.writeText(msg); toast('📋 تم نسخ الدعوة'); } catch(e) { toast('📋 رابط: https://ramzapp.com/download'); } }
}

// ==================== القصص ====================
function renderStoriesImmediate() {
    const bar = $('#storyBar');
    if (!bar) return;
    const now = new Date().toISOString();
    const stories = DB_getStories().filter(s => s.expires_at > now).sort((a,b) => new Date(b.time)-new Date(a.time));
    if (!stories.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const frag = document.createDocumentFragment();
    const add = document.createElement('div');
    add.className = 'story-item story-add';
    add.onclick = openStoryCamera;
    add.innerHTML = '<div class="story-ring"><span>+</span></div><div class="story-name">إضافة</div>';
    frag.appendChild(add);
    stories.slice(0,10).forEach((s,i) => {
        const item = document.createElement('div');
        item.className = 'story-item';
        item.onclick = () => openStoryViewer(i);
        item.innerHTML = `<div class="story-ring ${s.isViewed?'viewed':''}"><div class="story-avatar" style="background:${s.color||'#ff0050'};">${s.avatar||'📷'}</div></div><div class="story-name">${esc(s.name)}</div>`;
        frag.appendChild(item);
    });
    bar.innerHTML = '';
    bar.appendChild(frag);
}
function renderStories() { queueRender(() => renderStoriesImmediate()); }

function openStoryCamera() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const user = DB_getCurrentUser();
            const story = {
                id: 's_'+Date.now(), user_id: user.phone || user.id, name: user.name || 'مستخدم', avatar: user.avatar || '📷',
                type: file.type.startsWith('image/') ? 'image' : 'video', content: ev.target.result,
                time: new Date().toISOString(), expires_at: new Date(Date.now()+86400000).toISOString(), isViewed: false,
                color: '#'+Math.floor(Math.random()*16777215).toString(16)
            };
            DB_addStory(story); renderStories(); toast('✅ تم النشر');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function openStoryViewer(index) {
    const now = new Date().toISOString();
    const stories = DB_getStories().filter(s => s.expires_at > now).sort((a,b) => new Date(b.time)-new Date(a.time));
    if (index >= stories.length) { toast('🎬 انتهت القصص'); return; }
    const story = stories[index];
    const viewer = document.createElement('div');
    viewer.className = 'story-viewer-active';
    viewer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    viewer.innerHTML = `
        <div style="position:absolute;top:20px;left:20px;right:20px;display:flex;gap:4px;">${stories.map((_,i)=>`<div style="flex:1;height:3px;background:${i<=index?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.3)'};border-radius:2px;overflow:hidden;">${i===index?'<div style="height:100%;background:#fff;width:0%;" id="storyProgressFill"></div>':''}</div>`).join('')}</div>
        <button style="position:absolute;top:20px;right:20px;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:24px;width:44px;height:44px;border-radius:50%;cursor:pointer;" onclick="this.closest('.story-viewer-active').remove()">✕</button>
        <div style="max-width:400px;max-height:80vh;width:100%;display:flex;align-items:center;justify-content:center;">
            ${story.type==='image'?`<img src="${story.content}" style="max-width:100%;max-height:70vh;border-radius:12px;">`:story.type==='video'?`<video src="${story.content}" controls autoplay style="max-width:100%;max-height:70vh;border-radius:12px;"></video>`:`<div style="background:rgba(255,255,255,0.1);padding:30px;border-radius:16px;color:#fff;font-size:24px;">${esc(story.content)}</div>`}
        </div>
    `;
    document.body.appendChild(viewer);
    const fill = document.getElementById('storyProgressFill');
    if (fill) {
        let p = 0;
        const interval = setInterval(() => {
            p += 1; fill.style.width = p + '%';
            if (p >= 100) {
                clearInterval(interval);
                story.isViewed = true; DB_updateStory(story.id, { isViewed: true });
                viewer.remove();
                if (index+1 < stories.length) openStoryViewer(index+1);
                else { renderStories(); toast('🎬 انتهت القصص'); }
            }
        }, 50);
    }
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
        a.click(); toast('💾 تم التصدير');
    }
};
window.importData = function() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const success = window.importAllData ? await window.importAllData(ev.target.result) : false;
                    if (success) { toast('✅ تم الاستيراد'); location.reload(); }
                    else toast('❌ ملف غير صالح');
                } catch(e) { toast('❌ فشل القراءة'); }
            };
            reader.readAsText(file);
        }
    };
    inp.click();
};
window.clearAllData = function() {
    if (confirm('⚠️ حذف جميع البيانات؟')) { DB_clearAllData(); toast('🗑 تم الحذف'); setTimeout(() => location.reload(), 500); }
};

// ==================== تحديث دالة logout (محسنة مع حفظ البيانات) ====================
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
    const screens = ['chatsScreen','chatScreen','contactsScreen','callsScreen','updatesScreen','toolsScreen','profileScreen','settingsScreen'];
    screens.forEach(s => { const el = document.getElementById(s); if (el) el.classList.remove('active'); });
    const target = document.getElementById(id + 'Screen') || document.getElementById(id);
    if (target) target.classList.add('active');
    const noNav = ['chatScreen','profileScreen','settingsScreen'];
    const bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = noNav.includes(id+'Screen') || noNav.includes(id) ? 'none' : 'flex';
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    if (id === 'chats') scheduleRenderChats();
    else if (id === 'contacts') scheduleRenderContacts();
    else if (id === 'calls') scheduleRenderCalls();
    else if (id === 'updates') { scheduleRenderStories(); scheduleRenderChannels(); }
    else if (id === 'tools') {}
}
window.navigateTo = function(screen) {
    const map = { feed:'chats', chats:'chats', contacts:'contacts', calls:'calls', updates:'updates', tools:'tools', profile:'profile', settings:'settings' };
    showScreen(map[screen] || screen);
};
$$('.nav-item').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.nav)));

// ==================== تحديث زر الإرسال (محسن مع المرفقات) ====================
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
    if (currentChatId) { window.unsubscribeFromChat?.(currentChatId); currentChatId = null; }
    showScreen('chats');
});
$('#cancelReplyBtn')?.addEventListener('click', () => { replyTarget = null; $('#replyBar').style.display = 'none'; });
$('#sendMsgBtn')?.addEventListener('click', sendMessage);
$('#msgInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
$('#msgInput')?.addEventListener('input', () => { updateSendBtn(); window.sendTypingEvent?.(currentChatId, $('#msgInput').value.trim().length > 0); });
$('#micBtn')?.addEventListener('mousedown', startRecording);
$('#micBtn')?.addEventListener('touchstart', startRecording);
$('#micBtn')?.addEventListener('mouseup', stopRecording);
$('#micBtn')?.addEventListener('touchend', stopRecording);
$('#micBtn')?.addEventListener('mouseleave', stopRecording);
$('#searchChatsInput')?.addEventListener('input', e => renderChats(e.target.value));
$('#searchChannelsInput')?.addEventListener('input', e => renderChannels(e.target.value));
$('#chatAvatar')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) openUserModal(c); });
$('#voiceCallBtn')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) startCall(c, 'voice'); });
$('#videoCallBtn')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) startCall(c, 'video'); });
$('#callEndBtn')?.addEventListener('click', endCall);
$('#callMuteBtn')?.addEventListener('click', function() { this.classList.toggle('active'); });
$('#callSpeakerBtn')?.addEventListener('click', function() { this.classList.toggle('active'); });
$('#closeSettingsBtn')?.addEventListener('click', () => showScreen('chats'));
$('#themeToggle')?.addEventListener('click', () => { const s = DB_getSettings(); DB_updateSetting('theme', s.theme==='dark'?'light':'dark'); applyTheme(); toast(s.theme==='dark'?'☀️ نهاري':'🌙 ليلي'); });
$('#notifToggle')?.addEventListener('click', () => { const s = DB_getSettings(); DB_updateSetting('notifications', !s.notifications); toast(s.notifications?'🔕 معطلة':'🔔 مفعلة'); });
$('#syncContactsBtn')?.addEventListener('click', () => window.syncContacts?.());
$('#addContactBtn')?.addEventListener('click', () => window.addContactManually?.());
$('#startAdBtn')?.addEventListener('click', () => toast('🚀 إعلان قريباً'));
$('#broadcastBtn')?.addEventListener('click', () => toast('📢 رسائل جماعية قريباً'));

// ==================== التهيئة النهائية (محسنة) ====================
let initRun = false;

async function init() {
    if (initRun) return;
    initRun = true;

    // التحقق من وجود مستخدم
    const user = DB_getCurrentUser();
    if (!user || !user.phone) {
        window.location.href = 'login.html';
        return;
    }

    // تهيئة قاعدة البيانات المحلية وانتظارها
    if (window.initDB) {
        try {
            await window.initDB();
            console.log('✅ تم تهيئة قاعدة البيانات المحلية');
        } catch (e) {
            console.warn('⚠️ فشل تهيئة قاعدة البيانات، استخدام الاحتياطي', e);
        }
    }

    // عرض واجهة التطبيق
    const app = $('#appContainer');
    const nav = $('#bottomNav');
    if (app) app.style.display = 'flex';
    if (nav) nav.style.display = 'flex';
    showScreen('chats');
    toast('📱 جاري التحميل...');

    // تهيئة التشفير (مع كلمة المرور إذا كانت موجودة)
    try {
        await initEncryption(sessionPassword);
    } catch (e) {
        console.warn('⚠️ فشل تهيئة التشفير', e);
    }

    bindMenuButtons();
    applyTheme();

    // تحميل البيانات وعرضها
    scheduleRenderChats();
    scheduleRenderContacts();
    scheduleRenderStories();
    scheduleRenderChannels();

    setTimeout(() => {
        window.fetchAllUsersAsContacts?.();
        window.fetchAllPendingMessages?.();
    }, 100);

    setTimeout(() => {
        if (isOnline && window.syncContacts) window.syncContacts().catch(()=>{});
    }, 5000);

    // مستمعي أحداث الشبكة
    window.addEventListener('online', () => {
        isOnline = true;
        toast('🟢 متصل');
        window.fetchAllPendingMessages?.();
        window.fetchAllUsersAsContacts?.();
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        toast('🔴 غير متصل');
    });

    // حفظ البيانات قبل إغلاق المتصفح (مهم جداً)
    window.addEventListener('beforeunload', function(e) {
        if (window.saveAllData) {
            window.saveAllData();
        }
    });

    // حفظ البيانات بشكل دوري (كل 30 ثانية)
    setInterval(() => {
        if (window.saveAllData) {
            window.saveAllData().catch(() => {});
        }
    }, 30000);

    console.log('✅ RamzApp v6.4 النهائي جاهز – جميع الميزات مفعلة');
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

// ==================== بدء التطبيق ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 10);
}

console.log('✅ common.js v6.4 محمّل وجاهز');
