// ==================== common.js - الإصدار النهائي مع سجلات تشخيصية ====================
// يعالج: حلقة إعادة التوجيه، التهيئة المتكررة، مع سجلات مفصلة لتحديد مكان الخلل
// يربط db.js + supabase.js + media.js + sync.js مع واجهة index.html

// ==================== نظام تحميل الأيقونات ====================
let fontAwesomeLoaded = false;
let fallbackCDNTried = false;

window.onFontAwesomeLoad = function() {
    fontAwesomeLoaded = true;
    document.body.classList.remove('no-fontawesome');
};

window.loadFallbackCDN = function() {
    if (fallbackCDNTried) return;
    fallbackCDNTried = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css';
    link.onload = () => {
        fontAwesomeLoaded = true;
        document.body.classList.remove('no-fontawesome');
    };
    link.onerror = () => {
        document.body.classList.add('no-fontawesome');
        fontAwesomeLoaded = false;
    };
    document.head.appendChild(link);
};

function detectFontAwesome() {
    const testEl = document.getElementById('iconTest');
    if (!testEl) return;
    setTimeout(() => {
        const computed = window.getComputedStyle(testEl);
        const fontFamily = computed.fontFamily || '';
        if (!fontFamily.includes('Font Awesome') && !fontFamily.includes('FontAwesome')) {
            if (!fallbackCDNTried) { window.loadFallbackCDN(); } else { document.body.classList.add('no-fontawesome'); fontAwesomeLoaded = false; }
        } else {
            fontAwesomeLoaded = true;
            document.body.classList.remove('no-fontawesome');
        }
    }, 1500);
    setTimeout(() => {
        if (!fontAwesomeLoaded && !fallbackCDNTried) { window.loadFallbackCDN(); } else if (!fontAwesomeLoaded) { document.body.classList.add('no-fontawesome'); }
    }, 4000);
}

// ==================== اختصارات المساعدة ====================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ==================== دوال الزمن ====================
function timeAgo(d) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff / 60) + ' د';
    if (diff < 86400) return Math.floor(diff / 3600) + ' س';
    return Math.floor(diff / 86400) + ' يوم';
}

function fmtTime(d) {
    return new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d) {
    return new Date(d).toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' });
}

function esc(s) {
    if (!s) return '';
    return s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

function toast(message, duration = 2000) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

// ==================== تأثير صوتي للإشعارات ====================
let audioCtx = null;
function playNotificationSound() {
    const settings = DB_getSettings ? DB_getSettings() : { notifications: true };
    if (!settings.notifications) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) { /* تجاهل */ }
}

// ==================== متغيرات الحالة الأساسية ====================
let currentChatId = null;
let replyTarget = null;
let pendingImg = null;
let pendingVoice = null;
let selectedModalUser = null;
let currentScreen = 'chats';
let isRecording = false;
let mediaRecorder = null;
let recordingChunks = [];
let callInterval = null;
let callSeconds = 0;
let storyInterval = null;
let storyIndex = 0;
let typingTimeout = null;
let editingMsgId = null;
let isOnline = navigator.onLine;

// ==================== متغيرات منع التهيئة المتكررة ====================
let initRun = false;
let appReady = false;

// ==================== مؤشر الاتصال ====================
function updateConnectionIndicator() {
    const indicator = $('#connectionIndicator');
    if (!indicator) return;
    if (!isOnline) {
        indicator.textContent = '📡 أنت غير متصل بالإنترنت - التطبيق يعمل محلياً';
        indicator.classList.add('offline');
    } else {
        indicator.classList.remove('offline');
        setTimeout(() => { if (isOnline) indicator.classList.remove('offline'); }, 2000);
    }
}

window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionIndicator();
    toast('🟢 تم الاتصال بالإنترنت - جاري المزامنة...');
    if (window.syncAllPendingMessages) window.syncAllPendingMessages();
    if (currentChatId) subscribeToCurrentChat();
    if (window.setUserOnlineStatus) window.setUserOnlineStatus(true);
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateConnectionIndicator();
    toast('🔴 أنت غير متصل بالإنترنت');
    if (window.setUserOnlineStatus) window.setUserOnlineStatus(false);
});

// ==================== دوال التفاف حول db.js ====================
function DB_getChats() {
    if (window.getChats) return window.getChats();
    return [];
}

function DB_getMessages(chatId) {
    if (window.getMessages) return window.getMessages(chatId);
    return [];
}

function DB_addMessage(msg) {
    if (window.addMessage) return window.addMessage(msg);
    return msg;
}

function DB_updateMessage(msgId, updates) {
    if (window.updateMessage) window.updateMessage(msgId, updates);
}

function DB_deleteMessage(msgId) {
    if (window.deleteMessage) window.deleteMessage(msgId);
}

function DB_saveChat(chatData) {
    if (window.saveChat) window.saveChat(chatData);
}

function DB_deleteChat(chatId) {
    if (window.deleteChat) window.deleteChat(chatId);
}

function DB_getCurrentUser() {
    if (window.getCurrentUser) return window.getCurrentUser();
    const saved = localStorage.getItem('ramzapp_user');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn('⚠️ بيانات المستخدم في localStorage فاسدة:', e);
            return null;
        }
    }
    return null;
}

function DB_getContacts() {
    if (window.getContacts) return window.getContacts();
    return [];
}

function DB_getRegisteredContacts() {
    if (window.getRegisteredContacts) return window.getRegisteredContacts();
    return [];
}

function DB_getUnregisteredContacts() {
    if (window.getUnregisteredContacts) return window.getUnregisteredContacts();
    return [];
}

function DB_saveContact(contactData) {
    if (window.saveContact) window.saveContact(contactData);
}

function DB_getStories() {
    if (window.getStories) return window.getStories();
    return [];
}

function DB_addStory(storyData) {
    if (window.addStory) window.addStory(storyData);
}

function DB_getChannels() {
    if (window.getChannels) return window.getChannels();
    return [];
}

function DB_addChannel(channelData) {
    if (window.addChannel) window.addChannel(channelData);
}

function DB_getCalls() {
    if (window.getCalls) return window.getCalls();
    return [];
}

function DB_addCall(callData) {
    if (window.addCall) window.addCall(callData);
}

function DB_getCatalog() {
    if (window.getCatalog) return window.getCatalog();
    return [];
}

function DB_addCatalogItem(itemData) {
    if (window.addCatalogItem) window.addCatalogItem(itemData);
}

function DB_getSettings() {
    if (window.getSettings) return window.getSettings();
    return { theme: 'dark', notifications: true };
}

function DB_updateSetting(key, value) {
    if (window.updateSetting) window.updateSetting(key, value);
}

function DB_getPendingMessages() {
    if (window.getPendingMessages) return window.getPendingMessages();
    return [];
}

// ==================== نظام التشفير (E2E) ====================
const E2E_KEY_STORE = 'ramzapp_e2e_keys';
let currentUserKeyPair = null;
let peerPublicKeys = {};

async function generateKeyPair() {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
}

async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importPublicKey(base64Key) {
    const binaryDer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
}

async function exportPrivateKey(key) {
    const exported = await window.crypto.subtle.exportKey("pkcs8", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importPrivateKey(base64Key) {
    const binaryDer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    );
}

async function saveKeyPairToStorage(userId, publicKey, privateKey) {
    const db = await openE2EStore();
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');
    await Promise.all([
        new Promise((resolve, reject) => {
            const req = store.put({ id: userId + '_public', key: publicKey });
            req.onsuccess = resolve; req.onerror = reject;
        }),
        new Promise((resolve, reject) => {
            const req = store.put({ id: userId + '_private', key: privateKey });
            req.onsuccess = resolve; req.onerror = reject;
        })
    ]);
}

async function loadKeyPairFromStorage(userId) {
    const db = await openE2EStore();
    const tx = db.transaction('keys', 'readonly');
    const store = tx.objectStore('keys');
    const publicKey = await new Promise(resolve => {
        const req = store.get(userId + '_public');
        req.onsuccess = () => resolve(req.result);
    });
    const privateKey = await new Promise(resolve => {
        const req = store.get(userId + '_private');
        req.onsuccess = () => resolve(req.result);
    });
    if (publicKey && privateKey) {
        return {
            publicKey: await importPublicKey(publicKey.key),
            privateKey: await importPrivateKey(privateKey.key)
        };
    }
    return null;
}

function openE2EStore() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('RamzAppE2E', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('keys')) {
                db.createObjectStore('keys', { keyPath: 'id' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = reject;
    });
}

async function initEncryption() {
    const user = DB_getCurrentUser();
    if (!user) return;

    const storedKeys = await loadKeyPairFromStorage(user.id);
    if (storedKeys) {
        currentUserKeyPair = storedKeys;
    } else {
        currentUserKeyPair = await generateKeyPair();
        const pubBase64 = await exportPublicKey(currentUserKeyPair.publicKey);
        const privBase64 = await exportPrivateKey(currentUserKeyPair.privateKey);
        await saveKeyPairToStorage(user.id, pubBase64, privBase64);
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('users').update({ public_key: pubBase64 }).eq('id', user.id);
            } catch (e) {}
        }
    }
}

async function encryptMessage(plaintext, peerId) {
    if (!currentUserKeyPair) throw new Error('Encryption not initialized');
    
    let peerPublicKey = peerPublicKeys[peerId];
    if (!peerPublicKey) {
        if (window.supabaseClient) {
            const { data } = await window.supabaseClient.from('users').select('public_key').eq('id', peerId).single();
            if (data?.public_key) {
                peerPublicKey = await importPublicKey(data.public_key);
                peerPublicKeys[peerId] = peerPublicKey;
            }
        }
        if (!peerPublicKey) throw new Error('Peer public key not found');
    }

    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encodedText = new TextEncoder().encode(plaintext);
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        encodedText
    );

    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        peerPublicKey,
        rawAesKey
    );

    return {
        encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
        encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
        iv: btoa(String.fromCharCode(...iv))
    };
}

async function decryptMessage(encryptedPayload) {
    if (!currentUserKeyPair) throw new Error('Encryption not initialized');

    const encryptedData = Uint8Array.from(atob(encryptedPayload.encryptedData), c => c.charCodeAt(0));
    const encryptedKey = Uint8Array.from(atob(encryptedPayload.encryptedKey), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedPayload.iv), c => c.charCodeAt(0));

    const rawAesKey = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        currentUserKeyPair.privateKey,
        encryptedKey
    );

    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        rawAesKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const decryptedData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        encryptedData
    );

    return new TextDecoder().decode(decryptedData);
}

// ==================== دخول التطبيق ====================
function enterApp() {
    if (appReady) {
        console.warn('⚠️ enterApp() تم استدعاؤها أكثر من مرة');
        return;
    }
    appReady = true;
    console.log('📌 enterApp() - عرض واجهة التطبيق');
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    showScreen('chats');
    updateStats();
    applyTheme();
    updateConnectionIndicator();
    console.log('✅ تم دخول التطبيق بنجاح');
}

// ==================== التنقل بين الشاشات ====================
const screens = ['chatsScreen', 'chatScreen', 'contactsScreen', 'callsScreen', 'updatesScreen', 'toolsScreen', 'profileScreen', 'settingsScreen'];

function showScreen(id) {
    currentScreen = id;
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id + 'Screen') || document.getElementById(id);
    if (target) target.classList.add('active');

    const noNavScreens = ['chatScreen', 'profileScreen', 'settingsScreen'];
    const bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = noNavScreens.includes(id + 'Screen') || noNavScreens.includes(id) ? 'none' : 'flex';

    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === id));

    if (id === 'chats') renderChats();
    if (id === 'contacts') renderContactsList();
    if (id === 'calls') renderCalls();
    if (id === 'updates') { renderStories(); renderChannels(); }
    updateStats();

    const inSearch = $('#inChatSearch');
    if (inSearch) inSearch.classList.remove('active');
    const searchRes = $('#searchResults');
    if (searchRes) searchRes.style.display = 'none';
}

$$('.nav-item').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.nav)));

// ==================== تحديث الإحصائيات ====================
function updateStats() {
    const allMessages = Object.values(window.inMemoryDB?.messages || {}).reduce((acc, msgs) => acc + msgs.length, 0);
    const chatsCount = DB_getChats().length;
    const catalogCount = DB_getCatalog().length;
    
    const $sv = $('#statViews');
    const $sc = $('#statCatalog');
    const $sch = $('#statChats');
    if ($sv) $sv.textContent = allMessages;
    if ($sc) $sc.textContent = catalogCount;
    if ($sch) $sch.textContent = chatsCount;
}

// ==================== شاشة الدردشات ====================
function renderChats(filter = '') {
    const container = $('#chatsList');
    if (!container) return;

    let chats = [...DB_getChats()].sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return new Date(b.last_time || b.lastTime) - new Date(a.last_time || a.lastTime);
    });

    if (filter) {
        const q = filter.toLowerCase();
        chats = chats.filter(c => c.name.toLowerCase().includes(q));
    }

    if (!chats.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><p>لا توجد محادثات${filter ? ' مطابقة' : ' بعد'}</p></div>`;
        return;
    }

    container.innerHTML = '';
    chats.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        const isTyping = c._typing && (Date.now() - c._typing < 5000);
        div.innerHTML = `
            <div class="chat-avatar" data-id="${c.id}">${c.avatar || '?'}${c.online ? '<span class="online-dot"></span>' : ''}</div>
            <div class="chat-info">
                <div class="chat-name-row">
                    <span class="chat-name">${c.pinned ? '<i class="fas fa-thumbtack pinned-icon"></i> ' : ''}${esc(c.name)}</span>
                    <span class="chat-time">${c.last_time || c.lastTime ? timeAgo(c.last_time || c.lastTime) : ''}</span>
                </div>
                <div class="chat-preview">
                    <span class="last-msg">${isTyping ? '<span class="typing-indicator-chat">يكتب الآن...</span>' : (c.last_msg || c.lastMsg ? esc((c.last_msg || c.lastMsg).substring(0, 35)) + ((c.last_msg || c.lastMsg).length > 35 ? '...' : '') : '👋 ابدأ المحادثة')}</span>
                    ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : '<span class="check-mark read"><i class="fas fa-check-double"></i></span>'}
                </div>
            </div>`;
        div.addEventListener('click', e => {
            if (e.target.closest('.chat-avatar')) {
                openUserModal(c);
            } else {
                openChat(c.id);
            }
        });
        container.appendChild(div);
    });
}

// ==================== البحث ====================
$('#searchChatsInput')?.addEventListener('input', e => renderChats(e.target.value));
$('#searchBtn')?.addEventListener('click', () => { $('#searchChatsInput')?.focus(); showScreen('chats'); });

// ==================== القوائم المنبثقة ====================
function showPopup(items) {
    const menu = $('#popupMenu');
    const overlay = $('#popupOverlay');
    if (!menu || !overlay) return;

    menu.innerHTML = items.map(i => `<div class="popup-item${i.danger ? ' danger' : ''}" data-action="${i.label}"><i class="fas ${i.icon}"></i>${i.label}</div>`).join('');
    overlay.classList.add('active');

    menu.querySelectorAll('.popup-item').forEach(el => {
        el.addEventListener('click', () => {
            const item = items.find(i => i.label === el.dataset.action);
            if (item) item.action();
            overlay.classList.remove('active');
        });
    });
}

$('#popupOverlay')?.addEventListener('click', e => {
    if (e.target === $('#popupOverlay')) $('#popupOverlay').classList.remove('active');
});

// ==================== أزرار الشاشة الرئيسية ====================
$('#cameraBtn')?.addEventListener('click', () => openStoryCamera());
$('#settingsBtn')?.addEventListener('click', () => showScreen('settings'));
$('#contactsBtn')?.addEventListener('click', () => showScreen('contacts'));

$('#mainMenuBtn')?.addEventListener('click', () => showPopup([
    { icon: 'fa-users', label: 'مجموعة جديدة', action: () => createGroup() },
    { icon: 'fa-archive', label: 'المؤرشفة', action: () => toast('📦 المؤرشفة') },
    { icon: 'fa-bullhorn', label: 'الرسائل الجماعية', action: () => broadcastMessage() },
    { icon: 'fa-star', label: 'مميزة بنجمة', action: () => toast('⭐ المميزة') },
    { icon: 'fa-cog', label: 'الإعدادات', action: () => showScreen('settings') },
    { icon: 'fa-sign-out-alt', label: 'تسجيل الخروج', action: () => logout(), danger: true },
]));

function createGroup() {
    const name = prompt('اسم المجموعة:');
    if (name && name.trim()) {
        const gid = 'g' + Date.now();
        const group = {
            id: gid, name: name.trim(), avatar: '👥', last_seen: 'الآن', online: true,
            unread: 0, pinned: false, bio: 'مجموعة جديدة', last_msg: '', last_time: new Date().toISOString(),
            is_group: true
        };
        DB_saveChat(group);
        renderChats();
        toast('✅ تم إنشاء المجموعة');
    }
}

function broadcastMessage() {
    const msg = prompt('📣 اكتب الرسالة الجماعية:');
    if (msg && msg.trim()) {
        const chats = DB_getChats();
        chats.forEach(c => {
            const message = {
                id: window.generateId ? window.generateId() : 'id_' + Date.now(),
                chat_id: c.id,
                sender_id: 'me',
                text: msg.trim(),
                time: new Date().toISOString(),
                likes: 0, liked: false, reply_to: null, img: null,
                voice_blob: null, voice_duration: null,
                status: 'pending-send', sync_status: 'pending-send'
            };
            DB_addMessage(message);
            c.last_msg = msg.trim();
            c.last_time = new Date().toISOString();
            DB_saveChat(c);
        });
        renderChats();
        toast('📣 تم إرسال الرسالة للجميع');
    }
}

// ==================== المزامنة عند عودة الاتصال ====================
window.addEventListener('ramzapp:syncPending', () => {
    if (window.syncAllPendingMessages) window.syncAllPendingMessages();
});

async function syncPendingMessages() {
    if (!isOnline || !window.syncAllPendingMessages) return;
    const result = await window.syncAllPendingMessages();
    if (result && result.synced > 0) {
        toast(`✅ تمت مزامنة ${result.synced} رسالة`);
    }
    renderMessages();
    renderChats();
}

// ==================== الاشتراك في قناة المحادثة ====================
function subscribeToCurrentChat() {
    if (!currentChatId || !isOnline) return;

    if (window.subscribeToChat) {
        window.subscribeToChat(currentChatId, (msg) => {
            const existingMsgs = DB_getMessages(currentChatId);
            const exists = existingMsgs.find(m => m.id === msg.id);
            if (!exists) {
                msg.sync_status = 'delivered';
                msg.status = 'delivered';
                DB_addMessage(msg);
                const chat = DB_getChats().find(c => c.id === currentChatId);
                if (chat) {
                    chat.last_msg = msg.text || (msg.img ? '📷 صورة' : msg.voice_blob ? '🎤 رسالة صوتية' : '📎');
                    chat.last_time = msg.time;
                    if (!chat.online && msg.sender_id !== 'me') {
                        chat.unread = (chat.unread || 0) + 1;
                    }
                    DB_saveChat(chat);
                }
                renderMessages();
                renderChats();
                playNotificationSound();
            }
        }, (senderId, isTyping) => {
            const chat = DB_getChats().find(c => c.id === currentChatId);
            if (chat && senderId !== DB_getCurrentUser()?.id) {
                chat._typing = isTyping ? Date.now() : null;
                const st = $('#chatStatusDisp');
                if (st) {
                    if (isTyping) {
                        st.textContent = 'يكتب الآن...';
                        st.className = 'chat-header-status typing';
                    } else {
                        st.textContent = chat.online ? 'متصل الآن' : (chat.last_seen || '');
                        st.className = 'chat-header-status' + (chat.online ? ' online' : '');
                    }
                }
                DB_saveChat(chat);
                if (currentScreen === 'chats') renderChats();
            }
        });
    }
}

// ==================== فتح محادثة ====================
function openChat(chatId) {
    currentChatId = chatId;
    const chats = DB_getChats();
    const c = chats.find(x => x.id === chatId);
    if (!c) return;

    $('#chatNameDisp').textContent = c.name;
    $('#chatAvatar').textContent = c.avatar || '?';
    const st = $('#chatStatusDisp');
    st.textContent = c.online ? 'متصل الآن' : (c.last_seen || 'غير متصل');
    st.className = 'chat-header-status' + (c.online ? ' online' : '');

    c.unread = 0;
    c._typing = null;
    DB_saveChat(c);

    replyTarget = null;
    pendingImg = null;
    pendingVoice = null;
    editingMsgId = null;
    $('#replyBar').style.display = 'none';
    $('#msgInput').value = '';

    renderMessages();
    updateSendBtn();
    showScreen('chat');

    subscribeToCurrentChat();

    const msgs = DB_getMessages(chatId);
    const unreadIds = msgs.filter(m => m.sender_id !== 'me' && m.status !== 'read').map(m => m.id);
    if (unreadIds.length > 0 && window.markMessagesAsRead) {
        window.markMessagesAsRead(chatId, unreadIds);
        unreadIds.forEach(id => DB_updateMessage(id, { status: 'read' }));
    }

    setTimeout(() => $('#msgInput')?.focus(), 300);
}

$('#backBtn')?.addEventListener('click', () => {
    currentChatId = null;
    if (window.unsubscribeFromChat) window.unsubscribeFromChat(currentChatId);
    showScreen('chats');
    renderChats();
});

$('#chatAvatar')?.addEventListener('click', () => {
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c) openUserModal(c);
});

$('#chatHeaderInfo')?.addEventListener('click', () => {
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c) openUserModal(c);
});

// ==================== عرض الرسائل ====================
function renderMessages() {
    if (!currentChatId) return;
    const area = $('#messagesArea');
    if (!area) return;

    const msgs = DB_getMessages(currentChatId);
    area.innerHTML = '';
    let lastDate = '';

    msgs.forEach(m => {
        const md = new Date(m.time).toDateString();
        if (md !== lastDate) {
            lastDate = md;
            area.innerHTML += `<div class="date-divider">${fmtDate(m.time)}</div>`;
        }

        const isMe = m.sender_id === 'me' || m.sid === 'me';
        const syncClass = m.sync_status === 'pending-send' ? 'sync-pending' :
                         m.sync_status === 'failed' ? 'sync-failed' : '';

        let stIcon = '';
        if (isMe) {
            if (m.status === 'read' || m.sync_status === 'read') {
                stIcon = '<i class="fas fa-check-double" style="color:#4fc3f7;"></i>';
            } else if (m.status === 'delivered' || m.sync_status === 'delivered') {
                stIcon = '<i class="fas fa-check-double"></i>';
            } else if (m.status === 'sent' || m.sync_status === 'sent') {
                stIcon = '<i class="fas fa-check"></i>';
            } else if (m.sync_status === 'pending-send') {
                stIcon = '<span style="font-size:10px;">⏳</span>';
            } else if (m.sync_status === 'failed') {
                stIcon = '<span style="font-size:10px;color:#ff4444;">⚠️</span>';
            }
        }

        const liked = m.liked;
        const hasVoice = m.voice_blob;
        const hasImg = m.img && !hasVoice;

        area.innerHTML += `
        <div class="msg-row ${isMe ? 'own' : 'other'} ${syncClass}" id="msg-${m.id}">
            <div class="msg-bubble">
                ${m.reply_to ? `<div class="reply-preview" onclick="scrollToMsg('${m.reply_to}')"><i class="fas fa-reply"></i> رد على رسالة</div>` : ''}
                ${hasVoice ? `<div class="voice-msg"><button class="voice-play-btn" data-audio="${m.voice_blob}" onclick="playVoice(this)"><i class="fas fa-play"></i></button><div class="voice-wave">${Array.from({length:8},(_,i)=>`<div class="voice-wave-bar" style="height:12px;width:3px;background:var(--accent);border-radius:2px;"></div>`).join('')}</div><span style="font-size:10px;color:var(--text3);">${m.voice_duration||'0:00'}</span></div>` : ''}
                ${hasImg ? `<img src="${m.img}" class="attachment-img" onclick="openImageViewer('${m.img}')" loading="lazy">` : ''}
                <div class="msg-text" data-id="${m.id}" data-encrypted="${m.encrypted ? 'true' : 'false'}" data-payload='${m.encrypted ? JSON.stringify(m.encryptedPayload).replace(/'/g, "&#39;") : ''}'>
                    ${m.encrypted ? '<i class="fas fa-lock" style="font-size:10px; color:#25D366;"></i> 🔒 فك التشفير...' : esc(m.text||'')}
                </div>
                <div class="msg-time-row"><span>${fmtTime(m.time)}</span>${stIcon}</div>
                <div class="msg-actions">
                    <button class="${liked?'liked':''}" data-id="${m.id}" data-act="like"><i class="${liked?'fas':'far'} fa-heart"></i> ${m.likes||0}</button>
                    <button data-id="${m.id}" data-act="reply"><i class="fas fa-reply"></i></button>
                    ${isMe?`<button data-id="${m.id}" data-act="edit"><i class="fas fa-edit"></i></button>`:''}
                    ${isMe?`<button data-id="${m.id}" data-act="delete"><i class="fas fa-trash-alt"></i></button>`:''}
                </div>
            </div>
        </div>`;
    });

    area.querySelectorAll('.msg-text[data-encrypted="true"]').forEach(async (el) => {
        try {
            const payload = JSON.parse(el.dataset.payload);
            const decryptedText = await decryptMessage(payload);
            el.innerHTML = `<i class="fas fa-lock" style="font-size:10px; color:#25D366;"></i> ${esc(decryptedText)}`;
            el.dataset.encrypted = 'false';
        } catch (e) {
            el.innerHTML = `<span style="color:#ff4444;">⚠️ تعذر فك التشفير</span>`;
        }
    });

    area.querySelectorAll('.msg-actions button').forEach(b => {
        b.addEventListener('click', e => {
            e.stopPropagation();
            const act = b.dataset.act;
            const mid = b.dataset.id;
            if (act === 'like') toggleLike(mid);
            else if (act === 'reply') setReply(mid);
            else if (act === 'delete') deleteMsg(mid);
            else if (act === 'edit') editMessage(mid);
        });
    });

    area.scrollTop = area.scrollHeight;
}

function playVoice(btn) {
    const audioSrc = btn.dataset.audio;
    if (!audioSrc) return;
    const audio = new Audio(audioSrc);
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fas fa-pause';
    audio.play();
    audio.onended = () => { if (icon) icon.className = 'fas fa-play'; };
    btn.onclick = (e) => {
        e.stopPropagation();
        if (audio.paused) { audio.play(); if (icon) icon.className = 'fas fa-pause'; }
        else { audio.pause(); if (icon) icon.className = 'fas fa-play'; }
    };
}

function openImageViewer(src) {
    $('#viewerImage').src = src;
    $('#imageViewer').classList.add('active');
}

$('#closeImageViewer')?.addEventListener('click', () => $('#imageViewer').classList.remove('active'));
$('#imageViewer')?.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('active');
});

function scrollToMsg(mid) {
    const el = document.getElementById('msg-' + mid);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.background = 'rgba(255,200,0,0.15)';
        setTimeout(() => el.style.background = '', 1500);
    }
}

function toggleLike(mid) {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const m = msgs.find(x => x.id === mid);
    if (m) {
        m.liked = !m.liked;
        m.likes = (m.likes || 0) + (m.liked ? 1 : -1);
        if (m.likes < 0) m.likes = 0;
        DB_updateMessage(mid, { liked: m.liked, likes: m.likes });
        renderMessages();
    }
}

function deleteMsg(mid) {
    if (!currentChatId || !confirm('حذف الرسالة؟')) return;
    DB_deleteMessage(mid);
    updateLastMsg();
    renderMessages();
    toast('🗑 تم الحذف');
}

function setReply(mid) {
    const msgs = DB_getMessages(currentChatId);
    const m = msgs.find(x => x.id === mid);
    if (m) {
        replyTarget = m;
        $('#replyPreview').textContent = (m.text || (m.voice_blob ? '🎤 رسالة صوتية' : '📎')).substring(0, 50);
        $('#replyBar').style.display = 'flex';
        $('#msgInput')?.focus();
    }
}

$('#cancelReplyBtn')?.addEventListener('click', () => {
    replyTarget = null;
    $('#replyBar').style.display = 'none';
});

function editMessage(mid) {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const m = msgs.find(x => x.id === mid);
    if (m && (m.sender_id === 'me' || m.sid === 'me')) {
        const newText = prompt('تعديل الرسالة:', m.text || '');
        if (newText !== null && newText.trim() !== '') {
            DB_updateMessage(mid, { text: newText.trim() });
            updateLastMsg();
            renderMessages();
            toast('✅ تم التعديل');
        }
    }
}

function updateLastMsg() {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const chats = DB_getChats();
    const c = chats.find(x => x.id === currentChatId);
    if (c && msgs.length) {
        const l = msgs[msgs.length - 1];
        c.last_msg = l.text || (l.voice_blob ? '🎤 رسالة صوتية' : (l.img ? '📷 صورة' : '📎'));
        c.last_time = l.time;
        DB_saveChat(c);
    }
}

// ==================== إرسال الرسائل ====================
async function sendMessage() {
    if (!currentChatId) return;
    const inp = $('#msgInput');
    const text = inp?.value.trim();
    if (!text && !pendingImg && !pendingVoice) return;

    let msgText = text || (pendingVoice ? '🎤 رسالة صوتية' : '📷 صورة');
    let encryptedPayload = null;

    if (isOnline && currentUserKeyPair) {
        try {
            encryptedPayload = await encryptMessage(msgText, currentChatId);
        } catch (e) {
            console.warn('⚠️ فشل التشفير، إرسال بدون تشفير', e);
        }
    }

    const msg = {
        id: window.generateId ? window.generateId() : 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        chat_id: currentChatId,
        sender_id: 'me',
        text: encryptedPayload ? '🔒 رسالة مشفرة' : msgText,
        encrypted: !!encryptedPayload,
        encryptedPayload: encryptedPayload,
        time: new Date().toISOString(),
        likes: 0,
        liked: false,
        reply_to: replyTarget?.id || null,
        img: pendingImg || null,
        voice_blob: pendingVoice?.blob || null,
        voice_duration: pendingVoice?.duration || null,
        status: 'pending-send',
        sync_status: 'pending-send'
    };

    DB_addMessage(msg);
    updateLastMsg();
    renderMessages();

    if (isOnline && window.sendMessageRealtime) {
        window.sendMessageRealtime(msg).then(result => {
            if (result.success) {
                DB_updateMessage(msg.id, { sync_status: 'sent', status: 'sent' });
            } else if (!result.offline) {
                DB_updateMessage(msg.id, { sync_status: 'failed', status: 'failed' });
            }
            renderMessages();
        });
    }

    if (inp) inp.value = '';
    pendingImg = null;
    pendingVoice = null;
    replyTarget = null;
    $('#replyBar').style.display = 'none';
    updateSendBtn();

    if (window.sendTypingEvent) {
        window.sendTypingEvent(currentChatId, false);
    }
    
    playNotificationSound();
}

$('#sendMsgBtn')?.addEventListener('click', sendMessage);
$('#msgInput')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});
$('#msgInput')?.addEventListener('input', function() {
    updateSendBtn();
    if (currentChatId && window.sendTypingEvent) {
        window.sendTypingEvent(currentChatId, this.value.trim().length > 0);
    }
});

function updateSendBtn() {
    const inp = $('#msgInput');
    const has = (inp?.value.trim().length > 0) || pendingImg || pendingVoice;
    const sendBtn = $('#sendMsgBtn');
    const micBtn = $('#micBtn');
    if (sendBtn) sendBtn.style.display = has ? 'flex' : 'none';
    if (micBtn) micBtn.style.display = has ? 'none' : 'flex';
}

// ==================== تسجيل الصوت ====================
$('#micBtn')?.addEventListener('mousedown', startRecording);
$('#micBtn')?.addEventListener('touchstart', startRecording);
$('#micBtn')?.addEventListener('mouseup', stopRecording);
$('#micBtn')?.addEventListener('touchend', stopRecording);
$('#micBtn')?.addEventListener('mouseleave', stopRecording);
$('#micBtn')?.addEventListener('touchcancel', stopRecording);

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
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordingChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result;
                const duration = Math.floor(recordingChunks.length * 0.05);
                pendingVoice = { blob: base64data, duration: '0:' + Math.min(duration, 59).toString().padStart(2, '0') };
                updateSendBtn();
                toast('✅ تم التسجيل، اضغط إرسال');
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        setTimeout(() => {
            if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
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
    if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        $('#micBtn')?.classList.remove('recording');
    }
}

// ==================== إيموجي ====================
const emojis = ['😀','😂','😍','😢','😡','👍','❤️','🔥','🎉','😎','🤔','😴','🥳','😇','🤗','😤','😱','💔','✨','🌟','💡','📎','📷','🎵','📍','🙏','💪','👀','🤝','🚀','💯','✅','❌','🎯'];
const ep = $('#emojiPicker');
if (ep) {
    emojis.forEach(e => {
        const s = document.createElement('span');
        s.textContent = e;
        s.addEventListener('click', () => {
            const inp = $('#msgInput');
            if (inp) inp.value += e;
            ep.classList.remove('show');
            $('#msgInput')?.focus();
            updateSendBtn();
        });
        ep.appendChild(s);
    });
}

$('#emojiBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    ep?.classList.toggle('show');
});

document.addEventListener('click', e => {
    if (ep && !ep.contains(e.target) && e.target !== $('#emojiBtn')) {
        ep.classList.remove('show');
    }
});

// ==================== مرفقات ====================
const as = $('#attachSheet');
const ao = $('#attachOverlay');
$('#attachBtn')?.addEventListener('click', () => {
    as?.classList.add('open');
    ao?.classList.add('active');
    ep?.classList.remove('show');
});
$('#closeAttachBtn')?.addEventListener('click', () => {
    as?.classList.remove('open');
    ao?.classList.remove('active');
});
ao?.addEventListener('click', () => {
    as?.classList.remove('open');
    ao?.classList.remove('active');
});

const hf = $('#hiddenFileInput');
$$('.attach-option')?.forEach(o => o.addEventListener('click', () => {
    const t = o.dataset.type;
    if (t === 'gallery') { hf.accept = 'image/*,video/*'; hf.click(); }
    else if (t === 'camera') { hf.accept = 'image/*'; hf.capture = 'environment'; hf.click(); }
    else if (t === 'document') { hf.accept = '.pdf,.doc,.docx,.txt'; hf.click(); }
    else toast('📇 جهة اتصال قريباً');
    as?.classList.remove('open');
    ao?.classList.remove('active');
}));

hf?.addEventListener('change', e => {
    const files = e.target.files;
    if (files.length > 0) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                const r = new FileReader();
                r.onload = ev => { pendingImg = ev.target.result; updateSendBtn(); toast('📷 اضغط إرسال'); };
                r.readAsDataURL(f);
            } else {
                toast('📄 ' + f.name);
            }
        });
    }
    hf.value = '';
});

// ==================== السحب والإفلات ====================
const messagesArea = $('#messagesArea');
messagesArea?.addEventListener('dragover', (e) => {
    e.preventDefault(); e.stopPropagation();
    messagesArea.style.background = 'rgba(255,0,80,0.05)';
});
messagesArea?.addEventListener('dragleave', () => {
    messagesArea.style.background = '';
});
messagesArea?.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    messagesArea.style.background = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = ev => { pendingImg = ev.target.result; updateSendBtn(); toast('📷 تم إضافة الصورة، اضغط إرسال'); };
                reader.readAsDataURL(f);
            } else if (f.type.startsWith('audio/')) {
                const reader = new FileReader();
                reader.onload = ev => {
                    pendingVoice = { blob: ev.target.result, duration: '0:00' };
                    updateSendBtn();
                    toast('🎵 تم إضافة الصوت');
                };
                reader.readAsDataURL(f);
            } else {
                toast('⚠️ نوع الملف غير مدعوم');
            }
        });
    }
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

$('#modalInfoBtn')?.addEventListener('click', () => {
    if (selectedModalUser) showProfile(selectedModalUser);
    $('#userModal').classList.remove('active');
});

function startOrOpenChat(user) {
    let chats = DB_getChats();
    let chat = chats.find(c => c.id === user.id);
    if (!chat) {
        chat = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            last_msg: '',
            last_time: new Date().toISOString(),
            unread: 0,
            online: true,
            pinned: false,
            bio: user.bio || ''
        };
        DB_saveChat(chat);
    }
    openChat(chat.id);
}

function showProfile(user) {
    $('#profileAvatar').textContent = user.avatar || '?';
    $('#profileName').textContent = user.name || '';
    $('#profileBio').textContent = user.bio || '';
    $('#profileChatBtn').dataset.userId = user.id;
    showScreen('profile');
}

$('#backFromProfileBtn')?.addEventListener('click', () => showScreen('chats'));
$('#profileChatBtn')?.addEventListener('click', function() {
    const uid = this.dataset.userId;
    if (uid) {
        const chats = DB_getChats();
        const u = chats.find(c => c.id === uid) || { id: uid, name: '', avatar: '?' };
        startOrOpenChat(u);
    }
});

// ==================== المكالمات ====================
function startCall(user, type) {
    $('#callAvatar').textContent = user.avatar || '?';
    $('#callStatusText').textContent = type === 'video' ? '📹 جاري الاتصال فيديو...' : '📞 جاري الاتصال...';
    $('#callTimer').textContent = '00:00';
    callSeconds = 0;
    $('#callScreen').classList.add('active');

    DB_addCall({ id: 'ca' + Date.now(), name: user.name, avatar: user.avatar, time: 'الآن', type: type === 'video' ? 'video' : 'outgoing' });

    setTimeout(() => {
        $('#callStatusText').textContent = 'متصل 🟢';
        if (callInterval) clearInterval(callInterval);
        callInterval = setInterval(() => {
            callSeconds++;
            const m = Math.floor(callSeconds / 60).toString().padStart(2, '0');
            const s = (callSeconds % 60).toString().padStart(2, '0');
            $('#callTimer').textContent = m + ':' + s;
        }, 1000);
    }, 2000);
}

$('#callEndBtn')?.addEventListener('click', endCall);
$('#callMuteBtn')?.addEventListener('click', function() {
    this.classList.toggle('active');
    this.style.background = this.classList.contains('active') ? '#ff0000' : 'rgba(255,255,255,0.2)';
    toast(this.classList.contains('active') ? '🔇 ميكروفون مكتوم' : '🎤 ميكروفون مفعل');
});
$('#callSpeakerBtn')?.addEventListener('click', function() {
    this.classList.toggle('active');
    this.style.background = this.classList.contains('active') ? '#00a884' : 'rgba(255,255,255,0.2)';
    toast(this.classList.contains('active') ? '🔊 مكبر الصوت مفعل' : '🔈 مكبر الصوت معطل');
});

function endCall() {
    if (callInterval) clearInterval(callInterval);
    callInterval = null;
    callSeconds = 0;
    $('#callScreen').classList.remove('active');
    $('#callMuteBtn').style.background = 'rgba(255,255,255,0.2)';
    $('#callSpeakerBtn').style.background = 'rgba(255,255,255,0.2)';
    $('#callMuteBtn').classList.remove('active');
    $('#callSpeakerBtn').classList.remove('active');
    toast('📞 تم إنهاء المكالمة');
}

$('#voiceCallBtn')?.addEventListener('click', () => {
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c) startCall(c, 'voice');
});
$('#videoCallBtn')?.addEventListener('click', () => {
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c) startCall(c, 'video');
});

function renderCalls() {
    const container = $('#callsList');
    if (!container) return;
    const calls = DB_getCalls();
    if (!calls.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-phone-slash"></i><p>لا توجد مكالمات</p></div>';
        return;
    }
    container.innerHTML = calls.map(c => `
        <div class="call-item" onclick="toast('📞 إعادة الاتصال بـ ${esc(c.name)}')">
            <div class="call-avatar">${c.avatar}</div>
            <div class="item-info">
                <div class="item-title">${esc(c.name)}</div>
                <div class="item-sub">${c.type==='incoming'?'📥 واردة':c.type==='video'?'📹 فيديو':'📤 صادرة'} • ${c.time}</div>
            </div>
            <i class="fas fa-phone" style="color:var(--accent);"></i>
        </div>
    `).join('');
}

// ==================== جهات الاتصال ====================
function renderContactsList() {
    const container = $('#contactsList');
    if (!container) return;

    const registered = DB_getRegisteredContacts();
    const unregistered = DB_getUnregisteredContacts();
    const allContacts = DB_getContacts();

    container.innerHTML = `
        <div class="section-header"><h3>✅ المسجلين في RamzApp</h3></div>
        ${registered.length === 0 ? '<p style="color:var(--text3);padding:8px 16px;">لا يوجد جهات اتصال مسجلة</p>' : registered.map(c => `
            <div class="channel-item contact-item" data-id="${c.id}">
                <div class="channel-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '📞'}</div>
                <div class="item-info">
                    <div class="item-title">${c.name || c.phone}</div>
                    <div class="item-sub">${c.phone} • مسجل</div>
                </div>
                <i class="fas fa-comment-dots" style="color:var(--accent);cursor:pointer;" title="مراسلة"></i>
            </div>
        `).join('')}
        <div class="section-header"><h3>⏳ غير المسجلين</h3></div>
        ${unregistered.length === 0 ? '<p style="color:var(--text3);padding:8px 16px;">لا يوجد جهات اتصال غير مسجلة</p>' : unregistered.map(c => `
            <div class="channel-item contact-item" data-phone="${c.phone}">
                <div class="channel-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '📞'}</div>
                <div class="item-info">
                    <div class="item-title">${c.name || c.phone}</div>
                    <div class="item-sub">${c.phone} • غير مسجل</div>
                </div>
                <button class="promo-btn invite-btn" style="padding:4px 10px;font-size:11px;" data-phone="${c.phone}">دعوة</button>
            </div>
        `).join('')}
        ${allContacts.length === 0 ? '<div class="empty-state"><i class="fas fa-address-book"></i><p>لا توجد جهات اتصال. اضغط "مزامنة جهات الاتصال" للبدء.</p></div>' : ''}
    `;

    container.querySelectorAll('.contact-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.invite-btn')) {
                const phone = el.dataset.phone;
                inviteContact(phone);
                return;
            }
            const id = el.dataset.id;
            if (id) {
                const chat = DB_getChats().find(c => c.id === id);
                if (chat) openChat(chat.id);
                else toast('⚠️ لا توجد محادثة بعد');
            }
        });
    });
}

async function syncContacts() {
    if (!isOnline) {
        toast('📡 يجب الاتصال بالإنترنت لمزامنة جهات الاتصال');
        return;
    }

    toast('🔄 جاري مزامنة جهات الاتصال...');

    try {
        let contacts = [];
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
            } catch (e) {
                toast('⚠️ لم يتم منح صلاحية الوصول لجهات الاتصال');
                return;
            }
        } else {
            toast('⚠️ المتصفح لا يدعم مزامنة جهات الاتصال');
            return;
        }

        if (!contacts || contacts.length === 0) {
            toast('⚠️ لا توجد جهات اتصال في هاتفك');
            return;
        }

        for (const contact of contacts) {
            if (contact.tel && contact.tel.length > 0) {
                const phone = contact.tel[0].replace(/[\s\-\(\)]/g, '');
                const name = contact.name || '';
                const existingContact = DB_getContacts().find(c => c.phone === phone);
                if (!existingContact) {
                    DB_saveContact({
                        id: 'sc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        phone: phone,
                        name: name || phone,
                        registered: 0,
                        invite_code: null
                    });
                }
            }
        }

        if (window.checkRegisteredPhones) {
            const allPhones = DB_getContacts().map(c => c.phone);
            if (allPhones.length > 0) {
                const result = await window.checkRegisteredPhones(allPhones);
                if (result && result.registered) {
                    result.registered.forEach(reg => {
                        const contact = DB_getContacts().find(c => c.phone === reg.phone);
                        if (contact) {
                            DB_saveContact({ 
                                ...contact, 
                                registered: 1,
                                id: reg.id || contact.id
                            });
                        }
                    });
                }
            }
        }

        renderContactsList();
        toast('✅ تمت مزامنة جهات الاتصال');
    } catch (e) {
        console.error('❌ فشل مزامنة جهات الاتصال', e);
        toast('⚠️ فشلت المزامنة');
    }
}

async function inviteContact(phone) {
    let inviteCode = null;
    if (window.getInviteCode) {
        inviteCode = await window.getInviteCode();
    }

    let inviteLink = '';
    if (inviteCode && window.createInviteLink) {
        inviteLink = window.createInviteLink(inviteCode);
    } else {
        inviteLink = 'https://appramz.vercel.app/';
    }

    const message = `هيّا نبدأ الدردشة على RamzApp! إنه تطبيق سريع، وبسيط، وآمن لإرسال الرسائل وإجراء المكالمات مجانًا.\n\nرابط التطبيق: ${inviteLink}`;

    if (navigator.share) {
        try {
            await navigator.share({ title: 'RamzApp - دعوة', text: message });
            toast('✅ تم فتح المشاركة');
        } catch (e) {}
    } else {
        try {
            await navigator.clipboard.writeText(message);
            toast('📋 تم نسخ نص الدعوة');
        } catch (e) {
            toast('📋 رابط الدعوة: ' + inviteLink);
        }
    }
}

$('#syncContactsBtn')?.addEventListener('click', syncContacts);
$('#backFromContactsBtn')?.addEventListener('click', () => showScreen('chats'));
$('#contactsMenuBtn')?.addEventListener('click', () => {
    showPopup([
        { icon: 'fa-user-plus', label: 'إضافة جهة اتصال', action: () => {
            const phone = prompt('📱 أدخل رقم الهاتف:');
            if (phone) {
                DB_saveContact({ id: 'c_' + Date.now(), phone: phone.replace(/[\s\-\(\)]/g, ''), name: '', registered: 0, invite_code: null });
                renderContactsList();
                toast('✅ تمت الإضافة');
            }
        }},
        { icon: 'fa-sync-alt', label: 'تحديث', action: () => { syncContacts(); } },
    ]);
});

// ==================== القصص ====================
function renderStories() {
    const bar = $('#storyBar');
    if (!bar) return;
    const stories = DB_getStories();
    bar.innerHTML = `
        <div class="story-item story-add" onclick="openStoryCamera()"><div class="story-ring"><span>+</span></div><div class="story-name">إضافة</div></div>
        ${stories.map((s, i) => `<div class="story-item" onclick="viewStory(${i})"><div class="story-ring"><div class="story-avatar">${s.avatar}</div></div><div class="story-name">${esc(s.name)}</div></div>`).join('')}
    `;
}

function openStoryCamera() {
    toast('📷 الكاميرا قريباً - استخدم زر المرفقات للصور');
}

function viewStory(index) {
    const stories = DB_getStories();
    if (index >= stories.length) return;
    storyIndex = index;
    const story = stories[index];
    $('#storyViewer').classList.add('active');
    $('#storyContent').innerHTML = `
        <div style="text-align:center;">
            <div class="story-avatar-view">${story.avatar}</div>
            <div class="story-text">📖 قصة ${esc(story.name)}<br><small style="opacity:0.7;">آخر تحديث: ${fmtTime(new Date().toISOString())}</small></div>
        </div>`;
    const progressBar = $('#storyProgress');
    progressBar.innerHTML = stories.map((_, i) => `
        <div class="story-progress-bar"><div class="story-progress-fill" style="width:${i < index ? '100%' : '0%'}"></div></div>
    `).join('');

    if (storyInterval) clearInterval(storyInterval);
    let prog = 0;
    const currentFill = progressBar.querySelectorAll('.story-progress-fill')[index];
    storyInterval = setInterval(() => {
        prog += 1;
        if (currentFill) currentFill.style.width = prog + '%';
        if (prog >= 100) {
            clearInterval(storyInterval);
            if (index + 1 < stories.length) {
                setTimeout(() => viewStory(index + 1), 300);
            } else {
                closeStoryViewer();
            }
        }
    }, 50);
}

$('#closeStoryViewer')?.addEventListener('click', closeStoryViewer);

function closeStoryViewer() {
    if (storyInterval) clearInterval(storyInterval);
    storyInterval = null;
    $('#storyViewer').classList.remove('active');
}

// ==================== القنوات ====================
function renderChannels() {
    const container = $('#channelsList');
    if (!container) return;
    const channels = DB_getChannels();
    if (!channels.length) {
        container.innerHTML = '<div class="empty-state"><p>لا توجد قنوات</p></div>';
        return;
    }
    container.innerHTML = channels.map(ch => `
        <div class="channel-item" onclick="toast('📢 ${esc(ch.name)}')">
            <div class="channel-avatar">${ch.avatar}</div>
            <div class="item-info">
                <div class="item-title">${esc(ch.name)}</div>
                <div class="item-sub">${ch.followers} متابع • ${ch.update_time}</div>
            </div>
            <i class="fas fa-chevron-left" style="color:var(--text3);"></i>
        </div>
    `).join('');
}

$('#createChannelBtn')?.addEventListener('click', () => {
    const n = prompt('اسم القناة:');
    if (n && n.trim()) {
        DB_addChannel({ id: 'ch' + Date.now(), name: n.trim(), avatar: '📢', followers: 0, update_time: 'الآن' });
        renderChannels();
        toast('✅ تم الإنشاء');
    }
});

// ==================== الأدوات ====================
$('#startAdBtn')?.addEventListener('click', () => toast('🚀 إعلان قريباً'));
$('#catalogBtn')?.addEventListener('click', () => showCatalog());
$('#broadcastBtn')?.addEventListener('click', () => broadcastMessage());

function showCatalog() {
    const catalog = DB_getCatalog();
    const catalogHTML = `
        <div class="app-header"><button class="header-btn" onclick="showScreen('tools')"><i class="fas fa-arrow-right"></i></button><h2>📦 الكتالوج</h2><button class="header-btn" onclick="addCatalogItem()"><i class="fas fa-plus"></i></button></div>
        <div class="catalog-grid">
            ${catalog.length ? catalog.map(c => `
                <div class="catalog-card" onclick="toast('🛒 ${esc(c.name)} - ${c.price}')">
                    <div class="catalog-img">${c.icon}</div>
                    <div class="catalog-info"><h5>${esc(c.name)}</h5><span>${c.price}</span></div>
                </div>
            `).join('') : '<div class="empty-state"><i class="fas fa-boxes"></i><p>الكتالوج فارغ</p></div>'}
        </div>`;
    const tempScreen = document.createElement('div');
    tempScreen.className = 'screen active no-nav';
    tempScreen.id = 'catalogTempScreen';
    tempScreen.innerHTML = catalogHTML;
    document.querySelector('.app-container')?.appendChild(tempScreen);
    $$('.screen').forEach(s => s.classList.remove('active'));
    tempScreen.classList.add('active');
    const bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = 'none';
    window._catalogScreen = tempScreen;
}

function addCatalogItem() {
    const name = prompt('اسم المنتج:');
    if (!name || !name.trim()) return;
    const price = prompt('السعر:');
    const icon = prompt('أيقونة (إيموجي):', '📦');
    DB_addCatalogItem({ id: 'cat' + Date.now(), name: name.trim(), price: price || 'غير محدد', icon: icon || '📦' });
    if (window._catalogScreen) { window._catalogScreen.remove(); }
    showCatalog();
    toast('✅ تمت الإضافة');
}

// ==================== الإعدادات ====================
$('#closeSettingsBtn')?.addEventListener('click', () => showScreen('chats'));

$('#themeToggle')?.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-sw') || e.target === this || e.target.closest('.setting-left')) {
        const currentSettings = DB_getSettings();
        const newTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
        DB_updateSetting('theme', newTheme);
        applyTheme();
        toast(newTheme === 'dark' ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري');
    }
});

$('#notifToggle')?.addEventListener('click', function(e) {
    if (e.target.closest('.toggle-sw') || e.target === this || e.target.closest('.setting-left')) {
        const currentSettings = DB_getSettings();
        const newNotif = !currentSettings.notifications;
        DB_updateSetting('notifications', newNotif);
        $('#notifSwitch')?.classList.toggle('active', newNotif);
        toast(newNotif ? '🔔 الإشعارات مفعلة' : '🔕 الإشعارات معطلة');
    }
});

function applyTheme() {
    const settings = DB_getSettings();
    document.body.classList.toggle('light-theme', settings.theme === 'light');
    const ts = $('#themeSwitch');
    if (ts) ts.classList.toggle('active', settings.theme === 'dark');
}

function exportData() {
    if (window.exportAllData) {
        const data = window.exportAllData();
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ramzapp_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        toast('💾 تم تصدير النسخة الاحتياطية');
    }
}

function importData() {
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
                    if (success) {
                        toast('✅ تم استيراد البيانات بنجاح');
                        location.reload();
                    } else {
                        toast('❌ ملف غير صالح');
                    }
                } catch (err) {
                    toast('❌ فشل في قراءة الملف');
                }
            };
            reader.readAsText(file);
        }
    };
    inp.click();
}

function clearAllData() {
    if (confirm('⚠️ حذف جميع المحادثات والبيانات نهائياً؟')) {
        if (window.clearAllData) window.clearAllData();
        toast('🗑 تم حذف جميع البيانات');
        setTimeout(() => location.reload(), 500);
    }
}

function logout() {
    if (confirm('تسجيل الخروج؟')) {
        if (window.signOut) {
            window.signOut();
        } else {
            localStorage.removeItem('ramzapp_user');
        }
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
}

// ==================== البحث داخل المحادثة ====================
$('#chatMenuBtn')?.addEventListener('click', () => {
    const c = DB_getChats().find(x => x.id === currentChatId);
    showPopup([
        { icon: 'fa-address-card', label: 'عرض جهة الاتصال', action: () => { if (c) openUserModal(c); } },
        { icon: 'fa-search', label: 'بحث في المحادثة', action: () => openInChatSearch() },
        { icon: 'fa-photo-video', label: 'وسائط', action: () => toast('📷 وسائط') },
        { icon: 'fa-thumbtack', label: c?.pinned ? 'إلغاء التثبيت' : 'تثبيت', action: () => {
            if (c) { c.pinned = !c.pinned; DB_saveChat(c); toast(c.pinned ? '📌 مثبتة' : 'تم الإلغاء'); renderChats(); }
        }},
        { icon: 'fa-trash-alt', label: 'حذف المحادثة', action: () => {
            if (confirm('حذف المحادثة؟')) { DB_deleteChat(currentChatId); currentChatId = null; showScreen('chats'); renderChats(); toast('🗑 تم الحذف'); }
        }, danger: true },
    ]);
});

function openInChatSearch() {
    const inSearch = $('#inChatSearch');
    inSearch?.classList.add('active');
    const inp = $('#inChatSearchInput');
    if (inp) { inp.value = ''; inp.focus(); }
    const res = $('#searchResults');
    if (res) res.style.display = 'none';
}

$('#closeInChatSearch')?.addEventListener('click', () => {
    $('#inChatSearch')?.classList.remove('active');
    const res = $('#searchResults');
    if (res) res.style.display = 'none';
});

$('#inChatSearchInput')?.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const resDiv = $('#searchResults');
    if (!q || !currentChatId) {
        if (resDiv) resDiv.style.display = 'none';
        return;
    }
    const msgs = DB_getMessages(currentChatId);
    const results = msgs.filter(m => m.text && m.text.toLowerCase().includes(q));
    if (!results.length) {
        if (resDiv) resDiv.innerHTML = '<div style="padding:8px;color:var(--text3);">لا توجد نتائج</div>';
    } else {
        if (resDiv) {
            resDiv.innerHTML = results.map(m => `
                <div class="search-result-item" data-msgid="${m.id}">
                    <span>${esc(m.text.substring(0, 60))}${m.text.length>60?'...':''}</span>
                    <span style="float:left;font-size:10px;color:var(--text3)">${fmtTime(m.time)}</span>
                </div>
            `).join('');
            resDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    scrollToMsg(item.dataset.msgid);
                    if (resDiv) resDiv.style.display = 'none';
                    $('#inChatSearch')?.classList.remove('active');
                });
            });
        }
    }
    if (resDiv) resDiv.style.display = 'block';
});

// ==================== اختصارات لوحة المفاتيح ====================
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        $('#searchChatsInput')?.focus();
        showScreen('chats');
    }
    if (e.key === 'Escape') {
        $('#imageViewer')?.classList.remove('active');
        $('#userModal')?.classList.remove('active');
        $('#popupOverlay')?.classList.remove('active');
        closeStoryViewer();
        endCall();
        if (window._catalogScreen) {
            window._catalogScreen.remove();
            window._catalogScreen = null;
            showScreen('tools');
        }
    }
});

// ==================== دوال عامة ====================
window.scrollToMsg = scrollToMsg;
window.openImageViewer = openImageViewer;
window.viewStory = viewStory;
window.openStoryCamera = openStoryCamera;
window.showScreen = showScreen;
window.addCatalogItem = addCatalogItem;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.logout = logout;

// ==================== التهيئة الرئيسية ====================
async function init() {
    // منع التهيئة المتكررة
    if (initRun) {
        console.warn('⚠️ تم استدعاء init() أكثر من مرة - تم تجاهل التكرار');
        return;
    }
    initRun = true;

    console.log('🚀 بدء تهيئة RamzApp v4.0 ...');

    try {
        console.log('📌 [1] بدء تهيئة قاعدة البيانات...');
        if (window.initDB) {
            await window.initDB();
            console.log('📌 [2] تمت تهيئة قاعدة البيانات بنجاح ✅');
        } else {
            console.warn('📌 [2] window.initDB غير موجود');
        }

        console.log('📌 [3] جلب المستخدم الحالي...');
        const user = DB_getCurrentUser();
        console.log('📌 [4] المستخدم:', user);

        if (!user || !user.id) {
            console.log('📌 [5] لا يوجد مستخدم - التوجيه إلى login.html');
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            return;
        }

        console.log('📌 [6] المستخدم موجود:', user.name || user.email || user.id);

        // ====== جلب البيانات من Supabase ======
        if (isOnline) {
            console.log('📌 [7] جلب البيانات من Supabase...');
            try {
                if (window.fetchUserChats) {
                    const chats = await window.fetchUserChats(user.id);
                    console.log(`📌 [8] تم جلب ${chats?.length || 0} محادثة`);
                    if (chats && chats.length > 0) {
                        chats.forEach(chat => {
                            const existing = DB_getChats().find(c => c.id === chat.id);
                            if (!existing) DB_saveChat(chat);
                        });
                    }
                }

                if (window.fetchContacts) {
                    const contacts = await window.fetchContacts(user.id);
                    console.log(`📌 [9] تم جلب ${contacts?.length || 0} جهة اتصال`);
                    if (contacts && contacts.length > 0) {
                        contacts.forEach(contact => {
                            const existing = DB_getContacts().find(c => c.id === contact.id);
                            if (!existing) DB_saveContact(contact);
                        });
                    }
                }

                if (window.fetchAllRegisteredUsers) {
                    const allUsers = await window.fetchAllRegisteredUsers();
                    console.log(`📌 [10] تم جلب ${allUsers?.length || 0} مستخدم مسجل`);
                    if (allUsers && allUsers.length > 0) {
                        const localContacts = DB_getContacts();
                        for (const contact of localContacts) {
                            const found = allUsers.find(u => u.phone === contact.phone || u.id === contact.id);
                            if (found && !contact.registered) {
                                DB_saveContact({ ...contact, registered: 1, id: found.id || contact.id });
                            }
                        }
                    }
                }
                console.log('📌 [11] تم جلب جميع البيانات من Supabase ✅');
            } catch (e) {
                console.warn('⚠️ فشل جلب البيانات من Supabase:', e);
            }
        } else {
            console.log('📌 [7] غير متصل بالإنترنت - العمل بالبيانات المحلية فقط');
        }

        console.log('📌 [12] دخول التطبيق (enterApp)...');
        enterApp();

        console.log('📌 [13] تهيئة التشفير (initEncryption)...');
        await initEncryption();
        console.log('📌 [14] تم تهيئة التشفير ✅');

        console.log('📌 [15] كشف أيقونات FontAwesome...');
        detectFontAwesome();

        if (isOnline && window.setUserOnlineStatus) {
            window.setUserOnlineStatus(true);
            console.log('📌 [16] تم تحديث حالة الاتصال إلى متصل');
        }

        if (isOnline && window.syncAllPendingMessages) {
            console.log('📌 [17] بدء المزامنة التلقائية...');
            setTimeout(() => window.syncAllPendingMessages(), 1500);
        }

        console.log('✅ تم تهيئة RamzApp بنجاح');
        console.log('💬 الإصدار 4.0 | Offline-First + E2E Encryption');

    } catch (err) {
        console.error('❌ خطأ في تهيئة التطبيق:', err);
        toast('⚠️ حدث خطأ أثناء تهيئة التطبيق');
        setTimeout(() => {
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }, 3000);
    }
}

// ==================== بدء التطبيق ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 100);
}
