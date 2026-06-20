// ======================================================================
// common.js - الإصدار النهائي الكامل v4.0
// جميع الميزات: القوائم، المجموعات، القنوات، القصص (أفقي - 24 ساعة)، الإشعارات، التشفير، المزامنة
// مع إصلاحات شاملة لجميع الأخطاء ودعم PWA
// ======================================================================

// ==================== نظام تحميل الأيقونات ====================
(function() {
    const FONTAWESOME_SOURCES = [
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
        'https://use.fontawesome.com/releases/v6.5.0/css/all.css',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
    ];
    let fontAwesomeLoaded = false;
    let loadAttempts = 0;
    const MAX_ATTEMPTS = 10;
    let retryTimer = null;

    function checkFontAwesomeLoaded() {
        const testEl = document.createElement('i');
        testEl.className = 'fas fa-home';
        testEl.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
        document.body.appendChild(testEl);
        const style = window.getComputedStyle(testEl, ':before');
        const content = style.getPropertyValue('content');
        document.body.removeChild(testEl);
        if (content && content !== 'none' && content !== '') {
            fontAwesomeLoaded = true;
            document.body.classList.remove('fa-fallback', 'no-fontawesome');
            console.log('✅ FontAwesome loaded successfully');
            return true;
        }
        return false;
    }

    function loadFontAwesomeFromSource(url) {
        return new Promise((resolve) => {
            const existing = document.querySelector(`link[href="${url}"]`);
            if (existing) { resolve(true); return; }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => { setTimeout(() => resolve(checkFontAwesomeLoaded()), 300); };
            link.onerror = () => { resolve(false); };
            document.head.appendChild(link);
        });
    }

    async function loadFontAwesome() {
        if (checkFontAwesomeLoaded()) { fontAwesomeLoaded = true; return true; }
        for (const source of FONTAWESOME_SOURCES) {
            if (await loadFontAwesomeFromSource(source)) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        if (loadAttempts < MAX_ATTEMPTS) {
            loadAttempts++;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(loadFontAwesome, 2000);
        } else {
            console.warn('⚠️ FontAwesome failed after maximum attempts.');
        }
        return false;
    }

    window.ensureFontAwesome = loadFontAwesome;
    window.isFontAwesomeLoaded = () => fontAwesomeLoaded;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(loadFontAwesome, 100));
    } else {
        setTimeout(loadFontAwesome, 100);
    }
    setTimeout(loadFontAwesome, 2000);
    setTimeout(loadFontAwesome, 5000);
})();

// ==================== دوال مساعدة ====================
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
function toast(msg, duration = 2000) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

// ==================== تأثير صوتي (طوط طوط) ====================
let audioCtx = null;
function playNotificationSound() {
    const settings = DB_getSettings ? DB_getSettings() : { notifications: true };
    if (!settings.notifications) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.frequency.value = 800;
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.12);
        setTimeout(() => {
            try {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.frequency.value = 600;
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0.25, audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.12);
            } catch(e) {}
        }, 150);
    } catch(e) {}
}

// ==================== متغيرات الحالة ====================
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
let isOnline = navigator.onLine;
let initRun = false;
let appReady = false;
let deferredPrompt = null;

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
function DB_deleteStory(id) { if (window.deleteStory) window.deleteStory(id); }
function DB_getChannels() { return window.getChannels ? window.getChannels() : []; }
function DB_addChannel(ch) { if (window.addChannel) window.addChannel(ch); }
function DB_getCalls() { return window.getCalls ? window.getCalls() : []; }
function DB_addCall(c) { if (window.addCall) window.addCall(c); }
function DB_getCatalog() { return window.getCatalog ? window.getCatalog() : []; }
function DB_addCatalogItem(it) { if (window.addCatalogItem) window.addCatalogItem(it); }
function DB_getSettings() { return window.getSettings ? window.getSettings() : { theme: 'dark', notifications: true }; }
function DB_updateSetting(k, v) { if (window.updateSetting) window.updateSetting(k, v); }
function DB_getCurrentUser() {
    const saved = localStorage.getItem('ramzapp_user');
    if (saved) try { return JSON.parse(saved); } catch(e) {}
    return null;
}

// ==================== التشفير E2E ====================
let currentUserKeyPair = null;
let peerPublicKeys = {};
const E2E_KEY_STORE = 'ramzapp_e2e_keys';

async function generateKeyPair() {
    return await window.crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" },
        true, ["encrypt", "decrypt"]
    );
}
async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}
async function importPublicKey(base64Key) {
    const binaryDer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}
async function exportPrivateKey(key) {
    const exported = await window.crypto.subtle.exportKey("pkcs8", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}
async function importPrivateKey(base64Key) {
    const binaryDer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}
async function openE2EStore() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('RamzAppE2E', 1);
        req.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', {keyPath:'id'}); };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = reject;
    });
}
async function saveKeyPairToStorage(userId, publicKey, privateKey) {
    const db = await openE2EStore();
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');
    await Promise.all([
        new Promise((res,rej) => { const req = store.put({id: userId+'_public', key: publicKey}); req.onsuccess=res; req.onerror=rej; }),
        new Promise((res,rej) => { const req = store.put({id: userId+'_private', key: privateKey}); req.onsuccess=res; req.onerror=rej; })
    ]);
}
async function loadKeyPairFromStorage(userId) {
    const db = await openE2EStore();
    const tx = db.transaction('keys', 'readonly');
    const store = tx.objectStore('keys');
    const publicKey = await new Promise(resolve => { const req = store.get(userId+'_public'); req.onsuccess = () => resolve(req.result); });
    const privateKey = await new Promise(resolve => { const req = store.get(userId+'_private'); req.onsuccess = () => resolve(req.result); });
    if (publicKey && privateKey) {
        return { publicKey: await importPublicKey(publicKey.key), privateKey: await importPrivateKey(privateKey.key) };
    }
    return null;
}
async function initEncryption() {
    const user = DB_getCurrentUser();
    if (!user) return;
    const storedKeys = await loadKeyPairFromStorage(user.id);
    if (storedKeys) { currentUserKeyPair = storedKeys; }
    else {
        currentUserKeyPair = await generateKeyPair();
        const pubBase64 = await exportPublicKey(currentUserKeyPair.publicKey);
        const privBase64 = await exportPrivateKey(currentUserKeyPair.privateKey);
        await saveKeyPairToStorage(user.id, pubBase64, privBase64);
        if (window.supabaseClient) {
            try { await window.supabaseClient.from('users').update({ public_key: pubBase64 }).eq('id', user.id); } catch(e) {}
        }
    }
}
async function encryptMessage(plaintext, peerId) {
    if (!currentUserKeyPair) throw new Error('Encryption not initialized');
    let peerPublicKey = peerPublicKeys[peerId];
    if (!peerPublicKey && window.supabaseClient) {
        const { data } = await window.supabaseClient.from('users').select('public_key').eq('id', peerId).single();
        if (data?.public_key) { peerPublicKey = await importPublicKey(data.public_key); peerPublicKeys[peerId] = peerPublicKey; }
    }
    if (!peerPublicKey) throw new Error('Peer public key not found');
    const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt","decrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plaintext);
    const encryptedData = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encodedText);
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedKey = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, peerPublicKey, rawAesKey);
    return {
        encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
        encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
        iv: btoa(String.fromCharCode(...iv))
    };
}
async function decryptMessage(payload) {
    if (!currentUserKeyPair) throw new Error('Encryption not initialized');
    const encryptedData = Uint8Array.from(atob(payload.encryptedData), c => c.charCodeAt(0));
    const encryptedKey = Uint8Array.from(atob(payload.encryptedKey), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
    const rawAesKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, currentUserKeyPair.privateKey, encryptedKey);
    const aesKey = await window.crypto.subtle.importKey("raw", rawAesKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const decryptedData = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, encryptedData);
    return new TextDecoder().decode(decryptedData);
}

// ==================== دالة آمنة لتحديث حالة الاتصال ====================
function safeSetUserOnlineStatus(status) {
    if (!window.supabaseClient) {
        console.warn('⚠️ Supabase غير متاح، لا يمكن تحديث الحالة');
        return Promise.resolve();
    }
    const userId = DB_getCurrentUser()?.id;
    if (!userId) return Promise.resolve();
    return window.supabaseClient
        .from('users')
        .update({ is_online: status, last_seen: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {})
        .catch((err) => {
            console.warn('⚠️ فشل تحديث حالة الاتصال:', err);
        });
}
window.setUserOnlineStatus = safeSetUserOnlineStatus;

// ==================== مؤشر الاتصال ====================
function updateConnectionIndicator() {
    try {
        const indicator = document.getElementById('connectionIndicator');
        if (!indicator) return;
        if (!isOnline) {
            indicator.textContent = '📡 أنت غير متصل بالإنترنت - التطبيق يعمل محلياً';
            indicator.classList.add('offline');
        } else {
            indicator.classList.remove('offline');
            setTimeout(() => { if (isOnline) indicator.classList.remove('offline'); }, 2000);
        }
    } catch(e) {}
}

// ==================== الاشتراك في المحادثة الحالية ====================
function subscribeToCurrentChat() {
    if (!currentChatId || !isOnline) return;
    if (typeof window.subscribeToChat === 'function') {
        window.subscribeToChat(currentChatId, (msg) => {
            const existing = DB_getMessages(currentChatId);
            if (!existing.find(m => m.id === msg.id)) {
                msg.sync_status = 'delivered'; msg.status = 'delivered';
                DB_addMessage(msg);
                const chat = DB_getChats().find(c => c.id === currentChatId);
                if (chat) {
                    chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
                    chat.last_time = msg.time;
                    if (!chat.online && msg.sender_id !== 'me') chat.unread = (chat.unread || 0) + 1;
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
                    if (isTyping) { st.textContent = 'يكتب الآن...'; st.className = 'chat-header-status typing'; }
                    else { st.textContent = chat.online ? 'متصل الآن' : (chat.last_seen || ''); st.className = 'chat-header-status' + (chat.online ? ' online' : ''); }
                }
                DB_saveChat(chat);
                if (currentScreen === 'chats') renderChats();
            }
        });
    }
}

// ==================== PWA – تثبيت التطبيق ====================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installAppBtn');
    if (btn) {
        btn.style.display = 'flex';
        btn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('✅ تم تثبيت التطبيق');
                        toast('✅ تم تثبيت RamzApp على جهازك');
                    }
                    deferredPrompt = null;
                });
            }
        });
    }
});

window.addEventListener('appinstalled', () => {
    console.log('✅ RamzApp installed successfully');
    toast('🎉 شكراً لتثبيت RamzApp!');
});

// ==================== دخول التطبيق ====================
function enterApp() {
    if (appReady) { console.warn('⚠️ enterApp() تم استدعاؤها أكثر من مرة'); return; }
    appReady = true;
    console.log('📌 enterApp() - عرض واجهة التطبيق');
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    const user = DB_getCurrentUser();
    if (user && window.inMemoryDB) {
        window.inMemoryDB.user = user;
        console.log('✅ تم تعيين المستخدم في inMemoryDB:', user.name);
    }
    showScreen('chats');
    updateStats();
    applyTheme();
    if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator();
    if (typeof bindCustomMenuButtons === 'function') bindCustomMenuButtons();
    setTimeout(() => {
        if (typeof renderChats === 'function') renderChats();
        if (typeof renderContactsList === 'function') renderContactsList();
        if (typeof renderStories === 'function') renderStories();
        if (typeof updateStats === 'function') updateStats();
    }, 400);
    console.log('✅ تم دخول التطبيق بنجاح');
}

// ==================== التنقل بين الشاشات ====================
const screens = ['chatsScreen','chatScreen','contactsScreen','callsScreen','updatesScreen','toolsScreen','profileScreen','settingsScreen'];
function showScreen(id) {
    currentScreen = id;
    screens.forEach(s => { const el = document.getElementById(s); if (el) el.classList.remove('active'); });
    const target = document.getElementById(id + 'Screen') || document.getElementById(id);
    if (target) target.classList.add('active');
    const noNav = ['chatScreen','profileScreen','settingsScreen'];
    const bottomNav = $('#bottomNav');
    if (bottomNav) bottomNav.style.display = noNav.includes(id+'Screen') || noNav.includes(id) ? 'none' : 'flex';
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    if (id === 'chats') renderChats();
    else if (id === 'contacts') renderContactsList();
    else if (id === 'calls') renderCalls();
    else if (id === 'updates') { renderStories(); renderChannels(); }
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
    const $sv = $('#statViews'); if ($sv) $sv.textContent = allMessages;
    const $sc = $('#statCatalog'); if ($sc) $sc.textContent = catalogCount;
    const $sch = $('#statChats'); if ($sch) $sch.textContent = chatsCount;
}

// ==================== عرض المحادثات ====================
function renderChats(filter = '') {
    const container = document.getElementById('chatsList');
    if (!container) {
        console.error('❌ عنصر chatsList غير موجود');
        return;
    }
    if (!window.inMemoryDB?.user) {
        const user = DB_getCurrentUser();
        if (user && window.inMemoryDB) window.inMemoryDB.user = user;
    }
    let chats = [...DB_getChats()].sort((a,b) => {
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
    let html = '';
    chats.forEach(c => {
        const isTyping = c._typing && (Date.now() - c._typing < 5000);
        html += `
            <div class="chat-item" data-id="${c.id}">
                <div class="chat-avatar" data-id="${c.id}">${c.avatar || '?'}${c.online ? '<span class="online-dot"></span>' : ''}</div>
                <div class="chat-info">
                    <div class="chat-name-row">
                        <span class="chat-name">${c.pinned ? '<i class="fas fa-thumbtack pinned-icon"></i> ' : ''}${esc(c.name)}</span>
                        <span class="chat-time">${c.last_time || c.lastTime ? timeAgo(c.last_time || c.lastTime) : ''}</span>
                    </div>
                    <div class="chat-preview">
                        <span class="last-msg">${isTyping ? '<span class="typing-indicator-chat">يكتب الآن...</span>' : (c.last_msg || c.lastMsg ? esc((c.last_msg||c.lastMsg).substring(0,35)) + ((c.last_msg||c.lastMsg).length>35?'...':'') : '👋 ابدأ المحادثة')}</span>
                        ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : '<span class="check-mark read"><i class="fas fa-check-double"></i></span>'}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    container.querySelectorAll('.chat-item').forEach(item => {
        const id = item.dataset.id;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.chat-avatar')) {
                const chat = DB_getChats().find(c => c.id === id);
                if (chat) openUserModal(chat);
            } else {
                openChat(id);
            }
        });
    });
    console.log(`✅ renderChats: تم عرض ${chats.length} محادثة`);
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
$('#popupOverlay')?.addEventListener('click', e => { if (e.target === $('#popupOverlay')) $('#popupOverlay').classList.remove('active'); });

// ==================== أزرار رئيسية ====================
$('#cameraBtn')?.addEventListener('click', () => openStoryCamera());
$('#settingsBtn')?.addEventListener('click', () => { window.location.href = 'settings.html'; });
$('#contactsBtn')?.addEventListener('click', () => showScreen('contacts'));

// ==================== القوائم المتقدمة ====================
function getCustomMenuItems(screen) {
    const menus = {
        'chats': [
            { icon: 'fa-users', label: 'مجموعة جديدة', action: () => createGroupUI() },
            { icon: 'fa-bullhorn', label: 'الرسائل الجماعية التجارية', action: () => toast('📢 قيد التطوير') },
            { icon: 'fa-layer-group', label: 'المجتمعات', action: () => toast('🏘️ قيد التطوير') },
            { icon: 'fa-list-ul', label: 'القوائم', action: () => toast('📋 قيد التطوير') },
            { icon: 'fa-laptop', label: 'الأجهزة المرتبطة', action: () => toast('💻 قيد التطوير') },
            { icon: 'fa-star', label: 'مميزة بنجمة', action: () => toast('⭐ قيد التطوير') },
            { icon: 'fa-ad', label: 'الإعلان', action: () => showScreen('tools') },
            { icon: 'fa-sliders-h', label: 'تخصيص RamzApp', action: () => toast('🎨 قيد التطوير') },
            { icon: 'fa-cog', label: 'الإعدادات', action: () => { window.location.href = 'settings.html'; } },
            { icon: 'fa-ellipsis-h', label: 'المزيد...', action: 'showChatsSubMenu' }
        ],
        'chats_sub': [
            { icon: 'fa-archive', label: 'المؤرشفة', action: () => toast('📦 المؤرشفة') },
            { icon: 'fa-star', label: 'المفضلة', action: () => toast('⭐ المفضلة') },
            { icon: 'fa-sync-alt', label: 'مزامنة', action: () => { if (window.syncAllPendingMessages) window.syncAllPendingMessages(); } },
            { icon: 'fa-user-plus', label: 'دعوة أصدقاء', action: () => inviteContact('') },
        ],
        'contacts': [
            { icon: 'fa-user-plus', label: 'إضافة جهة اتصال', action: () => {
                const phone = prompt('📱 أدخل رقم الهاتف:');
                if (phone) {
                    DB_saveContact({ id: 'c_' + Date.now(), phone: phone.replace(/[\s\-\(\)]/g, ''), name: '', registered: 0, invite_code: null });
                    renderContactsList();
                    toast('✅ تمت الإضافة');
                }
            }},
            { icon: 'fa-sync-alt', label: 'مزامنة جهات الاتصال', action: () => syncContacts() },
            { icon: 'fa-address-card', label: 'جهات اتصال مقترحة', action: () => toast('👥 قريباً') },
            { icon: 'fa-file-export', label: 'تصدير جهات الاتصال', action: () => toast('📤 قريباً') },
        ],
        'calls': [
            { icon: 'fa-ad', label: 'الإعلان', action: () => showScreen('tools') },
            { icon: 'fa-trash-alt', label: 'مسح سجل المكالمات', action: () => {
                if (confirm('⚠️ مسح سجل المكالمات؟')) {
                    if (window.inMemoryDB) window.inMemoryDB.calls = [];
                    toast('🗑 تم المسح');
                    renderCalls();
                }
            }},
            { icon: 'fa-calendar-alt', label: 'مجدولة', action: () => toast('📅 قيد التطوير') },
            { icon: 'fa-phone', label: 'مكالمة جديدة', action: () => toast('📞 قيد التطوير') },
            { icon: 'fa-cog', label: 'الإعدادات', action: () => { window.location.href = 'settings.html'; } },
        ],
        'updates': [
            { icon: 'fa-ad', label: 'إعلان', action: () => showScreen('tools') },
            { icon: 'fa-plus-circle', label: 'إنشاء قناة', action: () => createChannelUI() },
            { icon: 'fa-lock', label: 'خصوصية الحالة', action: () => toast('🔒 قيد التطوير') },
            { icon: 'fa-star', label: 'مميزة بنجمة', action: () => toast('⭐ قيد التطوير') },
            { icon: 'fa-camera', label: 'إضافة حالة', action: () => openStoryCamera() },
            { icon: 'fa-archive', label: 'أرشيف الحالات', action: () => toast('📦 قيد التطوير') },
            { icon: 'fa-cog', label: 'الإعدادات', action: () => { window.location.href = 'settings.html'; } },
        ],
        'tools': [
            { icon: 'fa-ad', label: 'الإعلان', action: () => toast('🚀 قريباً') },
            { icon: 'fa-link', label: 'رابط قصير', action: () => toast('🔗 قيد التطوير') },
            { icon: 'fa-cog', label: 'الإعدادات', action: () => { window.location.href = 'settings.html'; } },
            { icon: 'fa-check-circle', label: 'Meta Verified', action: () => toast('✅ قيد التطوير') },
            { icon: 'fa-boxes', label: 'الكتالوج', action: () => showCatalog() },
        ],
        'chat_main': [
            { icon: 'fa-address-card', label: 'عرض جهة الاتصال', action: () => {
                const c = DB_getChats().find(x => x.id === currentChatId);
                if (c) openUserModal(c);
            }},
            { icon: 'fa-search', label: 'بحث في المحادثة', action: () => openInChatSearch() },
            { icon: 'fa-photo-video', label: 'وسائط وروابط', action: () => toast('📷 قيد التطوير') },
            { icon: 'fa-bell-slash', label: 'كتم الإشعارات', action: () => {
                const chat = DB_getChats().find(c => c.id === currentChatId);
                if (chat) { chat.muted = !chat.muted; DB_saveChat(chat); toast(chat.muted ? '🔕 تم الكتم' : '🔔 تم إلغاء الكتم'); }
            }},
            { icon: 'fa-clock', label: 'رسائل ذاتية الاختفاء', action: () => {
                const seconds = prompt('مدة البقاء (30، 60، 90):', '30');
                if (seconds) {
                    const chat = DB_getChats().find(c => c.id === currentChatId);
                    if (chat) { chat.disappearTime = parseInt(seconds); DB_saveChat(chat); toast(`⏳ ${seconds} ثانية`); }
                }
            }},
            { icon: 'fa-users', label: 'إدارة المجموعة', action: () => {
                const chat = DB_getChats().find(c => c.id === currentChatId);
                if (chat && chat.is_group) openGroupManagement(currentChatId);
                else toast('⚠️ هذه ليست مجموعة');
            }},
            { icon: 'fa-palette', label: 'سمة الدردشة', action: () => toast('🎨 قيد التطوير') },
            { icon: 'fa-ellipsis-h', label: 'المزيد...', action: 'showChatSubMenu' }
        ],
        'chat_sub': [
            { icon: 'fa-flag', label: 'إبلاغ', action: () => {
                const reason = prompt('سبب الإبلاغ:');
                if (reason) toast('✅ تم الإبلاغ');
            }},
            { icon: 'fa-ban', label: 'حظر', action: () => {
                const chat = DB_getChats().find(c => c.id === currentChatId);
                if (chat) { chat.blocked = !chat.blocked; DB_saveChat(chat); toast(chat.blocked ? '🚫 تم الحظر' : '✅ تم إلغاء الحظر'); }
            }},
            { icon: 'fa-trash-alt', label: 'مسح المحادثة', action: () => {
                if (confirm('⚠️ مسح جميع الرسائل؟')) {
                    const msgs = DB_getMessages(currentChatId);
                    msgs.forEach(m => DB_deleteMessage(m.id));
                    const chat = DB_getChats().find(c => c.id === currentChatId);
                    if (chat) { chat.last_msg = ''; chat.last_time = new Date().toISOString(); DB_saveChat(chat); }
                    renderMessages();
                    toast('🧹 تم المسح');
                }
            }},
            { icon: 'fa-exchange-alt', label: 'نقل الدردشة', action: () => toast('📤 قيد التطوير') },
            { icon: 'fa-plus-square', label: 'إضافة اختصار', action: () => toast('📌 قيد التطوير') },
        ],
        'settings': [
            { icon: 'fa-home', label: 'الرئيسية', action: () => showScreen('chats') },
            { icon: 'fa-user-edit', label: 'تعديل الملف الشخصي', action: () => { window.location.href = 'edit-profile.html'; } },
            { icon: 'fa-info-circle', label: 'حول التطبيق', action: () => toast('ℹ️ RamzApp v4.0') },
            { icon: 'fa-sign-out-alt', label: 'تسجيل الخروج', action: () => logout(), danger: true },
            { icon: 'fa-trash-alt', label: 'حذف الحساب', action: () => {
                if (confirm('⚠️ حذف الحساب نهائياً؟')) {
                    if (window.deleteUserAccount) window.deleteUserAccount();
                    else { localStorage.removeItem('ramzapp_user'); window.location.href = 'login.html'; }
                }
            }, danger: true },
        ]
    };
    return menus[screen] || [];
}

function showScreenMenu(screen) {
    const items = getCustomMenuItems(screen);
    if (!items || !items.length) {
        showPopup([
            { icon: 'fa-cog', label: 'الإعدادات', action: () => { window.location.href = 'settings.html'; } },
            { icon: 'fa-sign-out-alt', label: 'تسجيل الخروج', action: () => logout(), danger: true },
        ]);
        return;
    }
    const popupItems = items.map(item => {
        return {
            icon: item.icon,
            label: item.label,
            action: () => {
                if (typeof item.action === 'string') {
                    if (item.action === 'showChatsSubMenu') showScreenMenu('chats_sub');
                    else if (item.action === 'showChatSubMenu') showScreenMenu('chat_sub');
                    else if (typeof window[item.action] === 'function') window[item.action]();
                    else toast('⏳ قيد التطوير');
                } else {
                    item.action();
                }
            },
            danger: item.danger || false
        };
    });
    showPopup(popupItems);
}

function bindCustomMenuButtons() {
    const btnMap = {
        'mainMenuBtn': 'chats',
        'contactsMenuBtn': 'contacts',
        'callsMenuBtn': 'calls',
        'updatesMenuBtn': 'updates',
        'toolsMenuBtn': 'tools',
        'settingsMenuBtn': 'settings',
        'chatMenuBtn': 'chat_main',
        'profileMenuBtn': 'settings'
    };
    Object.keys(btnMap).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            const screen = btnMap[id];
            newBtn.addEventListener('click', () => {
                if (screen === 'chat_main' && !currentChatId) {
                    toast('⚠️ لا توجد محادثة مفتوحة');
                    return;
                }
                showScreenMenu(screen);
            });
        }
    });
}

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
        id: gid,
        name: name.trim(),
        avatar: '👥',
        last_seen: 'الآن',
        online: true,
        unread: 0,
        pinned: false,
        bio: 'مجموعة جديدة',
        last_msg: '',
        last_time: new Date().toISOString(),
        is_group: true,
        created_by: currentUser.id,
        members: [{ id: currentUser.id, name: currentUser.name || 'أنت', avatar: currentUser.avatar || '?', role: 'admin' }]
    };
    selectedIds.forEach(id => {
        const contact = contacts.find(c => c.id === id);
        if (contact) {
            group.members.push({ id: contact.id, name: contact.name || 'مستخدم', avatar: contact.avatar || '?', role: 'member' });
        }
    });
    DB_saveChat(group);
    renderChats();
    toast(`✅ تم إنشاء المجموعة "${name.trim()}" مع ${group.members.length} عضو`);
    openChat(gid);
}

function getGroupMembers(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    return chat?.is_group ? chat.members || [] : [];
}
function getGroupAdmins(chatId) {
    return getGroupMembers(chatId).filter(m => m.role === 'admin');
}
function isGroupAdmin(chatId, userId) {
    return getGroupAdmins(chatId).some(a => a.id === userId);
}
function addGroupMember(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const currentUser = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, currentUser.id)) { toast('⚠️ فقط المشرفون يمكنهم إضافة أعضاء'); return false; }
    if (chat.members.some(m => m.id === userId)) { toast('⚠️ هذا العضو موجود بالفعل'); return false; }
    const contact = DB_getContacts().find(c => c.id === userId);
    if (!contact) return false;
    chat.members.push({ id: userId, name: contact.name || 'مستخدم', avatar: contact.avatar || '?', role: 'member' });
    DB_saveChat(chat);
    toast('✅ تمت إضافة العضو');
    return true;
}
function removeGroupMember(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const currentUser = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, currentUser.id)) { toast('⚠️ فقط المشرفون يمكنهم حذف أعضاء'); return false; }
    if (isGroupAdmin(chatId, userId)) { toast('⚠️ لا يمكن إزالة مشرف'); return false; }
    if (userId === chat.created_by) { toast('⚠️ لا يمكن إزالة منشئ المجموعة'); return false; }
    chat.members = chat.members.filter(m => m.id !== userId);
    DB_saveChat(chat);
    toast('✅ تمت إزالة العضو');
    return true;
}
function promoteToAdmin(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const currentUser = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, currentUser.id)) { toast('⚠️ فقط المشرفون يمكنهم تعيين مشرفين'); return false; }
    const member = chat.members.find(m => m.id === userId);
    if (!member) return false;
    if (member.role === 'admin') { toast('⚠️ هذا العضو مشرف بالفعل'); return false; }
    member.role = 'admin';
    DB_saveChat(chat);
    toast('✅ تمت الترقية إلى مشرف');
    return true;
}
function demoteFromAdmin(chatId, userId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const currentUser = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, currentUser.id)) { toast('⚠️ فقط المشرفون يمكنهم تغيير صلاحيات المشرفين'); return false; }
    if (userId === chat.created_by) { toast('⚠️ لا يمكن خفض منشئ المجموعة'); return false; }
    const member = chat.members.find(m => m.id === userId);
    if (!member || member.role !== 'admin') return false;
    member.role = 'member';
    DB_saveChat(chat);
    toast('✅ تم خفض الصلاحية إلى عضو');
    return true;
}
function leaveGroup(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const currentUser = DB_getCurrentUser();
    if (currentUser.id === chat.created_by) { toast('⚠️ لا يمكن لمنشئ المجموعة مغادرتها'); return false; }
    chat.members = chat.members.filter(m => m.id !== currentUser.id);
    if (chat.members.length === 0) { DB_deleteChat(chatId); toast('🗑️ تم حذف المجموعة'); }
    else { DB_saveChat(chat); toast('✅ تمت مغادرة المجموعة'); }
    if (currentChatId === chatId) { currentChatId = null; showScreen('chats'); }
    renderChats();
    return true;
}
function deleteGroup(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) return false;
    const currentUser = DB_getCurrentUser();
    if (!isGroupAdmin(chatId, currentUser.id)) { toast('⚠️ فقط المشرفون يمكنهم حذف المجموعة'); return false; }
    if (!confirm('⚠️ هل أنت متأكد من حذف المجموعة وجميع رسائلها؟')) return false;
    DB_deleteChat(chatId);
    if (currentChatId === chatId) { currentChatId = null; showScreen('chats'); }
    renderChats();
    toast('🗑️ تم حذف المجموعة');
    return true;
}
function openGroupManagement(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat?.is_group) { toast('⚠️ هذه ليست مجموعة'); return; }
    window._groupManagementChatId = chatId;
    const modal = document.getElementById('groupManagementModal');
    if (modal) {
        renderGroupManagement(chatId);
        modal.classList.add('active');
    } else { toast('⚠️ مودال إدارة المجموعة غير موجود'); }
}
function renderGroupManagement(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat) return;
    const container = document.getElementById('groupManagementContent');
    if (!container) return;
    const currentUser = DB_getCurrentUser();
    const isAdmin = isGroupAdmin(chatId, currentUser.id);
    const members = chat.members || [];
    let html = `<div style="padding:8px 0;"><h3>${esc(chat.name)}</h3><p style="color:var(--text3);font-size:13px;">${members.length} عضو</p><hr style="border-color:var(--border);margin:12px 0;"><div style="max-height:300px;overflow-y:auto;">`;
    members.forEach(m => {
        const isAdminUser = m.role === 'admin';
        const isCreator = m.id === chat.created_by;
        html += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;color:var(--text);">${m.avatar || m.name?.charAt(0) || '?'}</div>
            <div style="flex:1;"><div style="font-weight:600;">${esc(m.name)} ${isCreator ? '👑' : ''}</div><div style="font-size:11px;color:var(--text3);">${isAdminUser ? 'مشرف' : 'عضو'}</div></div>
            ${isAdmin && m.id !== currentUser.id ? `<div style="display:flex;gap:6px;">
                ${!isAdminUser ? `<button class="promo-btn" style="padding:2px 10px;font-size:10px;" onclick="promoteToAdmin('${chatId}','${m.id}')">ترقية</button>` :
                `<button class="promo-btn" style="padding:2px 10px;font-size:10px;background:#ff6b6b;color:#fff;" onclick="demoteFromAdmin('${chatId}','${m.id}')">خفض</button>`}
                ${!isAdminUser && m.id !== chat.created_by ? `<button class="promo-btn" style="padding:2px 10px;font-size:10px;background:#ff6b6b;color:#fff;" onclick="removeGroupMember('${chatId}','${m.id}')">✕</button>` : ''}
            </div>` : ''}
        </div>`;
    });
    html += `</div><hr style="border-color:var(--border);margin:12px 0;">
    ${isAdmin ? `<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="promo-btn" onclick="showAddMemberUI('${chatId}')" style="background:var(--accent);color:#fff;">➕ إضافة عضو</button>
    <button class="promo-btn" onclick="deleteGroup('${chatId}')" style="background:#ff4444;color:#fff;">🗑️ حذف المجموعة</button></div>` :
    `<button class="promo-btn" onclick="leaveGroup('${chatId}')" style="background:#ff4444;color:#fff;">🚪 مغادرة المجموعة</button>`}
    </div>`;
    container.innerHTML = html;
}
function showAddMemberUI(chatId) {
    const chat = DB_getChats().find(c => c.id === chatId);
    if (!chat) return;
    const currentMembers = chat.members.map(m => m.id);
    const available = DB_getContacts().filter(c => c.registered && !currentMembers.includes(c.id) && c.id !== chat.created_by);
    if (!available.length) { toast('⚠️ لا توجد جهات اتصال متاحة'); return; }
    const choices = available.map((c,i) => `${i+1}. ${c.name} (${c.phone})`).join('\n');
    const selection = prompt(`اختر رقم العضو لإضافته:\n${choices}`);
    if (selection === null) return;
    const index = parseInt(selection) - 1;
    if (isNaN(index) || index < 0 || index >= available.length) { toast('⚠️ اختيار غير صالح'); return; }
    const selected = available[index];
    addGroupMember(chatId, selected.id);
    renderGroupManagement(chatId);
}

// ==================== دوال القنوات ====================
function createChannelUI() {
    const name = prompt('📢 اسم القناة:');
    if (!name || !name.trim()) return;
    const description = prompt('📝 وصف القناة:');
    const avatar = prompt('اختر إيموجي (اضغط Enter لاستخدام 📢)', '📢') || '📢';
    const inviteCode = Math.random().toString(36).substring(2,10).toUpperCase();
    const channelData = {
        id: 'ch_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
        name: name.trim(),
        avatar: avatar.trim(),
        description: description?.trim() || '',
        invite_code: inviteCode,
        followers: 1,
        created_by: DB_getCurrentUser()?.id
    };
    DB_addChannel(channelData);
    if (isOnline && window.createChannel) {
        window.createChannel(channelData).catch(() => console.warn('⚠️ فشل المزامنة'));
    }
    renderChannels();
    toast(`✅ تم إنشاء القناة "${name.trim()}"`);
}

function renderChannels(filter = '') {
    const container = $('#channelsList');
    if (!container) return;
    let channels = [...DB_getChannels()];
    if (filter) {
        const q = filter.toLowerCase();
        channels = channels.filter(ch => ch.name.toLowerCase().includes(q) || (ch.description && ch.description.toLowerCase().includes(q)));
    }
    channels.sort((a,b) => (b.followers||0) - (a.followers||0));
    if (!channels.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>${filter ? 'لا توجد قنوات مطابقة' : 'لا توجد قنوات بعد'}</p></div>`;
        return;
    }
    container.innerHTML = channels.map(ch => `
        <div class="channel-item" onclick="openChannelDetails('${ch.id}')">
            <div class="channel-avatar">${ch.avatar || '📢'}</div>
            <div class="item-info">
                <div class="item-title">${esc(ch.name)}</div>
                <div class="item-sub">${ch.followers||0} متابع${ch.description ? ` • ${esc(ch.description.substring(0,30))}${ch.description.length>30?'...':''}` : ''}</div>
            </div>
            <button class="header-btn" onclick="event.stopPropagation(); shareChannelLink('${ch.id}')" title="مشاركة"><i class="fas fa-share-alt" style="color:var(--accent);"></i></button>
            <button class="header-btn" onclick="event.stopPropagation(); openChannelManagement('${ch.id}')" title="إدارة"><i class="fas fa-ellipsis-v"></i></button>
        </div>
    `).join('');
}

function openChannelDetails(channelId) {
    window.location.href = `channel-feed.html?id=${channelId}`;
}

async function subscribeToChannel(channelId) {
    if (!isOnline) { toast('📡 يجب الاتصال بالإنترنت'); return; }
    const user = DB_getCurrentUser();
    if (!user) { toast('⚠️ يجب تسجيل الدخول أولاً'); return; }
    try {
        await window.joinChannel(channelId);
        toast('✅ تم الانضمام إلى القناة');
        const channel = DB_getChannels().find(c => c.id === channelId);
        if (channel) {
            if (!channel.subscribers) channel.subscribers = [];
            channel.subscribers.push(user.id);
            channel.followers = (channel.followers||0)+1;
            DB_addChannel(channel);
        }
        renderChannels();
    } catch(err) { toast('⚠️ ' + (err.message || 'فشل الانضمام')); }
}

async function unsubscribeFromChannel(channelId) {
    if (!isOnline) { toast('📡 يجب الاتصال بالإنترنت'); return; }
    if (!confirm('⚠️ هل تريد مغادرة القناة؟')) return;
    try {
        await window.leaveChannel(channelId);
        toast('✅ تمت المغادرة');
        const channel = DB_getChannels().find(c => c.id === channelId);
        if (channel) {
            channel.subscribers = (channel.subscribers||[]).filter(id => id !== DB_getCurrentUser()?.id);
            channel.followers = Math.max(0,(channel.followers||0)-1);
            DB_addChannel(channel);
        }
        renderChannels();
    } catch(err) { toast('⚠️ ' + (err.message || 'فشل المغادرة')); }
}

function shareChannelLink(channelId) {
    const channel = DB_getChannels().find(c => c.id === channelId);
    if (!channel) { toast('⚠️ القناة غير موجودة'); return; }
    const link = `${window.location.origin}/channel.html?code=${channel.invite_code || channel.id}`;
    if (navigator.share) {
        navigator.share({ title: `انضم إلى قناة ${channel.name}`, text: `انضم إلى قناة "${channel.name}" على RamzApp: ${link}`, url: link }).catch(()=>{});
    } else {
        navigator.clipboard.writeText(link).then(() => toast('📋 تم نسخ رابط القناة')).catch(() => prompt('📋 انسخ الرابط:', link));
    }
}

function openChannelManagement(channelId) {
    const channel = DB_getChannels().find(c => c.id === channelId);
    if (!channel) { toast('⚠️ القناة غير موجودة'); return; }
    const currentUser = DB_getCurrentUser();
    if (channel.created_by !== currentUser?.id) { toast('⚠️ فقط منشئ القناة يمكنه إدارتها'); return; }
    window.location.href = `edit-channel.html?id=${channelId}`;
}

async function saveChannelSettings(channelId, name, description) {
    const channel = DB_getChannels().find(c => c.id === channelId);
    if (!channel) { toast('⚠️ القناة غير موجودة'); return; }
    channel.name = name;
    channel.description = description;
    DB_addChannel(channel);
    if (isOnline && window.updateChannel) {
        window.updateChannel(channelId, { name, description }).catch(()=>{});
    }
    renderChannels();
    toast('✅ تم تحديث القناة');
}

function changeChannelAvatar(channelId) {
    const emojis = ['📢','📰','🎵','📺','🎬','💡','🌟','🔥','💎','🎯','🏆','⭐','🌈','🚀','💫','🎨','📸','🎥','📻','📱'];
    const currentEmoji = prompt(`اختر إيموجي جديد:\n${emojis.join(' ')}`);
    if (currentEmoji && currentEmoji.trim()) {
        const channel = DB_getChannels().find(c => c.id === channelId);
        if (channel) {
            channel.avatar = currentEmoji.trim();
            DB_addChannel(channel);
            if (isOnline && window.updateChannel) { window.updateChannel(channelId, { avatar: channel.avatar }).catch(()=>{}); }
            renderChannels();
            toast('✅ تم تحديث الصورة');
        }
    }
}

async function deleteChannel(channelId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف القناة نهائياً؟')) return;
    if (!isOnline) { toast('📡 يجب الاتصال بالإنترنت'); return; }
    try {
        await window.deleteChannel(channelId);
        toast('🗑️ تم حذف القناة');
        const channels = DB_getChannels();
        const index = channels.findIndex(c => c.id === channelId);
        if (index !== -1) channels.splice(index, 1);
        renderChannels();
    } catch(err) { toast('⚠️ ' + (err.message || 'فشل الحذف')); }
}

function searchChannels(filter) { renderChannels(filter); }
$('#searchChannelsInput')?.addEventListener('input', function(e) { searchChannels(e.target.value); });

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
    replyTarget = null; pendingImg = null; pendingVoice = null; editingMsgId = null;
    $('#replyBar').style.display = 'none';
    $('#msgInput').value = '';
    renderMessages();
    updateSendBtn();
    showScreen('chat');
    if (typeof subscribeToCurrentChat === 'function') subscribeToCurrentChat();
    const msgs = DB_getMessages(chatId);
    const unreadIds = msgs.filter(m => m.sender_id !== 'me' && m.status !== 'read').map(m => m.id);
    if (unreadIds.length > 0 && window.markMessagesAsRead) {
        window.markMessagesAsRead(chatId, unreadIds);
        unreadIds.forEach(id => DB_updateMessage(id, { status: 'read' }));
    }
    setTimeout(() => $('#msgInput')?.focus(), 300);
}
$('#backBtn')?.addEventListener('click', () => { currentChatId = null; if (window.unsubscribeFromChat) window.unsubscribeFromChat(currentChatId); showScreen('chats'); renderChats(); });
$('#chatAvatar')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) openUserModal(c); });
$('#chatHeaderInfo')?.addEventListener('click', () => {
    const c = DB_getChats().find(x => x.id === currentChatId);
    if (c) {
        if (c.is_group) openGroupManagement(c.id);
        else openUserModal(c);
    }
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
        if (md !== lastDate) { lastDate = md; area.innerHTML += `<div class="date-divider">${fmtDate(m.time)}</div>`; }
        const isMe = m.sender_id === 'me' || m.sid === 'me';
        const syncClass = m.sync_status === 'pending-send' ? 'sync-pending' : m.sync_status === 'failed' ? 'sync-failed' : '';
        let stIcon = '';
        if (isMe) {
            if (m.status === 'read' || m.sync_status === 'read') stIcon = '<i class="fas fa-check-double" style="color:#4fc3f7;"></i>';
            else if (m.status === 'delivered' || m.sync_status === 'delivered') stIcon = '<i class="fas fa-check-double"></i>';
            else if (m.status === 'sent' || m.sync_status === 'sent') stIcon = '<i class="fas fa-check"></i>';
            else if (m.sync_status === 'pending-send') stIcon = '<span style="font-size:10px;">⏳</span>';
            else if (m.sync_status === 'failed') stIcon = '<span style="font-size:10px;color:#ff4444;">⚠️</span>';
        }
        const liked = m.liked;
        const hasVoice = m.voice_blob;
        const hasImg = m.img && !hasVoice;
        area.innerHTML += `
        <div class="msg-row ${isMe ? 'own' : 'other'} ${syncClass}" id="msg-${m.id}">
            <div class="msg-bubble">
                ${m.reply_to ? `<div class="reply-preview" onclick="scrollToMsg('${m.reply_to}')"><i class="fas fa-reply"></i> رد</div>` : ''}
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
        } catch (e) { el.innerHTML = `<span style="color:#ff4444;">⚠️ تعذر فك التشفير</span>`; }
    });
    area.querySelectorAll('.msg-actions button').forEach(b => {
        b.addEventListener('click', e => {
            e.stopPropagation();
            const act = b.dataset.act, mid = b.dataset.id;
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
    btn.onclick = (e) => { e.stopPropagation(); if (audio.paused) { audio.play(); if (icon) icon.className = 'fas fa-pause'; } else { audio.pause(); if (icon) icon.className = 'fas fa-play'; } };
}
function openImageViewer(src) { $('#viewerImage').src = src; $('#imageViewer').classList.add('active'); }
$('#closeImageViewer')?.addEventListener('click', () => $('#imageViewer').classList.remove('active'));
$('#imageViewer')?.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });

function scrollToMsg(mid) {
    const el = document.getElementById('msg-' + mid);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'rgba(255,200,0,0.15)'; setTimeout(() => el.style.background = '', 1500); }
}

function toggleLike(mid) {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const m = msgs.find(x => x.id === mid);
    if (m) { m.liked = !m.liked; m.likes = (m.likes || 0) + (m.liked ? 1 : -1); if (m.likes < 0) m.likes = 0; DB_updateMessage(mid, { liked: m.liked, likes: m.likes }); renderMessages(); }
}
function deleteMsg(mid) { if (!currentChatId || !confirm('حذف الرسالة؟')) return; DB_deleteMessage(mid); updateLastMsg(); renderMessages(); toast('🗑 تم الحذف'); }
function setReply(mid) {
    const msgs = DB_getMessages(currentChatId);
    const m = msgs.find(x => x.id === mid);
    if (m) { replyTarget = m; $('#replyPreview').textContent = (m.text || (m.voice_blob ? '🎤 رسالة صوتية' : '📎')).substring(0, 50); $('#replyBar').style.display = 'flex'; $('#msgInput')?.focus(); }
}
$('#cancelReplyBtn')?.addEventListener('click', () => { replyTarget = null; $('#replyBar').style.display = 'none'; });
function editMessage(mid) {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const m = msgs.find(x => x.id === mid);
    if (m && (m.sender_id === 'me' || m.sid === 'me')) {
        const newText = prompt('تعديل الرسالة:', m.text || '');
        if (newText !== null && newText.trim() !== '') { DB_updateMessage(mid, { text: newText.trim() }); updateLastMsg(); renderMessages(); toast('✅ تم التعديل'); }
    }
}
function updateLastMsg() {
    if (!currentChatId) return;
    const msgs = DB_getMessages(currentChatId);
    const chats = DB_getChats();
    const c = chats.find(x => x.id === currentChatId);
    if (c && msgs.length) { const l = msgs[msgs.length - 1]; c.last_msg = l.text || (l.voice_blob ? '🎤' : (l.img ? '📷' : '📎')); c.last_time = l.time; DB_saveChat(c); }
}

// ==================== إرسال الرسائل المشفرة ====================
async function sendMessage() {
    if (!currentChatId) return;
    const inp = $('#msgInput');
    const text = inp?.value.trim();
    if (!text && !pendingImg && !pendingVoice) return;
    let msgText = text || (pendingVoice ? '🎤 رسالة صوتية' : '📷 صورة');
    let encryptedPayload = null;
    if (isOnline && currentUserKeyPair) {
        try { encryptedPayload = await encryptMessage(msgText, currentChatId); }
        catch (e) { console.warn('⚠️ فشل التشفير، إرسال بدون تشفير', e); }
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
            if (result.success) DB_updateMessage(msg.id, { sync_status: 'sent', status: 'sent' });
            else if (!result.offline) DB_updateMessage(msg.id, { sync_status: 'failed', status: 'failed' });
            renderMessages();
        });
    }
    if (inp) inp.value = '';
    pendingImg = null; pendingVoice = null; replyTarget = null;
    $('#replyBar').style.display = 'none';
    updateSendBtn();
    if (window.sendTypingEvent) window.sendTypingEvent(currentChatId, false);
    playNotificationSound();
}
$('#sendMsgBtn')?.addEventListener('click', sendMessage);
$('#msgInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
$('#msgInput')?.addEventListener('input', function() {
    updateSendBtn();
    if (currentChatId && window.sendTypingEvent) window.sendTypingEvent(currentChatId, this.value.trim().length > 0);
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
        setTimeout(() => { if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); isRecording = false; $('#micBtn')?.classList.remove('recording'); } }, 15000);
    } catch (err) { toast('⚠️ لا يمكن الوصول للميكروفون'); isRecording = false; $('#micBtn')?.classList.remove('recording'); }
}
function stopRecording() { if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); isRecording = false; $('#micBtn')?.classList.remove('recording'); } }

// ==================== إيموجي ====================
const emojis = ['😀','😂','😍','😢','😡','👍','❤️','🔥','🎉','😎','🤔','😴','🥳','😇','🤗','😤','😱','💔','✨','🌟','💡','📎','📷','🎵','📍','🙏','💪','👀','🤝','🚀','💯','✅','❌','🎯'];
const ep = $('#emojiPicker');
if (ep) {
    emojis.forEach(e => {
        const s = document.createElement('span');
        s.textContent = e;
        s.addEventListener('click', () => { const inp = $('#msgInput'); if (inp) inp.value += e; ep.classList.remove('show'); $('#msgInput')?.focus(); updateSendBtn(); });
        ep.appendChild(s);
    });
}
$('#emojiBtn')?.addEventListener('click', e => { e.stopPropagation(); ep?.classList.toggle('show'); });
document.addEventListener('click', e => { if (ep && !ep.contains(e.target) && e.target !== $('#emojiBtn')) ep.classList.remove('show'); });

// ==================== مرفقات ====================
const as = $('#attachSheet');
const ao = $('#attachOverlay');
$('#attachBtn')?.addEventListener('click', () => { as?.classList.add('open'); ao?.classList.add('active'); ep?.classList.remove('show'); });
$('#closeAttachBtn')?.addEventListener('click', () => { as?.classList.remove('open'); ao?.classList.remove('active'); });
ao?.addEventListener('click', () => { as?.classList.remove('open'); ao?.classList.remove('active'); });
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
            } else toast('📄 ' + f.name);
        });
    }
    hf.value = '';
});

// ==================== السحب والإفلات ====================
const messagesArea = $('#messagesArea');
messagesArea?.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); messagesArea.style.background = 'rgba(255,0,80,0.05)'; });
messagesArea?.addEventListener('dragleave', () => { messagesArea.style.background = ''; });
messagesArea?.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation(); messagesArea.style.background = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = ev => { pendingImg = ev.target.result; updateSendBtn(); toast('📷 تم إضافة الصورة، اضغط إرسال'); };
                reader.readAsDataURL(f);
            } else if (f.type.startsWith('audio/')) {
                const reader = new FileReader();
                reader.onload = ev => { pendingVoice = { blob: ev.target.result, duration: '0:00' }; updateSendBtn(); toast('🎵 تم إضافة الصوت'); };
                reader.readAsDataURL(f);
            } else toast('⚠️ نوع الملف غير مدعوم');
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
$('#userModal')?.addEventListener('click', e => { if (e.target === $('#userModal')) $('#userModal').classList.remove('active'); });
$('#modalChatBtn')?.addEventListener('click', () => { if (selectedModalUser) startOrOpenChat(selectedModalUser); $('#userModal').classList.remove('active'); });
$('#modalCallBtn')?.addEventListener('click', () => { if (selectedModalUser) startCall(selectedModalUser, 'voice'); $('#userModal').classList.remove('active'); });
$('#modalVideoBtn')?.addEventListener('click', () => { if (selectedModalUser) startCall(selectedModalUser, 'video'); $('#userModal').classList.remove('active'); });
$('#modalInfoBtn')?.addEventListener('click', () => { if (selectedModalUser) showProfile(selectedModalUser); $('#userModal').classList.remove('active'); });

function startOrOpenChat(user) {
    let chats = DB_getChats();
    let chat = chats.find(c => c.id === user.id);
    if (!chat) { chat = { id: user.id, name: user.name, avatar: user.avatar, last_msg: '', last_time: new Date().toISOString(), unread: 0, online: true, pinned: false, bio: user.bio || '' }; DB_saveChat(chat); }
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
    if (uid) { const chats = DB_getChats(); const u = chats.find(c => c.id === uid) || { id: uid, name: '', avatar: '?' }; startOrOpenChat(u); }
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
        callInterval = setInterval(() => { callSeconds++; const m = Math.floor(callSeconds / 60).toString().padStart(2, '0'); const s = (callSeconds % 60).toString().padStart(2, '0'); $('#callTimer').textContent = m + ':' + s; }, 1000);
    }, 2000);
}
$('#callEndBtn')?.addEventListener('click', endCall);
$('#callMuteBtn')?.addEventListener('click', function() { this.classList.toggle('active'); this.style.background = this.classList.contains('active') ? '#ff0000' : 'rgba(255,255,255,0.2)'; toast(this.classList.contains('active') ? '🔇 ميكروفون مكتوم' : '🎤 ميكروفون مفعل'); });
$('#callSpeakerBtn')?.addEventListener('click', function() { this.classList.toggle('active'); this.style.background = this.classList.contains('active') ? '#00a884' : 'rgba(255,255,255,0.2)'; toast(this.classList.contains('active') ? '🔊 مكبر الصوت مفعل' : '🔈 مكبر الصوت معطل'); });
function endCall() { if (callInterval) clearInterval(callInterval); callInterval = null; callSeconds = 0; $('#callScreen').classList.remove('active'); $('#callMuteBtn').style.background = 'rgba(255,255,255,0.2)'; $('#callSpeakerBtn').style.background = 'rgba(255,255,255,0.2)'; $('#callMuteBtn').classList.remove('active'); $('#callSpeakerBtn').classList.remove('active'); toast('📞 تم إنهاء المكالمة'); }
$('#voiceCallBtn')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) startCall(c, 'voice'); });
$('#videoCallBtn')?.addEventListener('click', () => { const c = DB_getChats().find(x => x.id === currentChatId); if (c) startCall(c, 'video'); });

function renderCalls() {
    const container = $('#callsList');
    if (!container) return;
    const calls = DB_getCalls();
    if (!calls.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-phone-slash"></i><p>لا توجد مكالمات</p></div>'; return; }
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

// ==================== مزامنة جهات الاتصال ====================
async function syncContacts() {
    if (!isOnline) {
        toast('📡 يجب الاتصال بالإنترنت لمزامنة جهات الاتصال');
        return;
    }
    if (!window.supabaseClient) {
        toast('⚠️ خدمة المزامنة غير متاحة حالياً');
        return;
    }

    toast('📱 جاري مزامنة جهات الاتصال...');

    try {
        let deviceContacts = [];
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                deviceContacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
            } catch (err) {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    toast('⚠️ لم يتم منح صلاحية الوصول لجهات الاتصال');
                } else {
                    throw err;
                }
            }
        } else {
            console.warn('⚠️ المتصفح لا يدعم مزامنة جهات الاتصال التلقائية');
        }

        const phoneNumbers = [];
        const contactsMap = {};
        if (deviceContacts.length > 0) {
            for (const contact of deviceContacts) {
                if (contact.tel && contact.tel.length > 0) {
                    const phone = contact.tel[0].replace(/[\s\-\(\)]/g, '');
                    if (phone) {
                        phoneNumbers.push(phone);
                        contactsMap[phone] = {
                            name: contact.name || phone,
                            phone: phone
                        };
                    }
                }
            }
        }

        const localContacts = DB_getContacts();
        for (const c of localContacts) {
            if (c.phone && !phoneNumbers.includes(c.phone)) {
                phoneNumbers.push(c.phone);
                contactsMap[c.phone] = {
                    name: c.name || c.phone,
                    phone: c.phone,
                    id: c.id
                };
            }
        }

        if (phoneNumbers.length === 0) {
            toast('⚠️ لا توجد جهات اتصال للمزامنة');
            return;
        }

        const registeredResult = await window.checkRegisteredPhones(phoneNumbers);
        const registeredPhones = registeredResult.registered || [];
        const unregisteredPhones = registeredResult.unregistered || [];

        let updatedCount = 0;
        for (const phone of phoneNumbers) {
            const contactInfo = contactsMap[phone] || { name: phone, phone: phone };
            const isRegistered = registeredPhones.some(r => r.phone === phone);
            const registeredUser = registeredPhones.find(r => r.phone === phone);
            
            let existingContact = DB_getContacts().find(c => c.phone === phone);
            if (existingContact) {
                const updated = {
                    ...existingContact,
                    name: contactInfo.name || existingContact.name,
                    registered: isRegistered ? 1 : 0,
                    id: registeredUser?.id || existingContact.id
                };
                DB_saveContact(updated);
                updatedCount++;
            } else {
                const newContact = {
                    id: registeredUser?.id || 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    phone: phone,
                    name: contactInfo.name || phone,
                    registered: isRegistered ? 1 : 0,
                    invite_code: null
                };
                DB_saveContact(newContact);
                updatedCount++;
            }
        }

        renderContactsList();
        toast(`✅ تمت مزامنة ${updatedCount} جهة اتصال`);
        
        const user = DB_getCurrentUser();
        if (user && user.id) {
            try {
                const contactsToSync = DB_getContacts();
                await window.supabaseClient
                    .from('contacts')
                    .delete()
                    .eq('user_id', user.id);

                if (contactsToSync.length > 0) {
                    const contactsInsert = contactsToSync.map(c => ({
                        id: c.id,
                        phone: c.phone,
                        name: c.name || '',
                        registered: c.registered || 0,
                        user_id: user.id
                    }));
                    await window.supabaseClient
                        .from('contacts')
                        .insert(contactsInsert);
                }
                console.log('✅ تم مزامنة جهات الاتصال مع Supabase');
            } catch (err) {
                console.warn('⚠️ فشل مزامنة جهات الاتصال مع Supabase:', err);
            }
        }

        const newRegistered = registeredPhones.filter(r => 
            !localContacts.some(c => c.phone === r.phone && c.registered === 1)
        );
        if (newRegistered.length > 0) {
            toast(`👥 ${newRegistered.length} جهة اتصال مسجلة جديدة في RamzApp`);
        }

    } catch (err) {
        console.error('❌ فشل مزامنة جهات الاتصال:', err);
        toast('⚠️ فشلت المزامنة، حاول مرة أخرى');
    }
}

// ==================== جهات الاتصال ====================
function renderContactsList() {
    const container = $('#contactsList');
    if (!container) return;
    const allContacts = DB_getContacts();
    const registered = allContacts.filter(c => c.registered);
    const unregistered = allContacts.filter(c => !c.registered);

    let html = `
        <div class="section-header"><h3>✅ المسجلين في RamzApp (${registered.length})</h3></div>
    `;
    if (registered.length === 0) {
        html += `<p style="color:var(--text3);padding:8px 16px;">لا يوجد جهات اتصال مسجلة</p>`;
    } else {
        registered.forEach(c => {
            html += `
                <div class="channel-item contact-item" data-id="${c.id}">
                    <div class="channel-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '📞'}</div>
                    <div class="item-info">
                        <div class="item-title">${esc(c.name || c.phone)}</div>
                        <div class="item-sub">${c.phone} • مسجل</div>
                    </div>
                    <i class="fas fa-comment-dots" style="color:var(--accent);cursor:pointer;" title="مراسلة"></i>
                </div>
            `;
        });
    }

    html += `
        <div class="section-header"><h3>⏳ غير المسجلين (${unregistered.length})</h3></div>
    `;
    if (unregistered.length === 0) {
        html += `<p style="color:var(--text3);padding:8px 16px;">لا يوجد جهات اتصال غير مسجلة</p>`;
    } else {
        unregistered.forEach(c => {
            html += `
                <div class="channel-item contact-item" data-phone="${c.phone}">
                    <div class="channel-avatar">${c.name ? c.name.charAt(0).toUpperCase() : '📞'}</div>
                    <div class="item-info">
                        <div class="item-title">${esc(c.name || c.phone)}</div>
                        <div class="item-sub">${c.phone} • غير مسجل</div>
                    </div>
                    <button class="promo-btn invite-btn" style="padding:4px 10px;font-size:11px;" data-phone="${c.phone}">دعوة</button>
                </div>
            `;
        });
    }

    container.innerHTML = html;

    container.querySelectorAll('.contact-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.invite-btn')) {
                const phone = el.dataset.phone;
                inviteContact(phone);
                return;
            }
            const id = el.dataset.id;
            if (id) {
                const contact = DB_getContacts().find(c => c.id === id);
                if (contact) {
                    startOrOpenChat({ id: contact.id, name: contact.name, avatar: contact.avatar || '?' });
                }
            }
        });
    });
}

async function inviteContact(phone) {
    let inviteCode = null;
    if (window.getInviteCode) inviteCode = await window.getInviteCode();
    let inviteLink = (inviteCode && window.createInviteLink) ? window.createInviteLink(inviteCode) : 'https://appramz.vercel.app/';
    const message = `انضم إلى RamzApp: ${inviteLink}`;
    if (navigator.share) {
        try { await navigator.share({ title: 'RamzApp - دعوة', text: message }); toast('✅ تم فتح المشاركة'); }
        catch (e) {}
    } else {
        try { await navigator.clipboard.writeText(message); toast('📋 تم نسخ نص الدعوة'); }
        catch (e) { toast('📋 رابط الدعوة: ' + inviteLink); }
    }
}
$('#syncContactsBtn')?.addEventListener('click', syncContacts);
$('#backFromContactsBtn')?.addEventListener('click', () => showScreen('chats'));
$('#contactsMenuBtn')?.addEventListener('click', () => showScreenMenu('contacts'));

// ==================== القصص (شريط أفقي - 24 ساعة) ====================
function cleanupExpiredStories() {
    const now = new Date().toISOString();
    const stories = DB_getStories();
    let removed = 0;
    stories.forEach(s => {
        if (s.expires_at && s.expires_at < now) {
            if (window.deleteStory) window.deleteStory(s.id);
            else DB_deleteStory(s.id);
            removed++;
        }
    });
    if (removed > 0) {
        console.log(`🧹 تم حذف ${removed} قصة منتهية`);
        renderStories();
    }
}
setInterval(cleanupExpiredStories, 300000);
setTimeout(cleanupExpiredStories, 2000);

function renderStories() {
    const bar = document.getElementById('storyBar');
    if (!bar) return;

    const now = new Date().toISOString();
    const allStories = DB_getStories().filter(s => s.expires_at > now);
    const stories = allStories.sort((a, b) => new Date(b.time) - new Date(a.time));

    // ===== شريط القصص العلوي (أفقي) =====
    if (stories.length === 0) {
        bar.style.display = 'none';
        const list = document.getElementById('storiesList');
        if (list) {
            list.innerHTML = '<p style="color:var(--text3);padding:8px 16px;">لا توجد قصص حالياً. أضف قصتك الأولى!</p>';
            list.style.display = 'block';
        }
        return;
    }

    bar.style.display = 'flex';
    bar.style.flexDirection = 'row';
    bar.style.alignItems = 'center';
    bar.style.gap = '12px';
    bar.style.overflowX = 'auto';
    bar.style.overflowY = 'hidden';
    bar.style.padding = '12px 16px';
    bar.style.scrollBehavior = 'smooth';
    bar.style.whiteSpace = 'nowrap';
    bar.style.background = 'var(--surface)';
    bar.style.borderBottom = '1px solid var(--border)';
    bar.style.scrollbarWidth = 'thin';

    let html = `
        <div class="story-item story-add" onclick="openStoryCamera()" style="flex-shrink:0; display:inline-flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer;">
            <div class="story-ring" style="width:60px; height:60px; border-radius:50%; background:var(--surface3); border:2px dashed var(--accent); display:flex; align-items:center; justify-content:center;">
                <span style="font-size:28px; color:var(--accent);">+</span>
            </div>
            <div class="story-name" style="font-size:10px; color:var(--text3); text-align:center; max-width:65px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">إضافة</div>
        </div>
    `;

    const recentStories = stories.slice(0, 10);
    recentStories.forEach((s, i) => {
        const isViewed = s.isViewed || false;
        html += `
            <div class="story-item" onclick="openStoryViewer(${i})" data-story="${i}" style="flex-shrink:0; display:inline-flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer;">
                <div class="story-ring ${isViewed ? 'viewed' : ''}" style="width:60px; height:60px; border-radius:50%; padding:3px; background:${isViewed ? 'var(--surface3)' : 'linear-gradient(135deg, #ff0050, #ff7b00)'}; display:flex; align-items:center; justify-content:center;">
                    <div class="story-avatar" style="width:52px; height:52px; border-radius:50%; background:${s.color || '#ff0050'}; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; color:#fff; border:2px solid var(--bg);">
                        ${s.avatar || '📷'}
                    </div>
                </div>
                <div class="story-name" style="font-size:10px; color:var(--text3); text-align:center; max-width:65px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(s.name || 'قصة')}</div>
                <div style="font-size:8px; color:var(--text3); text-align:center;">${timeAgo(s.time)}</div>
            </div>
        `;
    });

    bar.innerHTML = html;

    // ===== قائمة معاينات القصص (أفقية مع تمرير) =====
    const list = document.getElementById('storiesList');
    if (list) {
        list.style.display = 'flex';
        list.style.flexDirection = 'row';
        list.style.alignItems = 'stretch';
        list.style.gap = '12px';
        list.style.overflowX = 'auto';
        list.style.overflowY = 'hidden';
        list.style.padding = '8px 16px 12px 16px';
        list.style.scrollBehavior = 'smooth';
        list.style.whiteSpace = 'nowrap';
        list.style.background = 'transparent';
        list.style.flexWrap = 'nowrap';

        list.innerHTML = stories.map(s => `
            <div class="story-card" onclick="openStoryViewer(${stories.indexOf(s)})" style="
                flex-shrink: 0;
                width: 150px;
                min-width: 140px;
                max-width: 180px;
                background: var(--surface);
                border-radius: 16px;
                padding: 10px;
                border: 1px solid var(--border);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                transition: 0.2s;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <div class="story-preview" style="
                    width: 100%;
                    height: 100px;
                    border-radius: 12px;
                    background: var(--surface3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    position: relative;
                    overflow: hidden;
                ">
                    ${s.type === 'image' ? `<img src="${s.content}" alt="قصة" loading="lazy" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` :
                    s.type === 'video' ? `<video src="${s.content}" muted style="width:100%; height:100%; object-fit:cover; border-radius:12px;"></video>` :
                    `<span style="font-size:40px;">📝</span>`}
                    ${s.expires_at ? `<div style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:2px 8px; border-radius:12px; backdrop-filter:blur(4px);">${Math.ceil((new Date(s.expires_at) - new Date()) / 3600000)} ساعة</div>` : ''}
                </div>
                <div class="story-meta" style="
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: var(--text3);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                ">
                    <span style="font-weight:600; color:var(--text);">${esc(s.name)}</span>
                    <span>${timeAgo(s.time)}</span>
                </div>
            </div>
        `).join('');
    }
}

function openStoryCamera() { showStoryTypeSelector(); }

function showStoryTypeSelector() {
    const options = [
        { icon: '📷', label: 'كاميرا', action: () => captureStoryPhoto() },
        { icon: '🖼️', label: 'معرض', action: () => pickStoryImage() },
        { icon: '✏️', label: 'نص', action: () => createTextStory() },
        { icon: '🎥', label: 'فيديو', action: () => pickStoryVideo() },
    ];
    showPopup(options.map(opt => ({
        icon: 'fa-' + (opt.icon === '📷' ? 'camera' : opt.icon === '🖼️' ? 'image' : opt.icon === '✏️' ? 'pencil-alt' : 'video'),
        label: opt.label,
        action: opt.action
    })));
}

async function captureStoryPhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream; video.autoplay = true;
        video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;object-fit:cover;';
        document.body.appendChild(video);
        const captureBtn = document.createElement('button');
        captureBtn.textContent = '📸 التقاط';
        captureBtn.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:10000;padding:16px 32px;border-radius:50px;border:none;background:#ff0050;color:#fff;font-size:18px;font-weight:bold;cursor:pointer;';
        document.body.appendChild(captureBtn);
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;padding:12px 16px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;font-size:20px;cursor:pointer;';
        document.body.appendChild(closeBtn);
        return new Promise((resolve) => {
            captureBtn.onclick = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.8);
                saveStory({ type: 'image', content: imageData, caption: '' });
                document.body.removeChild(video); document.body.removeChild(captureBtn); document.body.removeChild(closeBtn);
                stream.getTracks().forEach(t => t.stop());
                resolve();
            };
            closeBtn.onclick = () => {
                document.body.removeChild(video); document.body.removeChild(captureBtn); document.body.removeChild(closeBtn);
                stream.getTracks().forEach(t => t.stop());
                resolve();
            };
        });
    } catch (e) { toast('⚠️ لا يمكن الوصول للكاميرا: ' + e.message); }
}

function pickStoryImage() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) { const reader = new FileReader(); reader.onload = (ev) => saveStory({ type: 'image', content: ev.target.result, caption: '' }); reader.readAsDataURL(file); }
    };
    input.click();
}
function pickStoryVideo() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) { const reader = new FileReader(); reader.onload = (ev) => saveStory({ type: 'video', content: ev.target.result, caption: '' }); reader.readAsDataURL(file); }
    };
    input.click();
}
function createTextStory() {
    const text = prompt('✏️ اكتب نص قصتك:');
    if (text && text.trim()) saveStory({ type: 'text', content: text.trim(), caption: '' });
}

async function saveStory(storyData) {
    const user = DB_getCurrentUser();
    if (!user) { toast('⚠️ يجب تسجيل الدخول لإضافة قصة'); return; }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const story = {
        id: storyData.id || ('s_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        user_id: user.id,
        name: user.name || 'مستخدم',
        avatar: user.avatar || '📷',
        type: storyData.type || 'image',
        content: storyData.content,
        caption: storyData.caption || '',
        time: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        isViewed: false,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    };
    if (window.addStory) window.addStory(story);
    else DB_addStory(story);
    if (isOnline && window.addStoryToSupabase) {
        try {
            const storyForSupabase = { ...story };
            if (!storyForSupabase.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                storyForSupabase.id = crypto.randomUUID ? crypto.randomUUID() : 's_' + Date.now();
            }
            await window.addStoryToSupabase(storyForSupabase);
        } catch (e) { console.warn('⚠️ فشل مزامنة القصة مع الخادم', e); }
    }
    toast('✅ تم نشر قصتك!');
    if (typeof renderStories === 'function') renderStories();
}

function openStoryViewer(index) {
    const now = new Date().toISOString();
    const stories = DB_getStories().filter(s => s.expires_at > now).sort((a, b) => new Date(b.time) - new Date(a.time));
    if (index >= stories.length) {
        toast('🎬 انتهت جميع القصص');
        renderStories();
        return;
    }
    const story = stories[index];
    const viewer = document.createElement('div');
    viewer.className = 'story-viewer-active';
    viewer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.3s ease;';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.cssText = 'position:absolute;top:20px;left:20px;right:20px;display:flex;gap:4px;z-index:10000;';
    stories.forEach((_, i) => {
        const seg = document.createElement('div');
        seg.className = 'progress-segment';
        seg.style.cssText = `flex:1;height:3px;background:${i <= index ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'};border-radius:2px;overflow:hidden;`;
        if (i === index) {
            seg.innerHTML = `<div style="height:100%;background:#fff;border-radius:2px;width:0%;transition:width 0.1s linear;" id="storyProgressFill"></div>`;
        }
        progressBar.appendChild(seg);
    });
    viewer.appendChild(progressBar);
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.style.cssText = 'position:absolute;top:60px;left:20px;z-index:10000;display:flex;align-items:center;gap:12px;color:#fff;';
    userInfo.innerHTML = `
        <div style="width:40px;height:40px;border-radius:50%;background:${story.color || '#ff0050'};display:flex;align-items:center;justify-content:center;font-size:20px;">${story.avatar || '📷'}</div>
        <div><div style="font-weight:bold;">${esc(story.name || 'مستخدم')}</div>
        <div style="font-size:11px;opacity:0.7;">${timeAgo(story.time)} • ${Math.ceil((new Date(story.expires_at) - new Date()) / 3600000)} ساعة متبقية</div></div>
    `;
    viewer.appendChild(userInfo);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:20px;right:20px;z-index:10000;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:24px;width:44px;height:44px;border-radius:50%;cursor:pointer;';
    closeBtn.onclick = closeStoryViewer;
    viewer.appendChild(closeBtn);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.style.cssText = 'max-width:400px;max-height:80vh;width:100%;display:flex;align-items:center;justify-content:center;position:relative;';
    if (story.type === 'image') {
        const img = document.createElement('img');
        img.src = story.content;
        img.style.cssText = 'max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain;';
        img.onerror = () => { img.src = 'https://via.placeholder.com/400x400?text=📷+صورة'; };
        contentDiv.appendChild(img);
    } else if (story.type === 'video') {
        const video = document.createElement('video');
        video.src = story.content;
        video.controls = true;
        video.autoplay = true;
        video.style.cssText = 'max-width:100%;max-height:70vh;border-radius:12px;';
        contentDiv.appendChild(video);
    } else if (story.type === 'text') {
        const textDiv = document.createElement('div');
        textDiv.className = 'text-story';
        textDiv.style.cssText = 'background:rgba(255,255,255,0.1);padding:30px;border-radius:16px;color:#fff;font-size:24px;text-align:center;max-width:90%;word-wrap:break-word;';
        textDiv.textContent = story.content;
        contentDiv.appendChild(textDiv);
    }
    viewer.appendChild(contentDiv);
    if (story.caption) {
        const captionDiv = document.createElement('div');
        captionDiv.className = 'caption';
        captionDiv.style.cssText = 'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.8);font-size:14px;text-align:center;background:rgba(0,0,0,0.5);padding:8px 16px;border-radius:20px;max-width:80%;';
        captionDiv.textContent = story.caption;
        viewer.appendChild(captionDiv);
    }
    document.body.appendChild(viewer);
    let progress = 0;
    const fill = document.getElementById('storyProgressFill');
    if (fill) {
        clearInterval(storyInterval);
        storyInterval = setInterval(() => {
            progress += 1;
            if (fill) fill.style.width = progress + '%';
            if (progress >= 100) {
                clearInterval(storyInterval);
                const storyToUpdate = DB_getStories().find(s => s.id === story.id);
                if (storyToUpdate) {
                    storyToUpdate.isViewed = true;
                    if (window.updateStory) window.updateStory(story.id, { isViewed: true });
                }
                setTimeout(() => {
                    viewer.remove();
                    if (index + 1 < stories.length) {
                        openStoryViewer(index + 1);
                    } else {
                        closeStoryViewer();
                        toast('🎬 انتهت جميع القصص');
                    }
                }, 300);
            }
        }, 50);
    }
}

function closeStoryViewer() {
    clearInterval(storyInterval);
    const viewer = document.querySelector('.story-viewer-active');
    if (viewer) viewer.remove();
    storyInterval = null;
    renderStories();
}

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
    const name = prompt('اسم المنتج:'); if (!name || !name.trim()) return;
    const price = prompt('السعر:'); const icon = prompt('أيقونة (إيموجي):', '📦');
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
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const success = window.importAllData ? await window.importAllData(ev.target.result) : false;
                    if (success) { toast('✅ تم استيراد البيانات بنجاح'); location.reload(); }
                    else { toast('❌ ملف غير صالح'); }
                } catch (err) { toast('❌ فشل في قراءة الملف'); }
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
        if (window.signOut) window.signOut();
        else localStorage.removeItem('ramzapp_user');
        if (!window.location.pathname.includes('login.html')) window.location.href = 'login.html';
    }
}

// ==================== البحث داخل المحادثة ====================
$('#chatMenuBtn')?.addEventListener('click', () => showScreenMenu('chat_main'));
function openInChatSearch() {
    const inSearch = $('#inChatSearch');
    inSearch?.classList.add('active');
    const inp = $('#inChatSearchInput');
    if (inp) { inp.value = ''; inp.focus(); }
    const res = $('#searchResults');
    if (res) res.style.display = 'none';
}
$('#closeInChatSearch')?.addEventListener('click', () => { $('#inChatSearch')?.classList.remove('active'); const res = $('#searchResults'); if (res) res.style.display = 'none'; });
$('#inChatSearchInput')?.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const resDiv = $('#searchResults');
    if (!q || !currentChatId) { if (resDiv) resDiv.style.display = 'none'; return; }
    const msgs = DB_getMessages(currentChatId);
    const results = msgs.filter(m => m.text && m.text.toLowerCase().includes(q));
    if (!results.length) { if (resDiv) resDiv.innerHTML = '<div style="padding:8px;color:var(--text3);">لا توجد نتائج</div>'; }
    else {
        if (resDiv) {
            resDiv.innerHTML = results.map(m => `
                <div class="search-result-item" data-msgid="${m.id}">
                    <span>${esc(m.text.substring(0, 60))}${m.text.length>60?'...':''}</span>
                    <span style="float:left;font-size:10px;color:var(--text3)">${fmtTime(m.time)}</span>
                </div>
            `).join('');
            resDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => { scrollToMsg(item.dataset.msgid); if (resDiv) resDiv.style.display = 'none'; $('#inChatSearch')?.classList.remove('active'); });
            });
        }
    }
    if (resDiv) resDiv.style.display = 'block';
});

// ==================== اختصارات لوحة المفاتيح ====================
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); $('#searchChatsInput')?.focus(); showScreen('chats'); }
    if (e.key === 'Escape') {
        $('#imageViewer')?.classList.remove('active');
        $('#userModal')?.classList.remove('active');
        $('#popupOverlay')?.classList.remove('active');
        closeStoryViewer();
        endCall();
        if (window._catalogScreen) { window._catalogScreen.remove(); window._catalogScreen = null; showScreen('tools'); }
    }
});

// ==================== دوال عامة ====================
window.scrollToMsg = scrollToMsg;
window.openImageViewer = openImageViewer;
window.viewStory = openStoryViewer;
window.openStoryCamera = openStoryCamera;
window.showScreen = showScreen;
window.addCatalogItem = addCatalogItem;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.logout = logout;

// ==================== التهيئة الرئيسية ====================
async function init() {
    if (initRun) { console.warn('⚠️ تم استدعاء init() أكثر من مرة'); return; }
    initRun = true;
    console.log('🚀 بدء تهيئة RamzApp v4.0...');
    try {
        const user = DB_getCurrentUser();
        if (!user || !user.id) {
            console.warn('⚠️ لا يوجد مستخدم صالح، التوجيه إلى login.html');
            window.location.href = 'login.html';
            return;
        }
        console.log('👤 المستخدم الحالي:', user.name || user.email || user.id);

        console.log('📌 [1] تهيئة قاعدة البيانات...');
        if (window.initDB) {
            await window.initDB();
            console.log('✅ قاعدة البيانات جاهزة');
        }

        if (window.inMemoryDB) {
            window.inMemoryDB.user = user;
            console.log('✅ تم تعيين المستخدم في inMemoryDB');
        }

        // محادثة فريق RamzApp
        const TEAM_USER_ID = 'ramzapp_team';
        const TEAM_CHAT_ID = 'ramzapp_team';
        const existingChat = DB_getChats().find(c => c.id === TEAM_CHAT_ID);
        if (!existingChat) {
            let teamUser = DB_getContacts().find(c => c.id === TEAM_USER_ID);
            if (!teamUser) {
                if (isOnline && window.supabaseClient) {
                    try {
                        const { data } = await window.supabaseClient
                            .from('users')
                            .select('*')
                            .eq('id', TEAM_USER_ID)
                            .single();
                        if (data) {
                            teamUser = {
                                id: data.id,
                                name: data.name || 'فريق RamzApp',
                                avatar: data.avatar || '👥',
                                phone: data.phone || '',
                                registered: true
                            };
                            DB_saveContact(teamUser);
                        }
                    } catch (e) { console.warn('⚠️ تعذر جلب بيانات فريق RamzApp', e); }
                }
                if (!teamUser) {
                    teamUser = {
                        id: TEAM_USER_ID,
                        name: 'فريق RamzApp',
                        avatar: '👥',
                        phone: '+967778562099',
                        registered: true
                    };
                    DB_saveContact(teamUser);
                }
            }
            const chat = {
                id: TEAM_CHAT_ID,
                name: 'فريق RamzApp',
                avatar: '👥',
                last_msg: 'مرحبا بكم في تطبيق RamzApp تواصل مع الجميع بكل ثقة وأمان وسرعة نتمنى لكم أوقاتا ممتعة.',
                last_time: new Date().toISOString(),
                unread: 1,
                online: false,
                pinned: false,
                bio: 'البريد: ramzealsalhy@gmail.com | رقم: +967778562099',
                is_group: false
            };
            DB_saveChat(chat);
            const welcomeMsg = {
                id: 'welcome_' + Date.now(),
                chat_id: TEAM_CHAT_ID,
                sender_id: TEAM_USER_ID,
                text: 'مرحبا بكم في تطبيق RamzApp تواصل مع الجميع بكل ثقة وأمان وسرعة نتمنى لكم أوقاتا ممتعة.\n\nمع تحيات فريق RamzApp',
                time: new Date().toISOString(),
                likes: 0,
                liked: false,
                reply_to: null,
                img: null,
                voice_blob: null,
                voice_duration: null,
                status: 'sent',
                sync_status: 'sent',
                encrypted: false,
                encryptedPayload: null
            };
            DB_addMessage(welcomeMsg);
            console.log('✅ تم إنشاء محادثة فريق RamzApp');
        }

        if (isOnline && window.supabaseClient) {
            console.log('📌 [2] جلب البيانات من Supabase...');
            try {
                if (window.fetchUserChats) {
                    const chats = await window.fetchUserChats(user.id);
                    if (chats?.length > 0) {
                        chats.forEach(chat => {
                            if (!DB_getChats().find(c => c.id === chat.id)) DB_saveChat(chat);
                        });
                        console.log(`✅ تم جلب ${chats.length} محادثة`);
                    }
                }
                if (window.fetchContacts) {
                    const contacts = await window.fetchContacts(user.id);
                    if (contacts?.length > 0) {
                        contacts.forEach(contact => {
                            if (!DB_getContacts().find(c => c.id === contact.id)) DB_saveContact(contact);
                        });
                        console.log(`✅ تم جلب ${contacts.length} جهة اتصال`);
                    }
                }
                if (window.fetchAllRegisteredUsers) {
                    const allUsers = await window.fetchAllRegisteredUsers();
                    if (allUsers?.length > 0) {
                        const localContacts = DB_getContacts();
                        for (const contact of localContacts) {
                            const found = allUsers.find(u => u.phone === contact.phone || u.id === contact.id);
                            if (found && !contact.registered) {
                                DB_saveContact({ ...contact, registered: 1, id: found.id || contact.id });
                            }
                        }
                        console.log(`✅ تم جلب ${allUsers.length} مستخدم مسجل`);
                    }
                }
                if (window.fetchUserContacts) {
                    try {
                        const serverContacts = await window.fetchUserContacts(user.id);
                        if (serverContacts && serverContacts.length > 0) {
                            for (const sc of serverContacts) {
                                const existing = DB_getContacts().find(c => c.id === sc.id);
                                if (!existing) {
                                    DB_saveContact(sc);
                                } else {
                                    DB_saveContact({ ...existing, ...sc });
                                }
                            }
                            console.log(`✅ تم جلب ${serverContacts.length} جهة اتصال من الخادم`);
                        }
                    } catch (e) { console.warn('⚠️ فشل جلب جهات الاتصال من الخادم', e); }
                }
                if (window.syncStories) {
                    try { await window.syncStories(); } catch(e) { console.warn('⚠️ فشل مزامنة القصص', e); }
                }
            } catch (e) {
                console.warn('⚠️ فشل جلب البيانات من Supabase (العمل محلياً)', e);
            }
        } else {
            console.log('📌 [2] غير متصل أو Supabase غير متاح، العمل بالبيانات المحلية');
        }

        console.log('📌 [3] دخول التطبيق...');
        try {
            enterApp();
        } catch (e) {
            console.error('❌ خطأ في enterApp:', e);
            toast('⚠️ حدث خطأ أثناء تحميل التطبيق: ' + (e.message || 'غير معروف'));
            throw e;
        }

        console.log('📌 [4] تهيئة التشفير...');
        try {
            await initEncryption();
        } catch (e) { console.warn('⚠️ فشل تهيئة التشفير:', e); }

        if (typeof window.ensureFontAwesome === 'function') {
            window.ensureFontAwesome();
        }

        if (isOnline && window.setUserOnlineStatus) {
            try { await window.setUserOnlineStatus(true); }
            catch (e) {}
        }

        if (isOnline && window.syncAllPendingMessages) {
            console.log('📌 [5] بدء المزامنة التلقائية...');
            setTimeout(() => window.syncAllPendingMessages(), 1500);
        }

        if (isOnline && typeof syncContacts === 'function') {
            setTimeout(() => {
                syncContacts().catch(() => {});
            }, 3000);
        }

        if (typeof renderStories === 'function') renderStories();

        console.log('✅ تم تهيئة RamzApp بنجاح');
        console.log('💬 الإصدار 4.0 | Offline-First + E2E Encryption + القوائم المتقدمة');

    } catch (err) {
        console.error('❌ خطأ في تهيئة التطبيق:', err);
        toast('⚠️ حدث خطأ أثناء تهيئة التطبيق');
        const container = document.getElementById('appContainer');
        if (container) {
            container.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;">
                    <div style="font-size:60px;margin-bottom:20px;">⚠️</div>
                    <h2 style="color:var(--text);margin-bottom:10px;">حدث خطأ في التطبيق</h2>
                    <p style="color:var(--text3);margin-bottom:20px;">${err.message || 'يرجى المحاولة مرة أخرى'}</p>
                    <button onclick="location.reload()" style="background:var(--accent);color:white;border:none;padding:12px 40px;border-radius:30px;font-size:16px;font-weight:bold;cursor:pointer;">🔄 إعادة المحاولة</button>
                </div>
            `;
        }
    }
}

// مستمع أحداث الشبكة
window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionIndicator();
    toast('🟢 تم الاتصال بالإنترنت - جاري المزامنة...');
    if (window.syncAllPendingMessages) window.syncAllPendingMessages();
    if (window.syncStories) window.syncStories();
    if (typeof syncContacts === 'function') {
        setTimeout(() => syncContacts().catch(() => {}), 1000);
    }
    if (currentChatId) subscribeToCurrentChat();
    if (window.setUserOnlineStatus) {
        window.setUserOnlineStatus(true).catch(() => {});
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 100);
}

console.log('✅ common.js (الإصدار النهائي الكامل) جاهز');
console.log('💬 RamzApp v4.0 - جميع الميزات مفعلة مع إصلاحات شاملة');
