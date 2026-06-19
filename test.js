// ==================== test.js - أداة فحص وتشخيص RamzApp ====================
// يُنفذ في Console بعد تحميل التطبيق بالكامل
// يعرض نتائج الفحص بتنسيق ملون ومنظم لتحديد مكان الخلل

(function() {
    const TEST = {
        passed: 0,
        failed: 0,
        skipped: 0,
        results: []
    };

    // ================== أدوات العرض ==================
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

    // ================== دوال مساعدة ==================
    function isOnline() { return navigator.onLine; }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ================== الاختبارات ==================

    // 1. فحص البيئة والمكتبات
    async function testEnvironment() {
        logGroup('1. البيئة والمكتبات');

        // هل المتصفح يدعم الخدمات المطلوبة؟
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
            if (value) {
                logPass(`المتصفح يدعم ${key}`);
            } else {
                logFail(`المتصفح لا يدعم ${key}`);
                allPass = false;
            }
        }

        // فحص تحميل المكتبات
        const libs = {
            'db.js': typeof window.initDB === 'function',
            'supabase.js': typeof window.supabaseClient !== 'undefined',
            'media.js': typeof window.initMedia === 'function',
            'sync.js': typeof window.syncAllPendingMessages === 'function',
            'common.js': typeof window.showScreen === 'function',
        };

        for (const [lib, loaded] of Object.entries(libs)) {
            if (loaded) {
                logPass(`تم تحميل ${lib}`);
            } else {
                logFail(`لم يتم تحميل ${lib}`);
                allPass = false;
            }
        }

        endGroup();
        return allPass;
    }

    // 2. فحص قاعدة البيانات المحلية (db.js)
    async function testDB() {
        logGroup('2. قاعدة البيانات المحلية (db.js)');

        try {
            // التحقق من وجود inMemoryDB
            if (typeof window.inMemoryDB !== 'undefined') {
                logPass('inMemoryDB موجود');
                logData('inMemoryDB.chats', window.inMemoryDB.chats?.length || 0);
                logData('inMemoryDB.messages', Object.keys(window.inMemoryDB.messages || {}).length);
                logData('inMemoryDB.contacts', window.inMemoryDB.contacts?.length || 0);
            } else {
                logFail('inMemoryDB غير موجود');
            }

            // اختبار دوال القراءة
            const functions = [
                'getChats', 'getMessages', 'getContacts', 'getCurrentUser',
                'getSettings', 'getPendingMessages', 'getStories', 'getChannels'
            ];

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

            // اختبار دوال الكتابة
            const writeFuncs = ['saveChat', 'addMessage', 'saveContact', 'updateSetting'];
            for (const fn of writeFuncs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

        } catch (e) {
            logFail('خطأ في فحص db.js', e);
        }

        endGroup();
    }

    // 3. فحص Supabase (الاتصال والدوال)
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

            // اختبار الاتصال
            if (isOnline()) {
                try {
                    const { data, error } = await supabase.from('users').select('count').limit(1);
                    if (error) {
                        logFail('فشل الاتصال بـ Supabase', error);
                    } else {
                        logPass('الاتصال بـ Supabase ناجح');
                    }
                } catch (e) {
                    logFail('استثناء أثناء الاتصال بـ Supabase', e);
                }
            } else {
                logSkip('غير متصل بالإنترنت – تخطي اختبار الاتصال');
            }

            // دوال المصادقة
            const authFuncs = ['signInWithEmail', 'signInWithPhone', 'signInAsGuest', 'signOut'];
            for (const fn of authFuncs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

            // دوال المزامنة
            const syncFuncs = ['subscribeToChat', 'sendMessageRealtime', 'fetchAllPendingMessages', 'checkRegisteredPhones'];
            for (const fn of syncFuncs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

            // دوال جلب البيانات
            const fetchFuncs = ['fetchUserChats', 'fetchMessages', 'fetchContacts', 'fetchAllRegisteredUsers'];
            for (const fn of fetchFuncs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

        } catch (e) {
            logFail('خطأ في فحص Supabase', e);
        }

        endGroup();
    }

    // 4. فحص المزامنة (sync.js)
    async function testSync() {
        logGroup('4. المزامنة (sync.js)');

        try {
            const funcs = [
                'syncAllPendingMessages', 'queueMessageForSync', 'forceSyncNow',
                'retryMessage', 'retryAllFailed', 'getSyncStats'
            ];

            for (const fn of funcs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

            // اختبار getSyncStats
            if (typeof window.getSyncStats === 'function') {
                try {
                    const stats = window.getSyncStats();
                    logPass('getSyncStats يعمل');
                    logData('الإحصائيات', stats);
                } catch (e) {
                    logFail('getSyncStats فشل', e);
                }
            }

            // فحص المزامنة الدورية
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

    // 5. فحص الوسائط (media.js)
    async function testMedia() {
        logGroup('5. الوسائط (media.js)');

        try {
            const funcs = ['initMedia', 'saveMedia', 'getMediaUrl', 'deleteMedia', 'listMediaFiles'];
            for (const fn of funcs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

            if (typeof window.isMediaReady === 'function') {
                const ready = window.isMediaReady();
                logPass(`isMediaReady() = ${ready}`);
                if (ready) {
                    logInfo(`نوع التخزين: ${window.isUsingFallback?.() ? 'IndexedDB (احتياطي)' : 'نظام الملفات'}`);
                }
            } else {
                logFail('isMediaReady غير موجود');
            }

        } catch (e) {
            logFail('خطأ في فحص media.js', e);
        }

        endGroup();
    }

    // 6. فحص المستخدم الحالي
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

            // فحص localStorage
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

    // 7. فحص التوجيه (Routing) وحالة الصفحات
    async function testRouting() {
        logGroup('7. التوجيه وحالة الصفحات');

        try {
            // فحص وجود الشاشات
            const screens = ['chatsScreen', 'chatScreen', 'contactsScreen', 'callsScreen', 'updatesScreen', 'toolsScreen', 'profileScreen', 'settingsScreen'];
            let allExist = true;
            for (const id of screens) {
                const el = document.getElementById(id);
                if (el) {
                    logPass(`العنصر #${id} موجود`);
                } else {
                    logFail(`العنصر #${id} غير موجود`);
                    allExist = false;
                }
            }

            // فحص showScreen
            if (typeof window.showScreen === 'function') {
                logPass('showScreen موجود');
                // معرفة الشاشة الحالية
                if (typeof currentScreen !== 'undefined') {
                    logData('الشاشة الحالية', currentScreen);
                }
            } else {
                logFail('showScreen غير موجود');
            }

            // فحص bottomNav
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

    // 8. فحص الأحداث والاشتراكات
    async function testEvents() {
        logGroup('8. الأحداث والاشتراكات');

        try {
            // فحص مستمعي أحداث الشبكة
            const hasOnlineListener = typeof window._onlineListener !== 'undefined';
            const hasOfflineListener = typeof window._offlineListener !== 'undefined';
            if (hasOnlineListener || hasOfflineListener) {
                logPass('مستمعي أحداث الشبكة موجودون');
            } else {
                logWarn('مستمعي أحداث الشبكة غير موجودين (قد تكون مُضافة في common.js)');
            }

            // فحص الاشتراك في المحادثة
            if (typeof window.subscribeToChat === 'function') {
                logPass('subscribeToChat موجود');
                if (typeof currentChatId !== 'undefined' && currentChatId) {
                    logInfo(`المحادثة الحالية: ${currentChatId}`);
                }
            } else {
                logFail('subscribeToChat غير موجود');
            }

            // فحص sendTypingEvent
            if (typeof window.sendTypingEvent === 'function') {
                logPass('sendTypingEvent موجود');
            } else {
                logWarn('sendTypingEvent غير موجود (قد لا يكون ضرورياً)');
            }

        } catch (e) {
            logFail('خطأ في فحص الأحداث', e);
        }

        endGroup();
    }

    // 9. فحص التشفير (E2E)
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

            // التحقق من وجود دوال التشفير
            const cryptoFuncs = ['generateKeyPair', 'encryptMessage', 'decryptMessage', 'initEncryption'];
            for (const fn of cryptoFuncs) {
                if (typeof window[fn] === 'function') {
                    logPass(`window.${fn} موجود`);
                } else {
                    logFail(`window.${fn} غير موجود`);
                }
            }

            // فحص المفتاح الحالي
            if (typeof currentUserKeyPair !== 'undefined') {
                if (currentUserKeyPair) {
                    logPass('مفتاح المستخدم الحالي موجود');
                } else {
                    logWarn('مفتاح المستخدم الحالي غير موجود (قد يُنشأ عند التهيئة)');
                }
            }

        } catch (e) {
            logFail('خطأ في فحص التشفير', e);
        }

        endGroup();
    }

    // 10. فحص المزامنة الفورية (Realtime)
    async function testRealtime() {
        logGroup('10. المزامنة الفورية (Realtime)');

        try {
            const supabase = window.supabaseClient;
            if (!supabase) {
                logFail('supabaseClient غير موجود');
                endGroup();
                return;
            }

            // فحص وجود قنوات نشطة
            if (typeof window.activeChannels !== 'undefined') {
                const channels = window.activeChannels || {};
                const count = Object.keys(channels).length;
                logPass(`عدد القنوات النشطة: ${count}`);
                if (count > 0) {
                    logData('القنوات النشطة', Object.keys(channels));
                }
            } else {
                logWarn('activeChannels غير معرف (قد يكون مُعرّفاً في supabase.js)');
            }

            // فحص إرسال رسالة
            if (typeof window.sendMessageRealtime === 'function') {
                logPass('sendMessageRealtime موجود');
            } else {
                logFail('sendMessageRealtime غير موجود');
            }

        } catch (e) {
            logFail('خطأ في فحص Realtime', e);
        }

        endGroup();
    }

    // ================== تشغيل جميع الاختبارات ==================
    async function runAllTests() {
        console.clear();
        console.log('%c🧪  بدء فحص شامل لتطبيق RamzApp  🧪', 'font-size: 20px; font-weight: bold; color: #4fc3f7;');
        console.log(`%c📅 ${new Date().toLocaleString()}`, 'color: #90a4ae;');
        console.log(`%c📡 حالة الإنترنت: ${isOnline() ? '🟢 متصل' : '🔴 غير متصل'}`, 'color: #90a4ae;');
        console.log('═══════════════════════════════════════════════════');

        const startTime = performance.now();

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

        // عرض ملخص للمشاكل الشائعة
        console.log('%c💡  تلميحات:', 'font-weight: bold;');
        console.log('   - إذا فشل اتصال Supabase، تأكد من المفاتيح والإنترنت.');
        console.log('   - إذا فشلت دوال التخزين، تأكد من تحميل db.js بشكل صحيح.');
        console.log('   - إذا لم يظهر المستخدم، سجل الدخول أولاً.');
        console.log('   - إذا كانت هناك مشكلة في التوجيه، تحقق من common.js و login.html.');
    }

    // ================== تنفيذ الفحص ==================
    // ننتظر قليلاً للتأكد من تحميل كل شيء
    setTimeout(() => {
        runAllTests().catch(e => {
            console.error('❌ خطأ أثناء تشغيل الاختبارات:', e);
        });
    }, 500);
})();
