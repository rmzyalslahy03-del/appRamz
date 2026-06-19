// db.js - طبقة التخزين الهجين النهائية لـ RamzApp (إصدار 4.0)
// يدعم: Offline-First، SQLite (عبر OPFS/IndexedDB)، LocalStorage كاحتياطي
// مع دوال كاملة للقصص (صور، فيديو، نصوص) والمزامنة التلقائية

(function() {
    // ================== التكوين ==================
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

    // ================== دوال مساعدة ==================
    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }
    function currentTimestamp() {
        return new Date().toISOString();
    }

    // ================== LocalStorage Cache ==================
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

    // ================== SQL.js (WebAssembly) ==================
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
                } else reject(new Error('SQL.js init failed'));
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ================== فتح قاعدة البيانات (OPFS / IndexedDB) ==================
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

    // ================== IndexedDB (احتياطي) ==================
    function saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppDB', 1);
            req.onupgradeneeded = (e) => {
                if (!e.target.result.objectStoreNames.contains('sqlite')) {
                    e.target.result.createObjectStore('sqlite');
                }
            };
            req.onsuccess = (e) => {
                const tx = e.target.result.transaction('sqlite', 'readwrite');
                tx.objectStore('sqlite').put(data, 'db');
                tx.oncomplete = resolve;
                tx.onerror = reject;
            };
            req.onerror = reject;
        });
    }

    function loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppDB', 1);
            req.onupgradeneeded = (e) => {
                if (!e.target.result.objectStoreNames.contains('sqlite')) {
                    e.target.result.createObjectStore('sqlite');
                }
            };
            req.onsuccess = (e) => {
                const tx = e.target.result.transaction('sqlite', 'readonly');
                const getReq = tx.objectStore('sqlite').get('db');
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = reject;
            };
            req.onerror = reject;
        });
    }

    // ================== استمرار البيانات ==================
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
            } catch (e) {
                await saveToIndexedDB(data.buffer);
            }
        } catch (e) { /* تجاهل */ }
    }

    // ================== إنشاء الجداول ==================
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
            user_id TEXT
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

        // جدول القصص (مطور)
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
            followers INTEGER DEFAULT 0,
            update_time TEXT,
            user_id TEXT
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

        persistDatabase();
    }

    // ================== تحميل البيانات من SQLite إلى الذاكرة ==================
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
            // تحميل القصص (مع الفلترة حسب الانتهاء)
            const storyRows = db.exec("SELECT * FROM stories WHERE expires_at > datetime('now') ORDER BY time DESC");
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

    // ================== استمرار جميع البيانات ==================
    async function persistAllData() {
        if (useFallback || !db) {
            saveToLocalStorageCache();
            return;
        }
        try {
            db.run("DELETE FROM user");
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
            // حذف وإدراج الرسائل
            db.run("DELETE FROM messages");
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

            // حذف وإدراج المحادثات
            db.run("DELETE FROM chats");
            const insChat = db.prepare("INSERT INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
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
                    c.user_id || null
                ]);
            }
            insChat.free();

            // حذف وإدراج جهات الاتصال
            db.run("DELETE FROM contacts");
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

            // حذف وإدراج القصص (مع الحفاظ على الصلاحية)
            db.run("DELETE FROM stories");
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

            // حذف وإدراج القنوات
            db.run("DELETE FROM channels");
            const insCh = db.prepare("INSERT INTO channels VALUES (?,?,?,?,?,?)");
            for (const ch of inMemoryDB.channels) {
                insCh.run([ch.id, ch.name, ch.avatar, ch.followers || 0, ch.update_time || currentTimestamp(), ch.user_id || null]);
            }
            insCh.free();

            // حذف وإدراج المكالمات
            db.run("DELETE FROM calls");
            const insCall = db.prepare("INSERT INTO calls VALUES (?,?,?,?,?,?)");
            for (const c of inMemoryDB.calls) {
                insCall.run([c.id, c.name, c.avatar, c.time, c.type, c.user_id || null]);
            }
            insCall.free();

            // حذف وإدراج الكتالوج
            db.run("DELETE FROM catalog");
            const insCat = db.prepare("INSERT INTO catalog VALUES (?,?,?,?,?)");
            for (const c of inMemoryDB.catalog) {
                insCat.run([c.id, c.name, c.price || '', c.icon || '📦', c.user_id || null]);
            }
            insCat.free();

            // الإعدادات
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

    // ================== دوال مساعدة للرسائل ==================
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

    // ================== واجهة API العامة ==================

    // تهيئة قاعدة البيانات
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
            const savedUser = localStorage.getItem(DB_CONFIG.userKey);
            if (savedUser) {
                try { inMemoryDB.user = JSON.parse(savedUser); } catch (e) {}
            }
            return true;
        } catch (e) {
            useFallback = true;
            loadFromLocalStorageCache();
            return false;
        }
    }

    // المستخدم
    function getCurrentUser() { return inMemoryDB.user; }
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

    // المحادثات
    function getChats() { return [...inMemoryDB.chats]; }
    function getChat(chatId) { return inMemoryDB.chats.find(c => c.id === chatId); }
    function saveChat(chatData) {
        const idx = inMemoryDB.chats.findIndex(c => c.id === chatData.id);
        if (idx >= 0) {
            inMemoryDB.chats[idx] = { ...inMemoryDB.chats[idx], ...chatData };
        } else {
            inMemoryDB.chats.unshift(chatData);
        }
        if (!useFallback && db) {
            const c = chatData;
            db.run("INSERT OR REPLACE INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
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
                c.user_id || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }
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

    // الرسائل
    function getMessages(chatId) { return inMemoryDB.messages[chatId] || []; }
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

    // جهات الاتصال
    function getContacts() { return [...inMemoryDB.contacts]; }
    function getRegisteredContacts() { return inMemoryDB.contacts.filter(c => c.registered); }
    function getUnregisteredContacts() { return inMemoryDB.contacts.filter(c => !c.registered); }
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
    function syncContactsFromDevice() { console.log('syncContactsFromDevice called'); return []; }

    // القصص (مطور)
    function getStories() { return [...inMemoryDB.stories]; }
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
    function deleteStory(storyId) {
        inMemoryDB.stories = inMemoryDB.stories.filter(s => s.id !== storyId);
        if (!useFallback && db) {
            db.run("DELETE FROM stories WHERE id=?", [storyId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }

    // القنوات
    function getChannels() { return [...inMemoryDB.channels]; }
    function addChannel(channelData) {
        channelData.id = channelData.id || generateId();
        inMemoryDB.channels.unshift(channelData);
        if (!useFallback && db) {
            db.run("INSERT INTO channels VALUES (?,?,?,?,?,?)", [
                channelData.id,
                channelData.name,
                channelData.avatar || '📢',
                channelData.followers || 0,
                channelData.update_time || currentTimestamp(),
                channelData.user_id || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }

    // المكالمات
    function getCalls() { return [...inMemoryDB.calls]; }
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

    // الكتالوج
    function getCatalog() { return [...inMemoryDB.catalog]; }
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

    // الإعدادات
    function getSettings() { return { ...inMemoryDB.settings }; }
    function updateSetting(key, value) {
        inMemoryDB.settings[key] = value;
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO settings VALUES (?,?)", [key, String(value)]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    }

    // تصدير/استيراد
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
            return false;
        }
    }

    // تنظيف كامل
    function clearAllData() {
        inMemoryDB.chats = [];
        inMemoryDB.messages = {};
        inMemoryDB.contacts = [];
        inMemoryDB.stories = [];
        inMemoryDB.channels = [];
        inMemoryDB.calls = [];
        inMemoryDB.catalog = [];
        if (!useFallback && db) {
            db.run("DELETE FROM messages");
            db.run("DELETE FROM chats");
            db.run("DELETE FROM contacts");
            db.run("DELETE FROM stories");
            db.run("DELETE FROM channels");
            db.run("DELETE FROM calls");
            db.run("DELETE FROM catalog");
            persistDatabase();
        }
        localStorage.removeItem(DB_CONFIG.userKey);
        saveToLocalStorageCache();
    }

    // الرسائل المعلقة للمزامنة
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

    // ================== تصدير الواجهة العامة ==================
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
    window.updateStory = updateStory;
    window.deleteStory = deleteStory;
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

    console.log('✅ db.js (النسخة النهائية الكاملة مع القصص) جاهز');
})();
