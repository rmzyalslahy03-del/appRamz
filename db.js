// ======================================================================
// db.js - الإصدار النهائي v5.1 (مع إصلاحات تحميل البيانات)
// ======================================================================

(function() {
    'use strict';

    const DB_CONFIG = {
        localStorageKey: 'ramzapp_v5_db_cache',
        userKey: 'ramzapp_user',
        sqliteFileName: 'ramzapp.db',
        sqlWasmUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.wasm',
        sqlJsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.0/sql-wasm.js',
        maxRetries: 3,
        SAVE_INTERVAL: 30000 // حفظ تلقائي كل 30 ثانية
    };

    let SQL = null;
    let db = null;
    let dbReady = false;
    let useFallback = false;
    let initPromise = null;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 5;

    const inMemoryDB = {
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
    window.inMemoryDB = inMemoryDB;

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

    // ======================================================================
    // LocalStorage Cache (احتياطي سريع)
    // ======================================================================
    function saveToLocalStorageCache() {
        try {
            const cache = {
                chats: inMemoryDB.chats.slice(0, 200).map(c => {
                    const copy = { ...c };
                    delete copy._messages;
                    return copy;
                }),
                messages: inMemoryDB.messages,
                contacts: inMemoryDB.contacts,
                stories: inMemoryDB.stories,
                channels: inMemoryDB.channels,
                catalog: inMemoryDB.catalog,
                settings: inMemoryDB.settings,
                lastUpdate: currentTimestamp()
            };
            localStorage.setItem(DB_CONFIG.localStorageKey, JSON.stringify(cache));
            console.log('💾 تم حفظ البيانات في LocalStorage (احتياطي)');
        } catch (e) { /* تجاهل */ }
    }

    function loadFromLocalStorageCache() {
        try {
            const raw = localStorage.getItem(DB_CONFIG.localStorageKey);
            if (raw) {
                const data = JSON.parse(raw);
                if (data.chats) inMemoryDB.chats = data.chats;
                if (data.messages) inMemoryDB.messages = data.messages;
                if (data.contacts) inMemoryDB.contacts = data.contacts;
                if (data.stories) inMemoryDB.stories = data.stories;
                if (data.channels) inMemoryDB.channels = data.channels;
                if (data.catalog) inMemoryDB.catalog = data.catalog;
                if (data.settings) inMemoryDB.settings = data.settings;
                console.log('✅ تم تحميل البيانات من LocalStorage:', inMemoryDB.chats.length, 'محادثات');
                return true;
            }
        } catch (e) {
            console.warn('⚠️ فشل تحميل LocalStorage:', e);
        }
        return false;
    }

    // ======================================================================
    // IndexedDB (لحفظ ملف SQLite)
    // ======================================================================
    function saveToIndexedDB(data) {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open('RamzAppDB', 2);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('sqlite')) {
                    db.createObjectStore('sqlite');
                }
            };
            req.onsuccess = function(e) {
                var db = e.target.result;
                var tx = db.transaction('sqlite', 'readwrite');
                var store = tx.objectStore('sqlite');
                var putReq = store.put(data, 'db');
                putReq.onsuccess = function() { resolve(); };
                putReq.onerror = function() { reject(putReq.error); };
                tx.oncomplete = function() { resolve(); };
                tx.onerror = function() { reject(tx.error); };
            };
            req.onerror = function() { reject(req.error); };
        });
    }

    function loadFromIndexedDB() {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open('RamzAppDB', 2);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('sqlite')) {
                    db.createObjectStore('sqlite');
                }
            };
            req.onsuccess = function(e) {
                var db = e.target.result;
                var tx = db.transaction('sqlite', 'readonly');
                var store = tx.objectStore('sqlite');
                var getReq = store.get('db');
                getReq.onsuccess = function() { resolve(getReq.result); };
                getReq.onerror = function() { reject(getReq.error); };
                tx.onerror = function() { reject(tx.error); };
            };
            req.onerror = function() { reject(req.error); };
        });
    }

    // ======================================================================
    // تحميل SQL.js (WebAssembly)
    // ======================================================================
    function loadSqlJs() {
        return new Promise(function(resolve, reject) {
            if (SQL) { resolve(SQL); return; }
            var script = document.createElement('script');
            script.src = DB_CONFIG.sqlJsUrl;
            script.onload = function() {
                if (window.initSqlJs) {
                    window.initSqlJs({ locateFile: function(file) { return DB_CONFIG.sqlWasmUrl; } })
                        .then(function(sql) {
                            SQL = sql;
                            console.log('✅ SQL.js loaded successfully');
                            resolve(SQL);
                        })
                        .catch(function(err) {
                            console.warn('⚠️ SQL.js init failed:', err);
                            reject(err);
                        });
                } else if (window.SQL) {
                    SQL = window.SQL;
                    console.log('✅ SQL.js loaded (global)');
                    resolve(SQL);
                } else {
                    reject(new Error('SQL.js not found after loading'));
                }
            };
            script.onerror = function() {
                reject(new Error('Failed to load SQL.js script'));
            };
            document.head.appendChild(script);
        });
    }

    // ======================================================================
    // فتح قاعدة البيانات (OPFS / IndexedDB)
    // ======================================================================
    async function openDatabase() {
        if (!SQL) {
            try { await loadSqlJs(); } catch (e) {
                console.warn('⚠️ Failed to load SQL.js, using fallback');
                useFallback = true;
                dbReady = true;
                return false;
            }
        }

        // 1. محاولة OPFS
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

        // 2. محاولة IndexedDB
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
    // حفظ البيانات (Persist) - محسنة مع التحقق من صحة البيانات
    // ======================================================================
    async function persistDatabase() {
        if (useFallback || !db) {
            saveToLocalStorageCache();
            return;
        }
        try {
            // التحقق من وجود بيانات قبل الحفظ (لتجنب الكتابة الفارغة)
            const hasData = inMemoryDB.chats.length > 0 || 
                           Object.keys(inMemoryDB.messages).length > 0 ||
                           inMemoryDB.contacts.length > 0;
            
            if (!hasData) {
                console.log('ℹ️ لا توجد بيانات للحفظ، تخطي');
                return;
            }

            var data = db.export();
            try {
                if ('storage' in navigator && 'getDirectory' in navigator.storage) {
                    var opfsRoot = await navigator.storage.getDirectory();
                    var fileHandle = await opfsRoot.getFileHandle(DB_CONFIG.sqliteFileName, { create: true });
                    var writable = await fileHandle.createWritable();
                    await writable.write(data.buffer);
                    await writable.close();
                } else {
                    await saveToIndexedDB(data.buffer);
                }
            } catch (e) {
                await saveToIndexedDB(data.buffer);
            }
            saveToLocalStorageCache();
        } catch (e) { /* تجاهل */ }
    }

    // ======================================================================
    // إنشاء الجداول (إذا لم تكن موجودة)
    // ======================================================================
    function createTables() {
        if (useFallback || !db) return;
        try {
            db.run(`CREATE TABLE IF NOT EXISTS user (
                id TEXT PRIMARY KEY,
                email TEXT,
                name TEXT,
                avatar TEXT,
                phone TEXT,
                is_guest INTEGER DEFAULT 0,
                last_sync TEXT
            )`);

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

            db.run(`CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                name TEXT,
                registered INTEGER DEFAULT 0,
                invite_code TEXT,
                last_sync TEXT,
                user_id TEXT,
                jid TEXT,
                public_key TEXT
            )`);

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

            db.run(`CREATE TABLE IF NOT EXISTS calls (
                id TEXT PRIMARY KEY,
                name TEXT,
                avatar TEXT,
                time TEXT,
                type TEXT,
                user_id TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS catalog (
                id TEXT PRIMARY KEY,
                name TEXT,
                price TEXT,
                icon TEXT,
                user_id TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);

            persistDatabase();
        } catch (e) {
            console.warn('⚠️ Error creating tables:', e);
            useFallback = true;
        }
    }

    // ======================================================================
    // تحميل البيانات من SQLite إلى الذاكرة المؤقتة (محسنة)
    // ======================================================================
    function loadInMemoryFromSQLite() {
        if (useFallback || !db) return false;
        try {
            // تحميل المستخدم
            var userRows = db.exec("SELECT * FROM user LIMIT 1");
            if (userRows.length && userRows[0].values.length) {
                var u = {};
                userRows[0].columns.forEach(function(c, i) { u[c] = userRows[0].values[0][i]; });
                inMemoryDB.user = u;
            }

            // تحميل المحادثات
            var chatRows = db.exec("SELECT * FROM chats ORDER BY pinned DESC, last_time DESC");
            if (chatRows.length) {
                inMemoryDB.chats = chatRows[0].values.map(function(r) {
                    var c = {};
                    chatRows[0].columns.forEach(function(col, i) { c[col] = r[i]; });
                    if (c.members && typeof c.members === 'string') {
                        try { c.members = JSON.parse(c.members); } catch(e) { 
                            console.warn('⚠️ فشل تحليل members للمحادثة:', c.id);
                            c.members = []; 
                        }
                    } else if (!c.members) {
                        c.members = [];
                    }
                    return c;
                });
                console.log('✅ تم تحميل', inMemoryDB.chats.length, 'محادثة من SQLite');
            }

            // تحميل الرسائل
            inMemoryDB.messages = {};
            var msgRows = db.exec("SELECT * FROM messages ORDER BY time ASC");
            if (msgRows.length) {
                var all = msgRows[0].values.map(function(r) {
                    var m = {};
                    msgRows[0].columns.forEach(function(col, i) { m[col] = r[i]; });
                    return m;
                });
                all.forEach(function(m) {
                    if (!inMemoryDB.messages[m.chat_id]) inMemoryDB.messages[m.chat_id] = [];
                    inMemoryDB.messages[m.chat_id].push(m);
                });
                console.log('✅ تم تحميل', all.length, 'رسالة من SQLite');
            }

            // تحميل جهات الاتصال
            var contactRows = db.exec("SELECT * FROM contacts");
            if (contactRows.length) {
                inMemoryDB.contacts = contactRows[0].values.map(function(r) {
                    var c = {};
                    contactRows[0].columns.forEach(function(col, i) { c[col] = r[i]; });
                    return c;
                });
            }

            // تحميل القصص
            var now = new Date().toISOString();
            var storyRows = db.exec("SELECT * FROM stories WHERE expires_at > datetime('" + now + "') ORDER BY time DESC");
            if (storyRows.length) {
                inMemoryDB.stories = storyRows[0].values.map(function(r) {
                    var s = {};
                    storyRows[0].columns.forEach(function(col, i) { s[col] = r[i]; });
                    return s;
                });
            } else {
                inMemoryDB.stories = [];
            }

            // تحميل القنوات
            var channelRows = db.exec("SELECT * FROM channels");
            if (channelRows.length) {
                inMemoryDB.channels = channelRows[0].values.map(function(r) {
                    var ch = {};
                    channelRows[0].columns.forEach(function(col, i) { ch[col] = r[i]; });
                    if (ch.subscribers && typeof ch.subscribers === 'string') {
                        try { ch.subscribers = JSON.parse(ch.subscribers); } catch(e) { 
                            console.warn('⚠️ فشل تحليل subscribers للقناة:', ch.id);
                            ch.subscribers = []; 
                        }
                    } else if (!ch.subscribers) {
                        ch.subscribers = [];
                    }
                    return ch;
                });
            }

            // تحميل المكالمات
            var callRows = db.exec("SELECT * FROM calls ORDER BY time DESC");
            if (callRows.length) {
                inMemoryDB.calls = callRows[0].values.map(function(r) {
                    var c = {};
                    callRows[0].columns.forEach(function(col, i) { c[col] = r[i]; });
                    return c;
                });
            }

            // تحميل الكتالوج
            var catalogRows = db.exec("SELECT * FROM catalog");
            if (catalogRows.length) {
                inMemoryDB.catalog = catalogRows[0].values.map(function(r) {
                    var c = {};
                    catalogRows[0].columns.forEach(function(col, i) { c[col] = r[i]; });
                    return c;
                });
            }

            // تحميل الإعدادات
            var settingsRows = db.exec("SELECT * FROM settings");
            if (settingsRows.length) {
                settingsRows[0].values.forEach(function(r) {
                    if (r[0] === 'theme') inMemoryDB.settings.theme = r[1];
                    if (r[0] === 'notifications') inMemoryDB.settings.notifications = r[1] === 'true';
                });
            }

            return true;
        } catch (e) {
            console.warn('⚠️ فشل تحميل البيانات من SQLite:', e);
            return false;
        }
    }

    // ======================================================================
    // حفظ جميع البيانات إلى SQLite (محسنة)
    // ======================================================================
    async function persistAllData() {
        if (useFallback || !db) {
            saveToLocalStorageCache();
            return;
        }
        try {
            // التحقق من وجود بيانات قبل الحفظ
            const hasData = inMemoryDB.chats.length > 0 || 
                           Object.keys(inMemoryDB.messages).length > 0 ||
                           inMemoryDB.contacts.length > 0;
            
            if (!hasData) {
                console.log('ℹ️ لا توجد بيانات للحفظ الشامل، تخطي');
                return;
            }

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
            var insMsg = db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            for (var chatId in inMemoryDB.messages) {
                var msgs = inMemoryDB.messages[chatId];
                for (var i = 0; i < msgs.length; i++) {
                    var m = msgs[i];
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
            var insChat = db.prepare("INSERT INTO chats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            for (var j = 0; j < inMemoryDB.chats.length; j++) {
                var c = inMemoryDB.chats[j];
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
            var insCont = db.prepare("INSERT INTO contacts VALUES (?,?,?,?,?,?,?,?,?)");
            for (var k = 0; k < inMemoryDB.contacts.length; k++) {
                var ct = inMemoryDB.contacts[k];
                insCont.run([
                    ct.id,
                    ct.phone,
                    ct.name || '',
                    ct.registered ? 1 : 0,
                    ct.invite_code || null,
                    currentTimestamp(),
                    ct.user_id || null,
                    ct.jid || null,
                    ct.public_key || null
                ]);
            }
            insCont.free();

            // إدراج القصص
            var insStory = db.prepare("INSERT INTO stories VALUES (?,?,?,?,?,?,?,?,?,?,?)");
            var now = new Date().toISOString();
            for (var s = 0; s < inMemoryDB.stories.length; s++) {
                var st = inMemoryDB.stories[s];
                if (st.expires_at && st.expires_at < now) continue;
                insStory.run([
                    st.id,
                    st.user_id || null,
                    st.name || 'مستخدم',
                    st.avatar || '📷',
                    st.type || 'image',
                    st.content || '',
                    st.caption || '',
                    st.time || currentTimestamp(),
                    st.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    st.isViewed ? 1 : 0,
                    st.color || '#ff0050'
                ]);
            }
            insStory.free();

            // إدراج القنوات
            var insCh = db.prepare("INSERT INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?)");
            for (var ch = 0; ch < inMemoryDB.channels.length; ch++) {
                var channel = inMemoryDB.channels[ch];
                insCh.run([
                    channel.id,
                    channel.name,
                    channel.avatar || '📢',
                    channel.description || '',
                    channel.followers || 0,
                    channel.invite_code || '',
                    channel.created_by || null,
                    channel.created_at || currentTimestamp(),
                    channel.update_time || currentTimestamp(),
                    channel.user_id || null,
                    channel.subscribers ? JSON.stringify(channel.subscribers) : '[]'
                ]);
            }
            insCh.free();

            // إدراج المكالمات
            var insCall = db.prepare("INSERT INTO calls VALUES (?,?,?,?,?,?)");
            for (var cl = 0; cl < inMemoryDB.calls.length; cl++) {
                var call = inMemoryDB.calls[cl];
                insCall.run([call.id, call.name, call.avatar, call.time, call.type, call.user_id || null]);
            }
            insCall.free();

            // إدراج الكتالوج
            var insCat = db.prepare("INSERT INTO catalog VALUES (?,?,?,?,?)");
            for (var cat = 0; cat < inMemoryDB.catalog.length; cat++) {
                var item = inMemoryDB.catalog[cat];
                insCat.run([item.id, item.name, item.price || '', item.icon || '📦', item.user_id || null]);
            }
            insCat.free();

            // إدراج الإعدادات
            db.run("DELETE FROM settings");
            db.run("INSERT INTO settings VALUES ('theme',?)", [inMemoryDB.settings.theme]);
            db.run("INSERT INTO settings VALUES ('notifications',?)", [inMemoryDB.settings.notifications ? 'true' : 'false']);

            await persistDatabase();
            saveToLocalStorageCache();
            console.log('✅ تم حفظ جميع البيانات بنجاح');
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
        var chat = inMemoryDB.chats.find(function(c) { return c.id === msg.chat_id; });
        if (chat) {
            chat.last_msg = msg.text || (msg.img ? '📷' : msg.voice_blob ? '🎤' : '📎');
            chat.last_time = msg.time;
            if (msg.sender_id !== 'me' && !chat.online) chat.unread = (chat.unread || 0) + 1;
        }
        // حفظ تلقائي بعد كل رسالة جديدة
        setTimeout(() => persistAllData().catch(() => {}), 500);
    }

    // ======================================================================
    // واجهة API العامة
    // ======================================================================

    // ----- التهيئة (محسنة) -----
    window.initDB = async function() {
        if (initPromise) return initPromise;
        initPromise = (async function() {
            try {
                // محاولة تحميل SQL.js
                try {
                    await loadSqlJs();
                } catch (e) {
                    console.warn('⚠️ SQL.js load failed, using fallback', e);
                    useFallback = true;
                }

                // فتح قاعدة البيانات
                let loadedFromSQLite = false;
                if (!useFallback) {
                    try {
                        await openDatabase();
                    } catch (e) {
                        console.warn('⚠️ Database open failed, using fallback', e);
                        useFallback = true;
                    }
                }

                // إذا كانت قاعدة البيانات جاهزة
                if (!useFallback && db) {
                    try {
                        createTables();
                        loadedFromSQLite = loadInMemoryFromSQLite();
                        if (!loadedFromSQLite) {
                            console.warn('⚠️ فشل تحميل البيانات من SQLite، استخدام LocalStorage');
                            useFallback = true;
                        }
                    } catch (e) {
                        console.warn('⚠️ Table creation or loading failed, using fallback', e);
                        useFallback = true;
                    }
                }

                // إذا فشل SQLite، استخدم LocalStorage كاحتياطي
                if (useFallback || !loadedFromSQLite) {
                    const loadedFromCache = loadFromLocalStorageCache();
                    if (!loadedFromCache) {
                        console.log('ℹ️ لا توجد بيانات في LocalStorage، بدء بقاعدة بيانات فارغة');
                    } else {
                        console.log('✅ تم تحميل البيانات من LocalStorage (الاحتياطي)');
                    }
                    useFallback = true;
                }

                // تحميل المستخدم من localStorage
                var savedUser = localStorage.getItem(DB_CONFIG.userKey);
                if (savedUser) {
                    try { inMemoryDB.user = JSON.parse(savedUser); } catch (e) {}
                }

                console.log('✅ db.js initialized: ' + inMemoryDB.chats.length + ' chats, ' + inMemoryDB.contacts.length + ' contacts');
                dbReady = true;

                // بدء الحفظ التلقائي الدوري
                setInterval(() => {
                    persistAllData().catch(() => {});
                }, DB_CONFIG.SAVE_INTERVAL);

                return true;
            } catch (e) {
                console.error('❌ db.js initialization failed:', e);
                useFallback = true;
                loadFromLocalStorageCache();
                dbReady = true;
                return false;
            }
        })();
        return initPromise;
    };

    // ----- المستخدم -----
    window.getCurrentUser = function() { return inMemoryDB.user; };
    window.setCurrentUser = function(userData) {
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
    };

    // ----- المحادثات -----
    window.getChats = function() { return [...inMemoryDB.chats]; };
    window.getChat = function(chatId) { return inMemoryDB.chats.find(function(c) { return c.id === chatId; }); };
    window.saveChat = function(chatData) {
        var idx = inMemoryDB.chats.findIndex(function(c) { return c.id === chatData.id; });
        if (idx >= 0) {
            inMemoryDB.chats[idx] = { ...inMemoryDB.chats[idx], ...chatData };
        } else {
            inMemoryDB.chats.unshift(chatData);
        }
        if (!useFallback && db) {
            var c = inMemoryDB.chats.find(function(ch) { return ch.id === chatData.id; });
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
    };
    window.deleteChat = function(chatId) {
        inMemoryDB.chats = inMemoryDB.chats.filter(function(c) { return c.id !== chatId; });
        delete inMemoryDB.messages[chatId];
        if (!useFallback && db) {
            db.run("DELETE FROM chats WHERE id=?", [chatId]);
            db.run("DELETE FROM messages WHERE chat_id=?", [chatId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    };

    // ----- الرسائل -----
    window.getMessages = function(chatId) { return inMemoryDB.messages[chatId] || []; };
    window.addMessage = function(msg) {
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
    };
    window.updateMessage = function(msgId, updates) {
        for (var chatId in inMemoryDB.messages) {
            var msgs = inMemoryDB.messages[chatId];
            var idx = msgs.findIndex(function(m) { return m.id === msgId; });
            if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], ...updates };
                if (!useFallback && db) {
                    var m = msgs[idx];
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
    };
    window.deleteMessage = function(msgId) {
        for (var chatId in inMemoryDB.messages) {
            var msgs = inMemoryDB.messages[chatId];
            var idx = msgs.findIndex(function(m) { return m.id === msgId; });
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
    };

    // ----- حفظ جميع البيانات (للتصدير والخروج) -----
    window.saveAllData = function() {
        return persistAllData();
    };

    // ----- جهات الاتصال -----
    window.getContacts = function() { return [...inMemoryDB.contacts]; };
    window.getRegisteredContacts = function() { return inMemoryDB.contacts.filter(function(c) { return c.registered; }); };
    window.getUnregisteredContacts = function() { return inMemoryDB.contacts.filter(function(c) { return !c.registered; }); };
    window.saveContact = function(contactData) {
        var idx = inMemoryDB.contacts.findIndex(function(c) { return c.id === contactData.id; });
        if (idx >= 0) {
            inMemoryDB.contacts[idx] = { ...inMemoryDB.contacts[idx], ...contactData };
        } else {
            inMemoryDB.contacts.push(contactData);
        }
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO contacts VALUES (?,?,?,?,?,?,?,?,?)", [
                contactData.id,
                contactData.phone,
                contactData.name || '',
                contactData.registered ? 1 : 0,
                contactData.invite_code || null,
                currentTimestamp(),
                contactData.user_id || null,
                contactData.jid || null,
                contactData.public_key || null
            ]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    };

    // ----- القصص -----
    window.getStories = function() { return [...inMemoryDB.stories]; };
    window.addStory = function(storyData) {
        storyData.id = storyData.id || generateId();
        storyData.time = storyData.time || currentTimestamp();
        storyData.expires_at = storyData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        storyData.isViewed = storyData.isViewed || false;
        storyData.color = storyData.color || '#' + Math.floor(Math.random() * 16777215).toString(16);
        var now = new Date().toISOString();
        inMemoryDB.stories = inMemoryDB.stories.filter(function(s) { return s.expires_at > now; });
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
    };
    window.updateStory = function(storyId, updates) {
        var idx = inMemoryDB.stories.findIndex(function(s) { return s.id === storyId; });
        if (idx !== -1) {
            inMemoryDB.stories[idx] = { ...inMemoryDB.stories[idx], ...updates };
            if (!useFallback && db) {
                var s = inMemoryDB.stories[idx];
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
    };
    window.deleteStory = function(storyId) {
        inMemoryDB.stories = inMemoryDB.stories.filter(function(s) { return s.id !== storyId; });
        if (!useFallback && db) {
            db.run("DELETE FROM stories WHERE id=?", [storyId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    };

    // ----- القنوات -----
    window.getChannels = function() { return [...inMemoryDB.channels]; };
    window.addChannel = function(channelData) {
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
    };
    window.saveChannel = function(channelData) {
        var idx = inMemoryDB.channels.findIndex(function(c) { return c.id === channelData.id; });
        if (idx >= 0) {
            inMemoryDB.channels[idx] = { ...inMemoryDB.channels[idx], ...channelData };
        } else {
            inMemoryDB.channels.unshift(channelData);
        }
        if (!useFallback && db) {
            var ch = inMemoryDB.channels.find(function(c) { return c.id === channelData.id; });
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
    };
    window.deleteChannel = function(channelId) {
        inMemoryDB.channels = inMemoryDB.channels.filter(function(c) { return c.id !== channelId; });
        if (!useFallback && db) {
            db.run("DELETE FROM channels WHERE id=?", [channelId]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    };

    // ----- المكالمات -----
    window.getCalls = function() { return [...inMemoryDB.calls]; };
    window.addCall = function(callData) {
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
    };

    // ----- الكتالوج -----
    window.getCatalog = function() { return [...inMemoryDB.catalog]; };
    window.addCatalogItem = function(item) {
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
    };

    // ----- الإعدادات -----
    window.getSettings = function() { return { ...inMemoryDB.settings }; };
    window.updateSetting = function(key, value) {
        inMemoryDB.settings[key] = value;
        if (!useFallback && db) {
            db.run("INSERT OR REPLACE INTO settings VALUES (?,?)", [key, String(value)]);
            persistDatabase();
        }
        saveToLocalStorageCache();
    };

    // ----- تصدير/استيراد -----
    window.exportAllData = function() {
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
    };
    window.importAllData = async function(json) {
        try {
            var data = JSON.parse(json);
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
    };

    // ----- تنظيف كامل -----
    window.clearAllData = function() {
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
    };

    // ----- حالة التخزين -----
    window.isUsingFallback = function() { return useFallback; };
    window.isDbReady = function() { return dbReady; };

    // ======================================================================
    // التهيئة التلقائية
    // ======================================================================
    console.log('✅ db.js (الإصدار النهائي v5.1) جاهز');
    console.log('💾 يدعم OPFS + IndexedDB + LocalStorage احتياطي');
    console.log('⏰ حفظ تلقائي كل ' + (DB_CONFIG.SAVE_INTERVAL / 1000) + ' ثانية');

    if (document.readyState === 'complete') {
        setTimeout(function() { window.initDB().catch(function() {}); }, 500);
    } else {
        window.addEventListener('load', function() {
            setTimeout(function() { window.initDB().catch(function() {}); }, 1000);
        });
    }

})();
