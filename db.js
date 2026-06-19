// ======================================================================
// db.js - الإصدار النهائي الكامل v4.0
// طبقة التخزين الهجين: SQLite (OPFS/IndexedDB) + LocalStorage احتياطي
// يدعم: المستخدم، المحادثات، الرسائل، جهات الاتصال، القصص، القنوات، المكالمات، الكتالوج، الإعدادات
// ======================================================================

(function() {
    'use strict';

    // ======================================================================
    // التكوين الأساسي
    // ======================================================================
    const DB_CONFIG = {
        localStorageKey: 'ramzapp_v4_db_cache',
        userKey: 'ramzapp_user',
        sqliteFileName: 'ramzapp.db',
        sqlWasmUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.wasm',
        sqlJsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.js',
        maxRetries: 3
    };

    let SQL = null;
    let db = null;
    let dbReady = false;
    let useFallback = false;
    let indexedDBReady = false;
    let initPromise = null;

    // ======================================================================
    // الذاكرة المؤقتة (In-Memory) – تستخدم كطبقة وسيطة
    // ======================================================================
    const inMemoryDB = {
        user: null,
        chats: [],
        messages: {},      // { chatId: [message, ...] }
        contacts: [],
        stories: [],
        channels: [],
        calls: [],
        catalog: [],
        settings: { theme: 'dark', notifications: true }
    };
    window.inMemoryDB = inMemoryDB; // للوصول من console

    // ======================================================================
    // دوال مساعدة
    // ======================================================================
    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    window.generateId = generateId;

    function currentTimestamp() {
        return new Date().toISOString();
    }
    window.currentTimestamp = currentTimestamp;

    function isObject(obj) { return obj && typeof obj === 'object' && !Array.isArray(obj); }

    // ======================================================================
    // LocalStorage Cache (احتياطي سريع)
    // ======================================================================
    function saveToLocalStorageCache() {
        try {
            const cache = {
                chats: inMemoryDB.chats.slice(0, 100).map(c => {
                    const copy = { ...c };
                    // لا ننسخ الرسائل ضمن المحادثة (لأنها في messages)
                    delete copy._messages;
                    return copy;
                }),
                contacts: inMemoryDB.contacts,
                stories: inMemoryDB.stories,
                channels: inMemoryDB.channels,
                catalog: inMemoryDB.catalog,
                settings: inMemoryDB.settings,
                lastUpdate: currentTimestamp()
            };
            localStorage.setItem(DB_CONFIG.localStorageKey, JSON.stringify(cache));
        } catch (e) { /* تجاهل */ }
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
        } catch (e) { /* تجاهل */ }
        return false;
    }

    // ======================================================================
    // SQL.js (WebAssembly) – تحميل المكتبة
    // ======================================================================
    async function loadSqlJs() {
        if (SQL) return SQL;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = DB_CONFIG.sqlJsUrl;
            script.onload = () => {
                if (window.initSqlJs) {
                    window.initSqlJs({ locateFile: file => DB_CONFIG.sqlWasmUrl })
                        .then(sql => { SQL = sql; resolve(SQL); })
                        .catch(reject);
                } else {
                    // محاولة تحميل من CDN مباشرة (ESM)
                    import('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.js')
                        .then(module => {
                            // بعض الإصدارات تعرض default
                            if (module.default) {
                                SQL = module.default;
                            } else {
                                SQL = module;
                            }
                            resolve(SQL);
                        })
                        .catch(reject);
                }
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ======================================================================
    // فتح قاعدة البيانات (OPFS / IndexedDB)
    // ======================================================================
    async function openDatabase() {
        if (!SQL) await loadSqlJs();

        // 1. محاولة OPFS (File System Access API)
        try {
            if ('storage' in navigator && 'getDirectory' in navigator.storage) {
                const opfsRoot = await navigator.storage.getDirectory();
                const fileHandle = await opfsRoot.getFileHandle(DB_CONFIG.sqliteFileName, { create: true });
                const file = await fileHandle.getFile();
                const arrayBuffer = await file.arrayBuffer();

                if (arrayBuffer.byteLength > 0) {
                    db = new SQL.Database(new Uint8Array(arrayBuffer));
                } else {
                    db = new SQL.Database();
                }
                dbReady = true;
                console.log('✅ SQLite database opened via OPFS');
                return true;
            }
        } catch (e) {
            console.warn('⚠️ OPFS failed, trying IndexedDB...', e);
        }

        // 2. محاولة IndexedDB (احتياطي)
        try {
            const saved = await loadFromIndexedDB();
            if (saved) {
                db = new SQL.Database(new Uint8Array(saved));
            } else {
                db = new SQL.Database();
            }
            dbReady = true;
            console.log('✅ SQLite database opened via IndexedDB');
            return true;
        } catch (e2) {
            console.warn('⚠️ IndexedDB failed, using LocalStorage only', e2);
            useFallback = true;
            dbReady = true;
            return false;
        }
    }

    // ======================================================================
    // IndexedDB (لحفظ ملف SQLite كـ ArrayBuffer)
    // ======================================================================
    function saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppDB', 2);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('sqlite')) {
                    db.createObjectStore('sqlite');
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('sqlite', 'readwrite');
                const store = tx.objectStore('sqlite');
                const putReq = store.put(data, 'db');
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    function loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppDB', 2);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('sqlite')) {
                    db.createObjectStore('sqlite');
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('sqlite', 'readonly');
                const store = tx.objectStore('sqlite');
                const getReq = store.get('db');
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => reject(getReq.error);
                tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    // ======================================================================
    // استمرار البيانات (Persist)
    // ======================================================================
    async function persistDatabase() {
        if (useFallback || !db) {
            saveToLocalStorageCache();
            return;
        }
        try {
            const data = db.export();
            // محاولة OPFS أولاً
            try {
                if ('storage' in navigator && 'getDirectory' in navigator.storage) {
                    const opfsRoot = await navigator.storage.getDirectory();
                    const fileHandle = await opfsRoot.getFileHandle(DB_CONFIG.sqliteFileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(data.buffer);
                    await writable.close();
                } else {
                    await saveToIndexedDB(data.buffer);
                }
            } catch (e) {
                await saveToIndexedDB(data.buffer);
            }
        } catch (e) { /* تجاهل */ }
        saveToLocalStorageCache();
    }

    // ======================================================================
    // إنشاء الجداول (إذا لم تكن موجودة)
    // ======================================================================
    function createTables() {
        if (useFallback || !db) return;

        // جدول المستخدم
        db.run(`CREATE TABLE IF NOT EXISTS user (
            id TEXT PRIMARY KEY,
            email TEXT,
            name TEXT,
            avatar TEXT,
            phone TEXT,
            is_guest INTEGER DEFAULT 0,
            last_sync TEXT
        )`);

        // جدول المحادثات
        db.run(`CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar TEXT,
            last_msg TEXT,
            last_time TEXT,
            unread INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            online INTEGER DEFAULT 0,
            last_seen TEXT,
            bio TEXT,
            typing INTEGER DEFAULT 0,
            typing_time TEXT,
            is_group INTEGER DEFAULT 0,
            user_id TEXT,
            muted INTEGER DEFAULT 0,
            blocked INTEGER DEFAULT 0,
            disappear_time INTEGER DEFAULT 0,
            created_by TEXT,
            members TEXT
        )`);

        // جدول الرسائل
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            text TEXT,
            img TEXT,
            voice_blob TEXT,
            voice_duration TEXT,
            reply_to TEXT,
            likes INTEGER DEFAULT 0,
            liked INTEGER DEFAULT 0,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'pending-send',
            sync_status TEXT DEFAULT 'pending-send',
            edit_time TEXT,
            encrypted INTEGER DEFAULT 0,
            encrypted_payload TEXT
        )`);
        db.run('CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(time)');

        // جدول جهات الاتصال
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            name TEXT,
            registered INTEGER DEFAULT 0,
            invite_code TEXT,
            last_sync TEXT,
            user_id TEXT
        )`);

        // جدول القصص
        db.run(`CREATE TABLE IF NOT EXISTS stories (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            avatar TEXT,
            type TEXT,
            content TEXT,
            caption TEXT,
            time TEXT,
            expires_at TEXT,
            isViewed INTEGER DEFAULT 0,
            color TEXT
        )`);
        db.run('CREATE INDEX IF NOT EXISTS idx_stories_time ON stories(time)');
        db.run('CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at)');

        // جدول القنوات
        db.run(`CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            name TEXT,
            avatar TEXT,
            description TEXT,
            followers INTEGER DEFAULT 0,
            invite_code TEXT,
            created_by TEXT,
            created_at TEXT,
            update_time TEXT,
            user_id TEXT,
            subscribers TEXT
        )`);

        // جدول المكالمات
        db.run(`CREATE TABLE IF NOT EXISTS calls (
            id TEXT PRIMARY KEY,
            name TEXT,
            avatar TEXT,
            time TEXT,
            type TEXT,
            user_id TEXT
        )`);

        // جدول الكتالوج
        db.run(`CREATE TABLE IF NOT EXISTS catalog (
            id TEXT PRIMARY KEY,
            name TEXT,
            price TEXT,
            icon TEXT,
            user_id TEXT
        )`);

        // جدول الإعدادات
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        // جدول الرسائل المعلقة (يستخدمها sync.js)
        db.run(`CREATE TABLE IF NOT EXISTS pending_messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT,
            sender_id TEXT,
            recipient_chat_id TEXT,
            payload TEXT,
            created_at TEXT,
            expires_at TEXT
        )`);

        persistDatabase();
    }

    // ======================================================================
    // تحميل البيانات من SQLite إلى الذاكرة المؤقتة
    // ======================================================================
    function loadInMemoryFromSQLite() {
        if (useFallback || !db) return false;
        try {
            // تحميل المستخدم
            const userRows = db.exec("SELECT * FROM user LIMIT 1");
            if (userRows.length && userRows[0].values.length) {
                const u = {};
                userRows[0].columns.forEach((c, i) => u[c] = userRows[0].values[0][i]);
                inMemoryDB.user = u;
            }

            // تحميل المحادثات
            const chatRows = db.exec("SELECT * FROM chats ORDER BY pinned DESC, last_time DESC");
            if (chatRows.length) {
                inMemoryDB.chats = chatRows[0].values.map(r => {
                    const c = {};
                    chatRows[0].columns.forEach((col, i) => c[col] = r[i]);
                    // معالجة members إذا كانت مخزنة كـ JSON
                    if (c.members && typeof c.members === 'string') {
                        try { c.members = JSON.parse(c.members); } catch(e) { c.members = []; }
                    } else if (!c.members) {
                        c.members = [];
                    }
                    return c;
                });
            }

            // تحميل الرسائل
            inMemoryDB.messages = {};
            const msgRows = db.exec("SELECT * FROM messages ORDER BY time ASC");
            if (msgRows.length) {
                const all = msgRows[0].values.map(r => {
                    const m = {};
                    msgRows[0].columns.forEach((col, i) => m[col] = r[i]);
                    return m;
                });
                all.forEach(m => {
                    if (!inMemoryDB.messages[m.chat_id]) inMemoryDB.messages[m.chat_id] = [];
                    inMemoryDB.messages[m.chat_id].push(m);
                });
            }

            // تحميل جهات الاتصال
            const contactRows = db.exec("SELECT * FROM contacts");
            if (contactRows.length) {
                inMemoryDB.contacts = contactRows[0].values.map(r => {
                    const c = {};
                    contactRows[0].columns.forEach((col, i) => c[col] = r[i]);
                    return c;
                });
            }

            // تحميل القصص (مع فلترة المنتهية)
            const now = new Date().toISOString();
            const storyRows = db.exec(`SELECT * FROM stories WHERE expires_at > datetime('${now}') ORDER BY time DESC`);
            if (storyRows.length) {
                inMemoryDB.stories = storyRows[0].values.map(r => {
                    const s = {};
                    storyRows[0].columns.forEach((col, i) => s[col] = r[i]);
                    return s;
                });
            } else {
                inMemoryDB.stories = [];
            }

            // تحميل القنوات
            const channelRows = db.exec("SELECT * FROM channels");
            if (channelRows.length) {
                inMemoryDB.channels = channelRows[0].values.map(r => {
                    const ch = {};
                    channelRows[0].columns.forEach((col, i) => ch[col] = r[i]);
                    if (ch.subscribers && typeof ch.subscribers === 'string') {
                        try { ch.subscribers = JSON.parse(ch.subscribers); } catch(e) { ch.subscribers = []; }
                    } else if (!ch.subscribers) {
                        ch.subscribers = [];
                    }
                    return ch;
                });
            }

            // تحميل المكالمات
            const callRows = db.exec("SELECT * FROM calls ORDER BY time DESC");
            if (callRows.length) {
                inMemoryDB.calls = callRows[0].values.map(r => {
                    const c = {};
                    callRows[0].columns.forEach((col, i) => c[col] = r[i]);
                    return c;
                });
            }

            // تحميل الكتالوج
            const catalogRows = db.exec("SELECT * FROM catalog");
            if (catalogRows.length) {
                inMemoryDB.catalog = catalogRows[0].values.map(r => {
                    const c = {};
                    catalogRows[0].columns.forEach((col, i) => c[col] = r[i]);
                    return c;
                });
            }

            // تحميل الإعدادات
            const settingsRows = db.exec("SELECT * FROM settings");
            if (settingsRows.length) {
                settingsRows[0].values.forEach(r => {
                    if (r[0] === 'theme') inMemoryDB.settings.theme = r[1];
                    if (r[0] === 'notifications') inMemoryDB.settings.notifications = r[1] === 'true';
                });
            }

            return true;
        } catch (e) {
            console.warn('⚠️ فشل تحميل البيانات من SQLite', e);
            return false;
        }
    }

    // ======================================================================
    // حفظ جميع البيانات إلى SQLite
    // ======================================================================
    async function persistAllData() {
        if (useFallback || !db) {
            saveToLocalStorageCache();
            return;
        }
        try {
            // حذف جميع البيانات الحالية
            db.run("DELETE FROM user");
            db.run("DELETE FROM messages");
            db.run("DELETE FROM chats");
            db.run("DELETE FROM contacts");
            db.run("DELETE FROM stories");
            db.run("DELETE FROM channels");
            db.run("DELETE FROM calls");
            db.run("DELETE FROM catalog");
            db.run("DELETE FROM settings");

            // إدراج المستخدم
            if (inMemoryDB.user) {
                db.run("INSERT INTO user VALUES (?,?,?,?,?,?,?)", [
                    inMemoryDB.user.id,
                    inMemoryDB.user.email || '',
                    inMemoryDB.user.name,
                    inMemoryDB.user.avatar,
                    inMemoryDB.user.phone || '',
                    inMemoryDB.user.is_guest ? 1 : 0,
                    currentTimestamp()
                ]);
            }

            // إدراج الرسائل
            const insMsg = db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            for (const msgs of Object.values(inMemoryDB.messages)) {
                for (const m of msgs) {
                    insMsg.run([
                        m.id,
                        m.chat_id,
                        m.sender_id,
                        m.text || '',
                        m.img || null,
                        m.voice_blob || null,
                        m.voice_duration || null,
                        m.reply_to || null,
                        m.likes || 0,
                        m.liked ? 1 : 0,
                        m.time,
                        m.status || 'pending-send',
                        m.sync_status || 'pending-send',
                        m.edit_time || null,
                        m.encrypted ? 1 : 0,
                        m.encrypted_payload || null
                    ]);
                }
            }
            insMsg.free();

            // إدراج المحادثات
            const insChat = db.prepare("INSERT INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            for (const c of inMemoryDB.chats) {
                insChat.run([
                    c.id,
                    c.name,
                    c.avatar || '',
                    c.last_msg || '',
                    c.last_time || currentTimestamp(),
                    c.unread || 0,
                    c.pinned ? 1 : 0,
                    c.online ? 1 : 0,
                    c.last_seen || '',
                    c.bio || '',
                    c.typing ? 1 : 0,
                    c.typing_time || null,
                    c.is_group ? 1 : 0,
                    c.user_id || null,
                    c.muted ? 1 : 0,
                    c.blocked ? 1 : 0,
                    c.disappear_time || 0,
                    c.created_by || null,
                    c.members ? JSON.stringify(c.members) : '[]'
                ]);
            }
            insChat.free();

            // إدراج جهات الاتصال
            const insCont = db.prepare("INSERT INTO contacts VALUES (?,?,?,?,?,?,?)");
            for (const c of inMemoryDB.contacts) {
                insCont.run([
                    c.id,
                    c.phone,
                    c.name || '',
                    c.registered ? 1 : 0,
                    c.invite_code || null,
                    currentTimestamp(),
                    c.user_id || null
                ]);
            }
            insCont.free();

            // إدراج القصص
            const insStory = db.prepare("INSERT INTO stories VALUES (?,?,?,?,?,?,?,?,?,?,?)");
            const now = new Date().toISOString();
            for (const s of inMemoryDB.stories) {
                if (s.expires_at && s.expires_at < now) continue; // تجاهل المنتهية
                insStory.run([
                    s.id,
                    s.user_id || null,
                    s.name || 'مستخدم',
                    s.avatar || '📷',
                    s.type || 'image',
                    s.content || '',
                    s.caption || '',
                    s.time || currentTimestamp(),
                    s.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    s.isViewed ? 1 : 0,
                    s.color || '#ff0050'
                ]);
            }
            insStory.free();

            // إدراج القنوات
            const insCh = db.prepare("INSERT INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?)");
            for (const ch of inMemoryDB.channels) {
                insCh.run([
                    ch.id,
                    ch.name,
                    ch.avatar || '📢',
                    ch.description || '',
                    ch.followers || 0,
                    ch.invite_code || '',
                    ch.created_by || null,
                    ch.created_at || currentTimestamp(),
                    ch.update_time || currentTimestamp(),
                    ch.user_id || null,
                    ch.subscribers ? JSON.stringify(ch.subscribers) : '[]'
                ]);
            }
            insCh.free();

            // إدراج المكالمات
            const insCall = db.prepare("INSERT INTO calls VALUES (?,?,?,?,?,?)");
            for (const c of inMemoryDB.calls) {
                insCall.run([c.id, c.name, c.avatar, c.time, c.type, c.user_id || null]);
            }
            insCall.free();

            // إدراج الكتالوج
            const insCat = db.prepare("INSERT INTO catalog VALUES (?,?,?,?,?)");
            for (const c of inMemoryDB.catalog) {
                insCat.run([c.id, c.name, c.price || '', c.icon || '📦', c.user_id || null]);
            }
            insCat.free();

            // إدراج الإعدادات
            db.run("DELETE FROM settings");
            db.run("INSERT INTO settings VALUES ('theme',?)", [inMemoryDB.settings.theme]);
            db.run("INSERT INTO settings VALUES ('notifications',?)", [inMemoryDB.settings.notifications ? 'true' : 'false']);

            await persistDatabase();
            saveToLocalStorageCache();
        } catch (e) {
            console.warn('⚠️ فشل حفظ البيانات في SQLite، استخدام LocalStorage', e);
            saveToLocalStorageCache();
        }
    }

    // ======================================================================
    // دوال إدارة الرسائل (مساعدة)
    // ======================================================================
    function addMessageToMemory(msg) {
        if (!inMemoryDB.messages[msg.chat_id]) inMemoryDB.messages[msg.chat_id] = [];
        inMemoryDB.messages[msg.chat_id].push(msg);
        const chat = inMemoryDB.chats.find(c => c.id === msg.chat_id);
        if (chat) {
            chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
            chat.last_time = msg.time;
            if (msg.sender_id !== 'me' && !chat.online) chat.unread = (chat.unread || 0) + 1;
        }
    }

    // ======================================================================
    // واجهة API العامة – جميع الدوال المطلوبة
    // ======================================================================

    // ----- التهيئة -----
    async function initDB() {
        if (initPromise) return initPromise;
        initPromise = (async () => {
            try {
                await loadSqlJs();
                await openDatabase();
                if (!useFallback) {
                    createTables();
                    loadInMemoryFromSQLite();
                } else {
                    loadFromLocalStorageCache();
                }
                const savedUser = localStorage.getItem(DB_CONFIG.userKey);
                if (savedUser) {
                    try { inMemoryDB.user = JSON.parse(savedUser); } catch (e) {}
                }
                console.log(`✅ db.js initialized: ${inMemoryDB.chats.length} chats, ${inMemoryDB.contacts.length} contacts`);
                return true;
            } catch (e) {
                console.error('❌ db.js initialization failed:', e);
                useFallback = true;
                loadFromLocalStorageCache();
                return false;
            }
        })();
        return initPromise;
    }
    window.initDB = initDB;

    // ----- المستخدم -----
    function getCurrentUser() { return inMemoryDB.user; }
    window.getCurrentUser = getCurrentUser;

    function setCurrentUser(userData) {
        inMemoryDB.user = userData;
        localStorage.setItem(DB_CONFIG.userKey, JSON.stringify(userData));
        if (!useFallback && db) {
            db.run("DELETE FROM user");
            db.run("INSERT INTO user VALUES (?,?,?,?,?,?,?)", [
                userData.id,
                userData.email || '',
                userData.name,
                userData.avatar,
                userData.phone || '',
                userData.is_guest ? 1 : 0,
                currentTimestamp()
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.setCurrentUser = setCurrentUser;

    // ----- المحادثات -----
    function getChats() { return [...inMemoryDB.chats]; }
    window.getChats = getChats;

    function getChat(chatId) { return inMemoryDB.chats.find(c => c.id === chatId); }
    window.getChat = getChat;

    function saveChat(chatData) {
        const idx = inMemoryDB.chats.findIndex(c => c.id === chatData.id);
        if (idx >= 0) {
            inMemoryDB.chats[idx] = { ...inMemoryDB.chats[idx], ...chatData };
        } else {
            inMemoryDB.chats.unshift(chatData);
        }
        if (!useFallback && db) {
            const c = inMemoryDB.chats.find(c => c.id === chatData.id);
            if (c) {
                db.run("INSERT OR REPLACE INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                    c.id,
                    c.name,
                    c.avatar || '',
                    c.last_msg || '',
                    c.last_time || currentTimestamp(),
                    c.unread || 0,
                    c.pinned ? 1 : 0,
                    c.online ? 1 : 0,
                    c.last_seen || '',
                    c.bio || '',
                    c.typing ? 1 : 0,
                    c.typing_time || null,
                    c.is_group ? 1 : 0,
                    c.user_id || null,
                    c.muted ? 1 : 0,
                    c.blocked ? 1 : 0,
                    c.disappear_time || 0,
                    c.created_by || null,
                    c.members ? JSON.stringify(c.members) : '[]'
                ]);
                persistDatabase();
            }
        }
        saveToLocalStorageCache();
    }
    window.saveChat = saveChat;

    function deleteChat(chatId) {
        inMemoryDB.chats = inMemoryDB.chats.filter(c => c.id !== chatId);
        delete inMemoryDB.messages[chatId];
        if (!useFallback && db) {
            db.run("DELETE FROM chats WHERE id=?", [chatId]);
            db.run("DELETE FROM messages WHERE chat_id=?", [chatId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.deleteChat = deleteChat;

    // ----- الرسائل -----
    function getMessages(chatId) { return inMemoryDB.messages[chatId] || []; }
    window.getMessages = getMessages;

    function addMessage(msg) {
        msg.id = msg.id || generateId();
        msg.chat_id = msg.chat_id || msg.sid;
        msg.sender_id = msg.sid || msg.sender_id;
        msg.sync_status = msg.sync_status || (msg.sender_id === 'me' ? 'pending-send' : 'delivered');
        msg.status = msg.status || msg.sync_status;
        msg.time = msg.time || currentTimestamp();
        msg.likes = msg.likes || 0;
        msg.liked = msg.liked || false;
        addMessageToMemory(msg);
        if (!useFallback && db) {
            db.run("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                msg.id,
                msg.chat_id,
                msg.sender_id,
                msg.text || '',
                msg.img || null,
                msg.voice_blob || null,
                msg.voice_duration || null,
                msg.reply_to || null,
                msg.likes || 0,
                msg.liked ? 1 : 0,
                msg.time,
                msg.status,
                msg.sync_status,
                msg.edit_time || null,
                msg.encrypted ? 1 : 0,
                msg.encrypted_payload || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
        return msg;
    }
    window.addMessage = addMessage;

    function updateMessage(msgId, updates) {
        for (const msgs of Object.values(inMemoryDB.messages)) {
            const idx = msgs.findIndex(m => m.id === msgId);
            if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], ...updates };
                if (!useFallback && db) {
                    const m = msgs[idx];
                    db.run("UPDATE messages SET text=?, img=?, voice_blob=?, voice_duration=?, reply_to=?, likes=?, liked=?, status=?, sync_status=?, edit_time=?, encrypted=?, encrypted_payload=? WHERE id=?", [
                        m.text || '',
                        m.img || null,
                        m.voice_blob || null,
                        m.voice_duration || null,
                        m.reply_to || null,
                        m.likes || 0,
                        m.liked ? 1 : 0,
                        m.status || 'pending-send',
                        m.sync_status || 'pending-send',
                        m.edit_time || null,
                        m.encrypted ? 1 : 0,
                        m.encrypted_payload || null,
                        m.id
                    ]);
                    persistDatabase();
                }
                saveToLocalStorageCache();
                return true;
            }
        }
        return false;
    }
    window.updateMessage = updateMessage;

    function deleteMessage(msgId) {
        for (const msgs of Object.values(inMemoryDB.messages)) {
            const idx = msgs.findIndex(m => m.id === msgId);
            if (idx >= 0) {
                msgs.splice(idx, 1);
                if (!useFallback && db) {
                    db.run("DELETE FROM messages WHERE id=?", [msgId]);
                    persistDatabase();
                }
                saveToLocalStorageCache();
                return true;
            }
        }
        return false;
    }
    window.deleteMessage = deleteMessage;

    // ----- جهات الاتصال -----
    function getContacts() { return [...inMemoryDB.contacts]; }
    window.getContacts = getContacts;

    function getRegisteredContacts() { return inMemoryDB.contacts.filter(c => c.registered); }
    window.getRegisteredContacts = getRegisteredContacts;

    function getUnregisteredContacts() { return inMemoryDB.contacts.filter(c => !c.registered); }
    window.getUnregisteredContacts = getUnregisteredContacts;

    function saveContact(contactData) {
        const idx = inMemoryDB.contacts.findIndex(c => c.id === contactData.id);
        if (idx >= 0) {
            inMemoryDB.contacts[idx] = { ...inMemoryDB.contacts[idx], ...contactData };
        } else {
            inMemoryDB.contacts.push(contactData);
        }
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO contacts VALUES (?,?,?,?,?,?,?)", [
                contactData.id,
                contactData.phone,
                contactData.name || '',
                contactData.registered ? 1 : 0,
                contactData.invite_code || null,
                currentTimestamp(),
                contactData.user_id || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.saveContact = saveContact;

    // ----- القصص -----
    function getStories() { return [...inMemoryDB.stories]; }
    window.getStories = getStories;

    function addStory(storyData) {
        storyData.id = storyData.id || generateId();
        storyData.time = storyData.time || currentTimestamp();
        storyData.expires_at = storyData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        storyData.isViewed = storyData.isViewed || false;
        storyData.color = storyData.color || '#' + Math.floor(Math.random() * 16777215).toString(16);
        // حذف القصص المنتهية قبل الإضافة
        const now = new Date().toISOString();
        inMemoryDB.stories = inMemoryDB.stories.filter(s => s.expires_at > now);
        inMemoryDB.stories.unshift(storyData);
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO stories VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
                storyData.id,
                storyData.user_id || null,
                storyData.name || 'مستخدم',
                storyData.avatar || '📷',
                storyData.type || 'image',
                storyData.content || '',
                storyData.caption || '',
                storyData.time,
                storyData.expires_at,
                storyData.isViewed ? 1 : 0,
                storyData.color
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.addStory = addStory;

    function updateStory(storyId, updates) {
        const idx = inMemoryDB.stories.findIndex(s => s.id === storyId);
        if (idx !== -1) {
            inMemoryDB.stories[idx] = { ...inMemoryDB.stories[idx], ...updates };
            if (!useFallback && db) {
                const s = inMemoryDB.stories[idx];
                db.run("UPDATE stories SET user_id=?, name=?, avatar=?, type=?, content=?, caption=?, time=?, expires_at=?, isViewed=?, color=? WHERE id=?", [
                    s.user_id || null,
                    s.name || 'مستخدم',
                    s.avatar || '📷',
                    s.type || 'image',
                    s.content || '',
                    s.caption || '',
                    s.time,
                    s.expires_at,
                    s.isViewed ? 1 : 0,
                    s.color,
                    s.id
                ]);
                persistDatabase();
            }
            saveToLocalStorageCache();
            return true;
        }
        return false;
    }
    window.updateStory = updateStory;

    function deleteStory(storyId) {
        inMemoryDB.stories = inMemoryDB.stories.filter(s => s.id !== storyId);
        if (!useFallback && db) {
            db.run("DELETE FROM stories WHERE id=?", [storyId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.deleteStory = deleteStory;

    // ----- القنوات -----
    function getChannels() { return [...inMemoryDB.channels]; }
    window.getChannels = getChannels;

    function addChannel(channelData) {
        channelData.id = channelData.id || generateId();
        channelData.created_at = channelData.created_at || currentTimestamp();
        channelData.subscribers = channelData.subscribers || [];
        channelData.followers = channelData.followers || 0;
        inMemoryDB.channels.unshift(channelData);
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
                channelData.id,
                channelData.name,
                channelData.avatar || '📢',
                channelData.description || '',
                channelData.followers || 0,
                channelData.invite_code || '',
                channelData.created_by || null,
                channelData.created_at || currentTimestamp(),
                channelData.update_time || currentTimestamp(),
                channelData.user_id || null,
                JSON.stringify(channelData.subscribers || [])
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.addChannel = addChannel;

    function saveChannel(channelData) {
        const idx = inMemoryDB.channels.findIndex(c => c.id === channelData.id);
        if (idx >= 0) {
            inMemoryDB.channels[idx] = { ...inMemoryDB.channels[idx], ...channelData };
        } else {
            inMemoryDB.channels.unshift(channelData);
        }
        if (!useFallback && db) {
            const ch = inMemoryDB.channels.find(c => c.id === channelData.id);
            if (ch) {
                db.run("INSERT OR REPLACE INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
                    ch.id,
                    ch.name,
                    ch.avatar || '📢',
                    ch.description || '',
                    ch.followers || 0,
                    ch.invite_code || '',
                    ch.created_by || null,
                    ch.created_at || currentTimestamp(),
                    ch.update_time || currentTimestamp(),
                    ch.user_id || null,
                    JSON.stringify(ch.subscribers || [])
                ]);
                persistDatabase();
            }
        }
        saveToLocalStorageCache();
    }
    window.saveChannel = saveChannel;

    function deleteChannel(channelId) {
        inMemoryDB.channels = inMemoryDB.channels.filter(c => c.id !== channelId);
        if (!useFallback && db) {
            db.run("DELETE FROM channels WHERE id=?", [channelId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.deleteChannel = deleteChannel;

    // ----- المكالمات -----
    function getCalls() { return [...inMemoryDB.calls]; }
    window.getCalls = getCalls;

    function addCall(callData) {
        callData.id = callData.id || generateId();
        callData.time = callData.time || currentTimestamp();
        inMemoryDB.calls.unshift(callData);
        if (!useFallback && db) {
            db.run("INSERT INTO calls VALUES (?,?,?,?,?,?)", [
                callData.id,
                callData.name,
                callData.avatar || '📞',
                callData.time,
                callData.type || 'outgoing',
                callData.user_id || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.addCall = addCall;

    // ----- الكتالوج -----
    function getCatalog() { return [...inMemoryDB.catalog]; }
    window.getCatalog = getCatalog;

    function addCatalogItem(item) {
        item.id = item.id || generateId();
        inMemoryDB.catalog.unshift(item);
        if (!useFallback && db) {
            db.run("INSERT INTO catalog VALUES (?,?,?,?,?)", [
                item.id,
                item.name,
                item.price || '',
                item.icon || '📦',
                item.user_id || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.addCatalogItem = addCatalogItem;

    // ----- الإعدادات -----
    function getSettings() { return { ...inMemoryDB.settings }; }
    window.getSettings = getSettings;

    function updateSetting(key, value) {
        inMemoryDB.settings[key] = value;
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO settings VALUES (?,?)", [key, String(value)]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
    window.updateSetting = updateSetting;

    // ----- تصدير/استيراد -----
    function exportAllData() {
        return JSON.stringify({
            user: inMemoryDB.user,
            chats: inMemoryDB.chats,
            messages: inMemoryDB.messages,
            contacts: inMemoryDB.contacts,
            stories: inMemoryDB.stories,
            channels: inMemoryDB.channels,
            calls: inMemoryDB.calls,
            catalog: inMemoryDB.catalog,
            settings: inMemoryDB.settings,
            exportDate: currentTimestamp()
        }, null, 2);
    }
    window.exportAllData = exportAllData;

    async function importAllData(json) {
        try {
            const data = JSON.parse(json);
            if (!data.chats || !data.messages) return false;
            inMemoryDB.user = data.user || null;
            inMemoryDB.chats = data.chats || [];
            inMemoryDB.messages = data.messages || {};
            inMemoryDB.contacts = data.contacts || [];
            inMemoryDB.stories = data.stories || [];
            inMemoryDB.channels = data.channels || [];
            inMemoryDB.calls = data.calls || [];
            inMemoryDB.catalog = data.catalog || [];
            inMemoryDB.settings = data.settings || { theme: 'dark', notifications: true };
            await persistAllData();
            return true;
        } catch (e) {
            console.error('❌ Import failed:', e);
            return false;
        }
    }
    window.importAllData = importAllData;

    // ----- تنظيف كامل -----
    function clearAllData() {
        inMemoryDB.chats = [];
        inMemoryDB.messages = {};
        inMemoryDB.contacts = [];
        inMemoryDB.stories = [];
        inMemoryDB.channels = [];
        inMemoryDB.calls = [];
        inMemoryDB.catalog = [];
        inMemoryDB.user = null;
        if (!useFallback && db) {
            db.run("DELETE FROM messages");
            db.run("DELETE FROM chats");
            db.run("DELETE FROM contacts");
            db.run("DELETE FROM stories");
            db.run("DELETE FROM channels");
            db.run("DELETE FROM calls");
            db.run("DELETE FROM catalog");
            db.run("DELETE FROM user");
            db.run("DELETE FROM settings");
            persistDatabase();
        }
        localStorage.removeItem(DB_CONFIG.userKey);
        saveToLocalStorageCache();
    }
    window.clearAllData = clearAllData;

    // ----- الرسائل المعلقة للمزامنة -----
    function getPendingMessages() {
        const pending = [];
        for (const msgs of Object.values(inMemoryDB.messages)) {
            for (const m of msgs) {
                if (m.sync_status === 'pending-send' || m.sync_status === 'failed') {
                    pending.push(m);
                }
            }
        }
        return pending;
    }
    window.getPendingMessages = getPendingMessages;

    // ----- حفظ جميع البيانات (استدعاء يدوي) -----
    async function saveAllData() {
        await persistAllData();
    }
    window.saveAllData = saveAllData;

    // ----- حالة التخزين -----
    function isUsingFallback() { return useFallback; }
    window.isUsingFallback = isUsingFallback;

    function isDbReady() { return dbReady; }
    window.isDbReady = isDbReady;

    // ======================================================================
    // تهيئة أولية (عند تحميل الصفحة)
    // ======================================================================
    console.log('✅ db.js (الإصدار النهائي الكامل) جاهز');

    // محاولة تهيئة تلقائية بعد تحميل الصفحة
    if (document.readyState === 'complete') {
        setTimeout(() => initDB().catch(() => {}), 500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => initDB().catch(() => {}), 1000);
        });
    }

})();
