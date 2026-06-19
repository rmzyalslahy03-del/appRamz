// db.js - طبقة التخزين الهجين لـ RamzApp (نسخة نهائية خالية من البيانات الوهمية)
// تعتمد كلياً على بيانات المستخدم الفعلية المخزنة محلياً + مزامنة Supabase
(function() {
    const DB_CONFIG = {
        localStorageKey: 'ramzapp_v3_db_cache',
        userKey: 'ramzapp_user',
        sqliteFileName: 'ramzapp.db',
        sqlWasmUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.wasm',
        sqlJsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.js',
        maxRetries: 3
    };

    let SQL = null;
    let db = null;
    let dbReady = false;
    let inMemoryDB = {
        user: null,
        chats: [],
        messages: {},
        contacts: [],
        stories: [],
        channels: [],
        calls: [],
        catalog: [],
        settings: { theme: 'dark', notifications: true }
    };
    let useFallback = false;

    function generateId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8); }
    function currentTimestamp() { return new Date().toISOString(); }

    function saveToLocalStorageCache() {
        try {
            const cache = {
                chats: inMemoryDB.chats.slice(0, 50).map(c => ({ ...c, _messages: undefined })),
                contacts: inMemoryDB.contacts,
                stories: inMemoryDB.stories,
                channels: inMemoryDB.channels,
                catalog: inMemoryDB.catalog,
                settings: inMemoryDB.settings,
                lastUpdate: currentTimestamp()
            };
            localStorage.setItem(DB_CONFIG.localStorageKey, JSON.stringify(cache));
        } catch (e) {}
    }

    function loadFromLocalStorageCache() {
        try {
            const raw = localStorage.getItem(DB_CONFIG.localStorageKey);
            if (raw) {
                const data = JSON.parse(raw);
                if (data.chats) inMemoryDB.chats = data.chats;
                if (data.contacts) inMemoryDB.contacts = data.contacts;
                if (data.stories) inMemoryDB.stories = data.stories;
                if (data.channels) inMemoryDB.channels = data.channels;
                if (data.catalog) inMemoryDB.catalog = data.catalog;
                if (data.settings) inMemoryDB.settings = data.settings;
                return true;
            }
        } catch (e) {}
        return false;
    }

    async function loadSqlJs() {
        if (SQL) return SQL;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = DB_CONFIG.sqlJsUrl;
            script.onload = () => {
                if (window.initSqlJs) {
                    window.initSqlJs({ locateFile: file => DB_CONFIG.sqlWasmUrl }).then(sql => {
                        SQL = sql;
                        resolve(SQL);
                    }).catch(reject);
                } else reject(new Error('SQL.js failed'));
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function openDatabase() {
        if (!SQL) await loadSqlJs();
        try {
            const opfsRoot = await navigator.storage.getDirectory();
            const fileHandle = await opfsRoot.getFileHandle(DB_CONFIG.sqliteFileName, { create: true });
            const file = await fileHandle.getFile();
            const arrayBuffer = await file.arrayBuffer();
            db = arrayBuffer.byteLength > 0 ? new SQL.Database(new Uint8Array(arrayBuffer)) : new SQL.Database();
            dbReady = true;
            return true;
        } catch (e) {
            try {
                db = new SQL.Database();
                const saved = await loadFromIndexedDB();
                if (saved) db = new SQL.Database(new Uint8Array(saved));
                dbReady = true;
                return true;
            } catch (e2) {
                useFallback = true;
                dbReady = true;
                return false;
            }
        }
    }

    function saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppDB', 1);
            req.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains('sqlite')) e.target.result.createObjectStore('sqlite'); };
            req.onsuccess = (e) => {
                const tx = e.target.result.transaction('sqlite', 'readwrite');
                tx.objectStore('sqlite').put(data, 'db');
                tx.oncomplete = resolve; tx.onerror = reject;
            };
            req.onerror = reject;
        });
    }

    function loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppDB', 1);
            req.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains('sqlite')) e.target.result.createObjectStore('sqlite'); };
            req.onsuccess = (e) => {
                const tx = e.target.result.transaction('sqlite', 'readonly');
                const getReq = tx.objectStore('sqlite').get('db');
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = reject;
            };
            req.onerror = reject;
        });
    }

    async function persistDatabase() {
        if (useFallback || !db) return;
        try {
            const data = db.export();
            try {
                const opfsRoot = await navigator.storage.getDirectory();
                const fileHandle = await opfsRoot.getFileHandle(DB_CONFIG.sqliteFileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(data.buffer);
                await writable.close();
            } catch (e) { await saveToIndexedDB(data.buffer); }
        } catch (e) {}
    }

    function createTables() {
        if (useFallback || !db) return;
        db.run(`CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT, name TEXT, avatar TEXT, phone TEXT, is_guest INTEGER DEFAULT 0, last_sync TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT, last_msg TEXT, last_time TEXT, unread INTEGER DEFAULT 0, pinned INTEGER DEFAULT 0, online INTEGER DEFAULT 0, last_seen TEXT, bio TEXT, typing INTEGER DEFAULT 0, typing_time TEXT, is_group INTEGER DEFAULT 0)`);
        db.run(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, text TEXT, img TEXT, voice_blob TEXT, voice_duration TEXT, reply_to TEXT, likes INTEGER DEFAULT 0, liked INTEGER DEFAULT 0, time TEXT NOT NULL, status TEXT DEFAULT 'pending-send', sync_status TEXT DEFAULT 'pending-send', edit_time TEXT)`);
        db.run('CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)');
        db.run(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, phone TEXT NOT NULL, name TEXT, registered INTEGER DEFAULT 0, invite_code TEXT, last_sync TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, name TEXT, avatar TEXT, time TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT, avatar TEXT, followers INTEGER DEFAULT 0, update_time TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, name TEXT, avatar TEXT, time TEXT, type TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS catalog (id TEXT PRIMARY KEY, name TEXT, price TEXT, icon TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
        persistDatabase();
    }

    function loadInMemoryFromSQLite() {
        if (useFallback || !db) return false;
        try {
            const userRows = db.exec("SELECT * FROM user LIMIT 1");
            if (userRows.length && userRows[0].values.length) {
                const u = {}; userRows[0].columns.forEach((c,i) => u[c] = userRows[0].values[0][i]);
                inMemoryDB.user = u;
            }
            const chatRows = db.exec("SELECT * FROM chats ORDER BY pinned DESC, last_time DESC");
            if (chatRows.length) inMemoryDB.chats = chatRows[0].values.map(r => { const c = {}; chatRows[0].columns.forEach((col,i)=>c[col]=r[i]); return c; });
            inMemoryDB.messages = {};
            const msgRows = db.exec("SELECT * FROM messages ORDER BY time ASC");
            if (msgRows.length) {
                const all = msgRows[0].values.map(r => { const m={}; msgRows[0].columns.forEach((col,i)=>m[col]=r[i]); return m; });
                all.forEach(m => { if (!inMemoryDB.messages[m.chat_id]) inMemoryDB.messages[m.chat_id] = []; inMemoryDB.messages[m.chat_id].push(m); });
            }
            const contactRows = db.exec("SELECT * FROM contacts");
            if (contactRows.length) inMemoryDB.contacts = contactRows[0].values.map(r => { const c={}; contactRows[0].columns.forEach((col,i)=>c[col]=r[i]); return c; });
            const storyRows = db.exec("SELECT * FROM stories");
            if (storyRows.length) inMemoryDB.stories = storyRows[0].values.map(r => { const s={}; storyRows[0].columns.forEach((col,i)=>s[col]=r[i]); return s; });
            const channelRows = db.exec("SELECT * FROM channels");
            if (channelRows.length) inMemoryDB.channels = channelRows[0].values.map(r => { const ch={}; channelRows[0].columns.forEach((col,i)=>ch[col]=r[i]); return ch; });
            const callRows = db.exec("SELECT * FROM calls ORDER BY time DESC");
            if (callRows.length) inMemoryDB.calls = callRows[0].values.map(r => { const c={}; callRows[0].columns.forEach((col,i)=>c[col]=r[i]); return c; });
            const catalogRows = db.exec("SELECT * FROM catalog");
            if (catalogRows.length) inMemoryDB.catalog = catalogRows[0].values.map(r => { const c={}; catalogRows[0].columns.forEach((col,i)=>c[col]=r[i]); return c; });
            const settingsRows = db.exec("SELECT * FROM settings");
            if (settingsRows.length) settingsRows[0].values.forEach(r => { if (r[0]==='theme') inMemoryDB.settings.theme=r[1]; if (r[0]==='notifications') inMemoryDB.settings.notifications=r[1]==='true'; });
            return true;
        } catch(e) { return false; }
    }

    // ================== تم حذف دالة seedInitialData() بالكامل ==================
    // لم يعد التطبيق يقوم بإنشاء بيانات وهمية (محادثات، رسائل، جهات اتصال) تلقائياً.
    // سيتم عرض واجهة فارغة لحين جلب البيانات من Supabase أو إضافتها من قبل المستخدم.

    async function persistAllData() {
        if (useFallback || !db) { saveToLocalStorageCache(); return; }
        try {
            db.run("DELETE FROM user"); if (inMemoryDB.user) db.run("INSERT INTO user VALUES (?,?,?,?,?,?,?)", [inMemoryDB.user.id, inMemoryDB.user.email||'', inMemoryDB.user.name, inMemoryDB.user.avatar, inMemoryDB.user.phone||'', inMemoryDB.user.is_guest?1:0, currentTimestamp()]);
            db.run("DELETE FROM messages");
            const insMsg = db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            for (const msgs of Object.values(inMemoryDB.messages)) for (const m of msgs) insMsg.run([m.id, m.chat_id, m.sender_id, m.text||'', m.img, m.voice_blob, m.voice_duration, m.reply_to, m.likes||0, m.liked?1:0, m.time, m.status, m.sync_status, m.edit_time]);
            insMsg.free();
            db.run("DELETE FROM chats"); const insChat = db.prepare("INSERT INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
            for (const c of inMemoryDB.chats) insChat.run([c.id, c.name, c.avatar, c.last_msg||'', c.last_time, c.unread||0, c.pinned?1:0, c.online?1:0, c.last_seen||'', c.bio||'', c.typing?1:0, c.typing_time, c.is_group?1:0]);
            insChat.free();
            db.run("DELETE FROM contacts"); const insCont = db.prepare("INSERT INTO contacts VALUES (?,?,?,?,?,?)");
            for (const c of inMemoryDB.contacts) insCont.run([c.id, c.phone, c.name||'', c.registered?1:0, c.invite_code, currentTimestamp()]);
            insCont.free();
            db.run("DELETE FROM stories"); const insStory = db.prepare("INSERT INTO stories VALUES (?,?,?,?)");
            for (const s of inMemoryDB.stories) insStory.run([s.id, s.name, s.avatar, s.time]);
            insStory.free();
            db.run("DELETE FROM channels"); const insCh = db.prepare("INSERT INTO channels VALUES (?,?,?,?,?)");
            for (const ch of inMemoryDB.channels) insCh.run([ch.id, ch.name, ch.avatar, ch.followers, ch.update_time]);
            insCh.free();
            db.run("DELETE FROM calls"); const insCall = db.prepare("INSERT INTO calls VALUES (?,?,?,?,?)");
            for (const c of inMemoryDB.calls) insCall.run([c.id, c.name, c.avatar, c.time, c.type]);
            insCall.free();
            db.run("DELETE FROM catalog"); const insCat = db.prepare("INSERT INTO catalog VALUES (?,?,?,?)");
            for (const c of inMemoryDB.catalog) insCat.run([c.id, c.name, c.price, c.icon]);
            insCat.free();
            db.run("DELETE FROM settings"); db.run("INSERT INTO settings VALUES ('theme',?)", [inMemoryDB.settings.theme]); db.run("INSERT INTO settings VALUES ('notifications',?)", [inMemoryDB.settings.notifications?'true':'false']);
            await persistDatabase();
            saveToLocalStorageCache();
        } catch(e) { saveToLocalStorageCache(); }
    }

    function addMessageToMemory(msg) {
        if (!inMemoryDB.messages[msg.chat_id]) inMemoryDB.messages[msg.chat_id] = [];
        inMemoryDB.messages[msg.chat_id].push(msg);
        const chat = inMemoryDB.chats.find(c => c.id === msg.chat_id);
        if (chat) {
            chat.last_msg = msg.text || (msg.img?'📷':msg.voice_blob?'🎤':'📎');
            chat.last_time = msg.time;
            if (msg.sender_id !== 'me' && !chat.online) chat.unread = (chat.unread||0)+1;
        }
    }

    // ================== دالة التهيئة الرئيسية (بدون بيانات وهمية) ==================
    async function initDB() {
        try {
            await loadSqlJs();
            await openDatabase();
            if (!useFallback) { 
                createTables(); 
                loadInMemoryFromSQLite(); 
            } else { 
                loadFromLocalStorageCache(); 
            }
            // تم إزالة الشرط if (!inMemoryDB.chats.length) seedInitialData();
            // التطبيق الآن يعرض البيانات المخزنة فعلياً فقط.
            const savedUser = localStorage.getItem(DB_CONFIG.userKey);
            if (savedUser) inMemoryDB.user = JSON.parse(savedUser);
            return true;
        } catch(e) { 
            useFallback = true; 
            loadFromLocalStorageCache(); 
            return false; 
        }
    }

    // ===== تعريف جميع الدوال على window =====
    window.initDB = initDB;
    window.getCurrentUser = getCurrentUser;
    window.setCurrentUser = setCurrentUser;
    window.getChats = getChats;
    window.getChat = getChat;
    window.saveChat = saveChat;
    window.deleteChat = deleteChat;
    window.getMessages = getMessages;
    window.addMessage = addMessage;
    window.updateMessage = updateMessage;
    window.deleteMessage = deleteMessage;
    window.getContacts = getContacts;
    window.getRegisteredContacts = getRegisteredContacts;
    window.getUnregisteredContacts = getUnregisteredContacts;
    window.saveContact = saveContact;
    window.syncContactsFromDevice = syncContactsFromDevice;
    window.getStories = getStories;
    window.addStory = addStory;
    window.getChannels = getChannels;
    window.addChannel = addChannel;
    window.getCalls = getCalls;
    window.addCall = addCall;
    window.getCatalog = getCatalog;
    window.addCatalogItem = addCatalogItem;
    window.getSettings = getSettings;
    window.updateSetting = updateSetting;
    window.exportAllData = exportAllData;
    window.importAllData = importAllData;
    window.clearAllData = clearAllData;
    window.getPendingMessages = getPendingMessages;
    window.persistAllData = persistAllData;
    window.inMemoryDB = inMemoryDB;
    window.generateId = generateId;
    window.currentTimestamp = currentTimestamp;

    // ===== دوال الـ getter المفقودة (تم إضافتها لضمان اكتمال الواجهة) =====
    function getCurrentUser() { return inMemoryDB.user; }
    function setCurrentUser(userData) { inMemoryDB.user = userData; localStorage.setItem(DB_CONFIG.userKey, JSON.stringify(userData)); if (!useFallback && db) { db.run("DELETE FROM user"); db.run("INSERT INTO user VALUES (?,?,?,?,?,?,?)", [userData.id, userData.email||'', userData.name, userData.avatar, userData.phone||'', userData.is_guest?1:0, currentTimestamp()]); persistDatabase(); } }
    function getChats() { return [...inMemoryDB.chats]; }
    function getChat(chatId) { return inMemoryDB.chats.find(c => c.id === chatId); }
    function saveChat(chatData) { const idx = inMemoryDB.chats.findIndex(c => c.id === chatData.id); if (idx>=0) inMemoryDB.chats[idx] = {...inMemoryDB.chats[idx], ...chatData}; else inMemoryDB.chats.unshift(chatData); if (!useFallback && db) { const c=chatData; db.run("INSERT OR REPLACE INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [c.id, c.name, c.avatar, c.last_msg||'', c.last_time, c.unread||0, c.pinned?1:0, c.online?1:0, c.last_seen||'', c.bio||'', c.typing?1:0, c.typing_time, c.is_group?1:0]); persistDatabase(); } saveToLocalStorageCache(); }
    function deleteChat(chatId) { inMemoryDB.chats = inMemoryDB.chats.filter(c => c.id !== chatId); delete inMemoryDB.messages[chatId]; if (!useFallback && db) { db.run("DELETE FROM chats WHERE id=?", [chatId]); db.run("DELETE FROM messages WHERE chat_id=?", [chatId]); persistDatabase(); } saveToLocalStorageCache(); }
    function getMessages(chatId) { return inMemoryDB.messages[chatId] || []; }
    function addMessage(msg) { msg.id = msg.id || generateId(); msg.chat_id = msg.chat_id || msg.sid; msg.sender_id = msg.sid || msg.sender_id; msg.sync_status = msg.sync_status || (msg.sender_id==='me'?'pending-send':'delivered'); msg.status = msg.status || msg.sync_status; msg.time = msg.time || currentTimestamp(); msg.likes = msg.likes||0; msg.liked = msg.liked||false; addMessageToMemory(msg); if (!useFallback && db) { db.run("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [msg.id, msg.chat_id, msg.sender_id, msg.text||'', msg.img, msg.voice_blob, msg.voice_duration, msg.reply_to, msg.likes, msg.liked?1:0, msg.time, msg.status, msg.sync_status, msg.edit_time]); persistDatabase(); } saveToLocalStorageCache(); return msg; }
    function updateMessage(msgId, updates) { for (const msgs of Object.values(inMemoryDB.messages)) { const idx = msgs.findIndex(m => m.id===msgId); if (idx>=0) { msgs[idx] = {...msgs[idx], ...updates}; if (!useFallback && db) { const m=msgs[idx]; db.run("UPDATE messages SET text=?, img=?, voice_blob=?, voice_duration=?, reply_to=?, likes=?, liked=?, status=?, sync_status=?, edit_time=? WHERE id=?", [m.text||'', m.img, m.voice_blob, m.voice_duration, m.reply_to, m.likes, m.liked?1:0, m.status, m.sync_status, m.edit_time, m.id]); persistDatabase(); } saveToLocalStorageCache(); return true; } } return false; }
    function deleteMessage(msgId) { for (const msgs of Object.values(inMemoryDB.messages)) { const idx = msgs.findIndex(m => m.id===msgId); if (idx>=0) { msgs.splice(idx,1); if (!useFallback && db) { db.run("DELETE FROM messages WHERE id=?", [msgId]); persistDatabase(); } saveToLocalStorageCache(); return true; } } return false; }
    function getContacts() { return [...inMemoryDB.contacts]; }
    function getRegisteredContacts() { return inMemoryDB.contacts.filter(c => c.registered); }
    function getUnregisteredContacts() { return inMemoryDB.contacts.filter(c => !c.registered); }
    function saveContact(cd) { const idx = inMemoryDB.contacts.findIndex(c => c.id===cd.id); if (idx>=0) inMemoryDB.contacts[idx] = {...inMemoryDB.contacts[idx], ...cd}; else inMemoryDB.contacts.push(cd); if (!useFallback && db) { db.run("INSERT OR REPLACE INTO contacts VALUES (?,?,?,?,?,?)", [cd.id, cd.phone, cd.name||'', cd.registered?1:0, cd.invite_code, currentTimestamp()]); persistDatabase(); } saveToLocalStorageCache(); }
    function syncContactsFromDevice() { console.log('syncContactsFromDevice called'); return []; }
    function getStories() { return [...inMemoryDB.stories]; }
    function addStory(sd) { sd.id = sd.id || generateId(); sd.time = sd.time || currentTimestamp(); inMemoryDB.stories.unshift(sd); if (!useFallback && db) { db.run("INSERT INTO stories VALUES (?,?,?,?)", [sd.id, sd.name, sd.avatar, sd.time]); persistDatabase(); } saveToLocalStorageCache(); }
    function getChannels() { return [...inMemoryDB.channels]; }
    function addChannel(cd) { cd.id = cd.id || generateId(); inMemoryDB.channels.unshift(cd); if (!useFallback && db) { db.run("INSERT INTO channels VALUES (?,?,?,?,?)", [cd.id, cd.name, cd.avatar, cd.followers||0, cd.update_time||currentTimestamp()]); persistDatabase(); } saveToLocalStorageCache(); }
    function getCalls() { return [...inMemoryDB.calls]; }
    function addCall(cd) { cd.id = cd.id || generateId(); cd.time = cd.time || currentTimestamp(); inMemoryDB.calls.unshift(cd); if (!useFallback && db) { db.run("INSERT INTO calls VALUES (?,?,?,?,?)", [cd.id, cd.name, cd.avatar, cd.time, cd.type]); persistDatabase(); } saveToLocalStorageCache(); }
    function getCatalog() { return [...inMemoryDB.catalog]; }
    function addCatalogItem(item) { item.id = item.id || generateId(); inMemoryDB.catalog.unshift(item); if (!useFallback && db) { db.run("INSERT INTO catalog VALUES (?,?,?,?)", [item.id, item.name, item.price||'', item.icon]); persistDatabase(); } saveToLocalStorageCache(); }
    function getSettings() { return {...inMemoryDB.settings}; }
    function updateSetting(key, value) { inMemoryDB.settings[key] = value; if (!useFallback && db) { db.run("INSERT OR REPLACE INTO settings VALUES (?,?)", [key, String(value)]); persistDatabase(); } saveToLocalStorageCache(); }
    function exportAllData() { return JSON.stringify({ user: inMemoryDB.user, chats: inMemoryDB.chats, messages: inMemoryDB.messages, contacts: inMemoryDB.contacts, stories: inMemoryDB.stories, channels: inMemoryDB.channels, calls: inMemoryDB.calls, catalog: inMemoryDB.catalog, settings: inMemoryDB.settings, exportDate: currentTimestamp() }, null, 2); }
    async function importAllData(json) { try { const data = JSON.parse(json); if (data.chats && data.messages) { inMemoryDB.user = data.user || null; inMemoryDB.chats = data.chats; inMemoryDB.messages = data.messages; inMemoryDB.contacts = data.contacts || []; inMemoryDB.stories = data.stories || []; inMemoryDB.channels = data.channels || []; inMemoryDB.calls = data.calls || []; inMemoryDB.catalog = data.catalog || []; inMemoryDB.settings = data.settings || { theme:'dark', notifications:true }; await persistAllData(); return true; } return false; } catch(e) { return false; } }
    function clearAllData() { inMemoryDB.chats = []; inMemoryDB.messages = {}; inMemoryDB.contacts = []; inMemoryDB.stories = []; inMemoryDB.channels = []; inMemoryDB.calls = []; inMemoryDB.catalog = []; if (!useFallback && db) { db.run("DELETE FROM messages"); db.run("DELETE FROM chats"); db.run("DELETE FROM contacts"); db.run("DELETE FROM stories"); db.run("DELETE FROM channels"); db.run("DELETE FROM calls"); db.run("DELETE FROM catalog"); persistDatabase(); } saveToLocalStorageCache(); }
    function getPendingMessages() { const pending = []; for (const msgs of Object.values(inMemoryDB.messages)) for (const m of msgs) if (m.sync_status === 'pending-send' || m.sync_status === 'failed') pending.push(m); return pending; }

    console.log('✅ db.js (نهائي، خالٍ من البيانات الوهمية) جاهز');
})();
