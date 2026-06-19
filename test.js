// test.js - أداة الفحص الشامل النهائية لـ RamzApp v4.0
// تنتظر اكتمال تهيئة التطبيق، ثم تفحص جميع المكونات وتعرض تقريراً مفصلاً.

(function() {
    // ================== المتغيرات العامة ==================
    const TEST = {
        passed: 0,
        failed: 0,
        skipped: 0,
        results: []
    };

    let isWaiting = true;
    let waitInterval = null;
    let waitAttempts = 0;
    const MAX_WAIT_ATTEMPTS = 30; // 15 ثانية كحد أقصى

    // ================== دوال العرض ==================
    function logGroup(title, color = '#4fc3f7') {
        console.group(`%c🧪 ${title}`, `color: ${color}; font-weight: bold; font-size: 14px;`);
    }

    function logPass(message) {
        TEST.passed++;
        console.log(`%c✅ PASS: ${message}`, 'color: #4caf50;');
    }

    function logFail(message, error = '') {
        TEST.failed++;
        console.log(`%c❌ FAIL: ${message}`, 'color: #ff5252;');
        if (error) console.error('   ↳', error);
    }

    function logSkip(message) {
        TEST.skipped++;
        console.log(`%c⏭️ SKIP: ${message}`, 'color: #ffa726;');
    }

    function logInfo(message) {
        console.log(`%cℹ️ ${message}`, 'color: #90a4ae;');
    }

    function logWarn(message) {
        console.log(`%c⚠️ ${message}`, 'color: #ffa726;');
    }

    function logData(label, data) {
        console.log(`   📌 ${label}:`, data);
    }

    function endGroup() {
        console.groupEnd();
    }

    function isOnline() {
        return navigator.onLine;
    }

    // ================== انتظار تهيئة التطبيق ==================
    function waitForAppReady() {
        return new Promise((resolve) => {
            console.log('⏳ انتظار تهيئة التطبيق...');

            const check = () => {
                waitAttempts++;
                const isAppReady = typeof appReady !== 'undefined' && appReady === true;
                const hasUser = localStorage.getItem('ramzapp_user') !== null;
                const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
                const hasInMemory = typeof window.inMemoryDB !== 'undefined' && window.inMemoryDB !== null;

                if (isAppReady && hasUser && hasSupabase && hasInMemory) {
                    console.log('✅ التطبيق جاهز (appReady = true)');
                    clearInterval(waitInterval);
                    resolve(true);
                } else if (waitAttempts >= MAX_WAIT_ATTEMPTS) {
                    console.warn(`⚠️ انتهى وقت الانتظار (${MAX_WAIT_ATTEMPTS} محاولة)`);
                    console.warn(`   - appReady: ${isAppReady}`);
                    console.warn(`   - hasUser: ${hasUser}`);
                    console.warn(`   - hasSupabase: ${hasSupabase}`);
                    console.warn(`   - hasInMemory: ${hasInMemory}`);
                    clearInterval(waitInterval);
                    resolve(false);
                } else {
                    // عرض تقدم الانتظار كل 5 محاولات
                    if (waitAttempts % 5 === 0) {
                        console.log(`⏳ جاري الانتظار... (${waitAttempts}/${MAX_WAIT_ATTEMPTS})`);
                    }
                }
            };

            waitInterval = setInterval(check, 500);
            check(); // فحص فوري
        });
    }

    // ================== دالة تشغيل الفحص ==================
    async function runAllTests() {
        console.clear();
        console.log('%c🧪  فحص شامل لتطبيق RamzApp v4.0  🧪', 'font-size: 20px; font-weight: bold; color: #4fc3f7;');
        console.log(`%c📅 ${new Date().toLocaleString()}`, 'color: #90a4ae;');
        console.log(`%c📡 حالة الإنترنت: ${isOnline() ? '🟢 متصل' : '🔴 غير متصل'}`, 'color: #90a4ae;');
        console.log('═══════════════════════════════════════════════════');

        // انتظار التهيئة
        const ready = await waitForAppReady();
        if (!ready) {
            console.warn('⚠️ التطبيق لم يكتمل تهيئته، قد تظهر نتائج غير دقيقة');
        }

        const startTime = performance.now();

        // تنفيذ الاختبارات
        await testEnvironment();
        await testDB();
        await testSupabase();
        await testSync();
        await testMedia();
        await testUser();
        await testRouting();
        await testEvents();
        await testEncryption();
        await testRealtime();
        await testStories();

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('═══════════════════════════════════════════════════');
        console.log(`%c📊  نتائج الفحص:`, 'font-size: 16px; font-weight: bold;');
        console.log(`   ✅ نجح: ${TEST.passed}`);
        console.log(`   ❌ فشل: ${TEST.failed}`);
        console.log(`   ⏭️ تم تخطي: ${TEST.skipped}`);
        console.log(`   ⏱️ الزمن: ${duration} ثانية`);

        if (TEST.failed === 0) {
            console.log(`%c🎉  جميع الاختبارات نجحت! التطبيق يعمل بشكل صحيح.`, 'color: #4caf50; font-size: 16px; font-weight: bold;');
        } else {
            console.log(`%c⚠️  يوجد ${TEST.failed} اختبار فاشل. راجع التفاصيل أعلاه.`, 'color: #ff5252; font-size: 16px; font-weight: bold;');
        }

        console.log('%c💡  تلميحات:', 'font-weight: bold;');
        console.log('   - إذا فشل اتصال Supabase، تأكد من المفاتيح والإنترنت.');
        console.log('   - إذا فشلت دوال التخزين، تأكد من تحميل db.js بشكل صحيح.');
        console.log('   - إذا لم يظهر المستخدم، سجل الدخول أولاً.');
        console.log('   - إذا كانت هناك مشكلة في التوجيه، تحقق من common.js و login.html.');
        console.log('   - ميزة القصص (Stories) تتطلب وجود جدول stories في Supabase.');
    }

    // ================== الاختبارات ==================

    // 1. البيئة والمكتبات
    async function testEnvironment() {
        logGroup('1. البيئة والمكتبات');
        const checks = {
            'localStorage': !!window.localStorage,
            'indexedDB': !!window.indexedDB,
            'crypto.subtle': !!(window.crypto && window.crypto.subtle),
            'navigator.onLine': typeof navigator.onLine === 'boolean',
            'FileReader': !!window.FileReader,
            'MediaRecorder': !!window.MediaRecorder,
            'AudioContext': !!(window.AudioContext || window.webkitAudioContext),
            'fetch': !!window.fetch,
            'WebSocket': !!window.WebSocket,
        };
        let allPass = true;
        for (const [key, value] of Object.entries(checks)) {
            if (value) logPass(`المتصفح يدعم ${key}`);
            else { logFail(`المتصفح لا يدعم ${key}`); allPass = false; }
        }

        // فحص المكتبات
        const libs = {
            'db.js': typeof window.initDB === 'function',
            'supabase.js': typeof window.supabaseClient !== 'undefined',
            'media.js': typeof window.initMedia === 'function',
            'sync.js': typeof window.syncAllPendingMessages === 'function',
            'common.js': typeof window.showScreen === 'function',
        };
        for (const [lib, loaded] of Object.entries(libs)) {
            if (loaded) logPass(`تم تحميل ${lib}`);
            else { logFail(`لم يتم تحميل ${lib}`); allPass = false; }
        }
        endGroup();
        return allPass;
    }

    // 2. قاعدة البيانات المحلية
    async function testDB() {
        logGroup('2. قاعدة البيانات المحلية (db.js)');
        try {
            if (typeof window.inMemoryDB !== 'undefined') {
                logPass('inMemoryDB موجود');
                logData('inMemoryDB.chats', window.inMemoryDB.chats?.length || 0);
                logData('inMemoryDB.messages', Object.keys(window.inMemoryDB.messages || {}).length);
                logData('inMemoryDB.contacts', window.inMemoryDB.contacts?.length || 0);
                logData('inMemoryDB.stories', window.inMemoryDB.stories?.length || 0);
            } else {
                logFail('inMemoryDB غير موجود');
            }

            const functions = ['getChats', 'getMessages', 'getContacts', 'getCurrentUser', 'getSettings',
                'getPendingMessages', 'getStories', 'getChannels', 'getCatalog'];
            for (const fn of functions) {
                if (typeof window[fn] === 'function') {
                    try {
                        const result = window[fn]();
                        logPass(`window.${fn}() يعمل`);
                    } catch (e) {
                        logFail(`window.${fn}() فشل`, e);
                    }
                } else {
                    logFail(`window.${fn} غير معرف`);
                }
            }

            const writeFuncs = ['saveChat', 'addMessage', 'saveContact', 'updateSetting', 'addStory', 'updateStory', 'deleteStory'];
            for (const fn of writeFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }
        } catch (e) {
            logFail('خطأ في فحص db.js', e);
        }
        endGroup();
    }

    // 3. Supabase
    async function testSupabase() {
        logGroup('3. Supabase');
        try {
            const supabase = window.supabaseClient;
            if (!supabase) {
                logFail('supabaseClient غير معرف');
                endGroup();
                return;
            }
            logPass('supabaseClient موجود');

            if (isOnline()) {
                try {
                    const { data, error } = await supabase.from('users').select('count').limit(1);
                    if (error) logFail('فشل الاتصال بـ Supabase', error);
                    else logPass('الاتصال بـ Supabase ناجح');
                } catch (e) {
                    logFail('استثناء أثناء الاتصال بـ Supabase', e);
                }
            } else {
                logSkip('غير متصل بالإنترنت – تخطي اختبار الاتصال');
            }

            const authFuncs = ['signInWithEmail', 'signUpWithEmail', 'signInWithPhone', 'signInAsGuest', 'signOut'];
            for (const fn of authFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            const syncFuncs = ['subscribeToChat', 'unsubscribeFromChat', 'sendMessageRealtime', 'fetchAllPendingMessages', 'checkRegisteredPhones'];
            for (const fn of syncFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            const fetchFuncs = ['fetchUserChats', 'fetchMessages', 'fetchContacts', 'fetchAllRegisteredUsers', 'fetchStories'];
            for (const fn of fetchFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // دوال القصص في Supabase
            const storyFuncs = ['addStoryToSupabase', 'deleteStoryFromSupabase', 'syncStories'];
            for (const fn of storyFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }
        } catch (e) {
            logFail('خطأ في فحص Supabase', e);
        }
        endGroup();
    }

    // 4. المزامنة
    async function testSync() {
        logGroup('4. المزامنة (sync.js)');
        try {
            const funcs = ['syncAllPendingMessages', 'queueMessageForSync', 'forceSyncNow',
                'retryMessage', 'retryAllFailed', 'getSyncStats'
            ];
            for (const fn of funcs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            if (typeof window.getSyncStats === 'function') {
                try {
                    const stats = window.getSyncStats();
                    logPass('getSyncStats يعمل');
                    logData('الإحصائيات', stats);
                } catch (e) {
                    logFail('getSyncStats فشل', e);
                }
            }

            if (window._syncInterval || window.periodicSyncInterval) {
                logPass('المزامنة الدورية مفعلة');
            } else {
                logWarn('المزامنة الدورية غير مفعلة (قد تكون بدأت بعد فترة)');
            }
        } catch (e) {
            logFail('خطأ في فحص sync.js', e);
        }
        endGroup();
    }

    // 5. الوسائط
    async function testMedia() {
        logGroup('5. الوسائط (media.js)');
        try {
            const funcs = ['initMedia', 'saveMedia', 'getMediaUrl', 'getMediaBlob', 'getMediaFile', 'deleteMedia', 'listMediaFiles'];
            for (const fn of funcs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            if (typeof window.isMediaReady === 'function') {
                const ready = window.isMediaReady();
                logPass(`isMediaReady() = ${ready}`);
                if (ready) {
                    const fallback = window.isUsingFallback ? window.isUsingFallback() : false;
                    logInfo(`نوع التخزين: ${fallback ? 'IndexedDB (احتياطي)' : 'نظام الملفات'}`);
                }
            } else {
                logFail('isMediaReady غير موجود');
            }
        } catch (e) {
            logFail('خطأ في فحص media.js', e);
        }
        endGroup();
    }

    // 6. المستخدم الحالي
    async function testUser() {
        logGroup('6. المستخدم الحالي');
        try {
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            if (user) {
                logPass('المستخدم موجود');
                logData('المستخدم', {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar
                });
            } else {
                logFail('لا يوجد مستخدم مسجل');
                logInfo('تأكد من تسجيل الدخول أولاً');
            }

            const raw = localStorage.getItem('ramzapp_user');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    logPass('بيانات المستخدم في localStorage صالحة');
                } catch (e) {
                    logFail('بيانات المستخدم في localStorage فاسدة', e);
                }
            } else {
                logWarn('لا توجد بيانات مستخدم في localStorage');
            }
        } catch (e) {
            logFail('خطأ في فحص المستخدم', e);
        }
        endGroup();
    }

    // 7. التوجيه
    async function testRouting() {
        logGroup('7. التوجيه وحالة الصفحات');
        try {
            const screens = ['chatsScreen', 'chatScreen', 'contactsScreen', 'callsScreen',
                'updatesScreen', 'toolsScreen', 'profileScreen', 'settingsScreen'
            ];
            let allExist = true;
            for (const id of screens) {
                const el = document.getElementById(id);
                if (el) logPass(`العنصر #${id} موجود`);
                else { logFail(`العنصر #${id} غير موجود`);
                    allExist = false; }
            }

            if (typeof window.showScreen === 'function') {
                logPass('showScreen موجود');
                if (typeof currentScreen !== 'undefined') logData('الشاشة الحالية', currentScreen);
            } else {
                logFail('showScreen غير موجود');
            }

            const nav = document.getElementById('bottomNav');
            if (nav) {
                logPass('bottomNav موجود');
                const visible = window.getComputedStyle(nav).display !== 'none';
                logData('bottomNav visible', visible);
            } else {
                logFail('bottomNav غير موجود');
            }
        } catch (e) {
            logFail('خطأ في فحص التوجيه', e);
        }
        endGroup();
    }

    // 8. الأحداث
    async function testEvents() {
        logGroup('8. الأحداث والاشتراكات');
        try {
            // مستمعي أحداث الشبكة
            if (typeof window._onlineListener !== 'undefined' || typeof window._offlineListener !== 'undefined') {
                logPass('مستمعي أحداث الشبكة موجودون');
            } else {
                logWarn('مستمعي أحداث الشبكة غير موجودين (قد تكون مُضافة في common.js)');
            }

            // subscribeToChat
            if (typeof window.subscribeToChat === 'function') {
                logPass('subscribeToChat موجود');
                if (typeof currentChatId !== 'undefined' && currentChatId) {
                    logInfo(`المحادثة الحالية: ${currentChatId}`);
                }
            } else {
                logFail('subscribeToChat غير موجود');
            }

            // sendTypingEvent
            if (typeof window.sendTypingEvent === 'function') {
                logPass('sendTypingEvent موجود');
            } else {
                logWarn('sendTypingEvent غير موجود (قد لا يكون ضرورياً)');
            }

            // markMessagesAsRead
            if (typeof window.markMessagesAsRead === 'function') {
                logPass('markMessagesAsRead موجود');
            } else {
                logWarn('markMessagesAsRead غير موجود');
            }
        } catch (e) {
            logFail('خطأ في فحص الأحداث', e);
        }
        endGroup();
    }

    // 9. التشفير
    async function testEncryption() {
        logGroup('9. التشفير من طرف إلى طرف (E2E)');
        try {
            const hasCrypto = !!(window.crypto && window.crypto.subtle);
            if (!hasCrypto) {
                logFail('crypto.subtle غير مدعوم');
                endGroup();
                return;
            }
            logPass('crypto.subtle مدعوم');

            const cryptoFuncs = ['generateKeyPair', 'encryptMessage', 'decryptMessage', 'initEncryption'];
            for (const fn of cryptoFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            if (typeof currentUserKeyPair !== 'undefined') {
                if (currentUserKeyPair) logPass('مفتاح المستخدم الحالي موجود');
                else logWarn('مفتاح المستخدم الحالي غير موجود (قد يُنشأ عند التهيئة)');
            }
        } catch (e) {
            logFail('خطأ في فحص التشفير', e);
        }
        endGroup();
    }

    // 10. المزامنة الفورية
    async function testRealtime() {
        logGroup('10. المزامنة الفورية (Realtime)');
        try {
            const supabase = window.supabaseClient;
            if (!supabase) {
                logFail('supabaseClient غير موجود');
                endGroup();
                return;
            }

            if (typeof window.activeChannels !== 'undefined') {
                const channels = window.activeChannels || {};
                const count = Object.keys(channels).length;
                logPass(`عدد القنوات النشطة: ${count}`);
                if (count > 0) logData('القنوات النشطة', Object.keys(channels));
            } else {
                logWarn('activeChannels غير معرف (قد يكون مُعرّفاً في supabase.js)');
            }

            if (typeof window.sendMessageRealtime === 'function') {
                logPass('sendMessageRealtime موجود');
            } else {
                logFail('sendMessageRealtime غير موجود');
            }

            // التحقق من وجود pending_messages
            if (isOnline() && supabase) {
                try {
                    const { data, error } = await supabase
                        .from('pending_messages')
                        .select('count')
                        .limit(1);
                    if (!error) logPass('جدول pending_messages موجود');
                    else logFail('جدول pending_messages غير موجود أو لا يمكن الوصول إليه', error);
                } catch (e) {
                    logWarn('تعذر التحقق من جدول pending_messages', e);
                }
            }
        } catch (e) {
            logFail('خطأ في فحص Realtime', e);
        }
        endGroup();
    }

    // 11. القصص (Stories)
    async function testStories() {
        logGroup('11. القصص (Stories)');
        try {
            // دوال القصص في common.js
            const storyFuncs = ['renderStories', 'openStoryCamera', 'saveStory', 'openStoryViewer', 'closeStoryViewer'];
            for (const fn of storyFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // التحقق من وجود عناصر القصص في DOM
            const storyBar = document.getElementById('storyBar');
            if (storyBar) logPass('عنصر storyBar موجود');
            else logFail('عنصر storyBar غير موجود');

            const addStoryBtn = document.getElementById('addStoryBtn');
            if (addStoryBtn) logPass('زر إضافة قصة موجود');
            else logFail('زر إضافة قصة غير موجود');

            const addTextStoryBtn = document.getElementById('addTextStoryBtn');
            if (addTextStoryBtn) logPass('زر قصة نصية موجود');
            else logFail('زر قصة نصية غير موجود');

            // فحص القصص المحلية
            if (typeof window.getStories === 'function') {
                try {
                    const stories = window.getStories();
                    logPass(`getStories() يعمل، عدد القصص: ${stories?.length || 0}`);
                    if (stories && stories.length > 0) {
                        logData('أحدث قصة', stories[0]);
                    }
                } catch (e) {
                    logFail('getStories() فشل', e);
                }
            }

            // فحص مزامنة القصص
            if (typeof window.syncStories === 'function') {
                if (isOnline()) {
                    try {
                        await window.syncStories();
                        logPass('syncStories() يعمل');
                    } catch (e) {
                        logFail('syncStories() فشل', e);
                    }
                } else {
                    logSkip('غير متصل بالإنترنت – تخطي اختبار syncStories');
                }
            } else {
                logFail('syncStories غير موجود');
            }
        } catch (e) {
            logFail('خطأ في فحص القصص', e);
        }
        endGroup();
    }

    // ================== جعل الدوال عامة ==================
    window.runAllTests = runAllTests;

    // ================== التنفيذ التلقائي ==================
    // الانتظار قليلاً ثم تشغيل الفحص
    setTimeout(() => {
        runAllTests().catch(e => {
            console.error('❌ خطأ أثناء تشغيل الاختبارات:', e);
        });
    }, 1500);

    console.log('✅ test.js (النسخة النهائية) جاهز - سيبدأ الفحص تلقائياً بعد التهيئة');
    console.log('💡 لإعادة التشغيل يدوياً: runAllTests()');
})();
