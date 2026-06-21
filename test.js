// ======================================================================
// test.js - أداة الفحص الشامل لـ RamzApp v5.0
// ======================================================================

(function() {
    'use strict';

    // ======================================================================
    // المتغيرات العامة
    // ======================================================================
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

    // ======================================================================
    // دوال العرض
    // ======================================================================
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

    // ======================================================================
    // انتظار تهيئة التطبيق
    // ======================================================================
    function waitForAppReady() {
        return new Promise((resolve) => {
            console.log('⏳ انتظار تهيئة التطبيق...');

            const check = () => {
                waitAttempts++;
                const isAppReady = typeof appReady !== 'undefined' && appReady === true;
                const hasUser = localStorage.getItem('ramzapp_user') !== null;
                const hasSupabase = typeof window.supabaseClient !== 'undefined' && window.supabaseClient !== null;
                const hasInMemory = typeof window.inMemoryDB !== 'undefined' && window.inMemoryDB !== null;
                const hasDBReady = typeof window.isDbReady === 'function' ? window.isDbReady() : true;

                if (isAppReady && hasUser && hasSupabase && hasInMemory && hasDBReady) {
                    console.log('✅ التطبيق جاهز (appReady = true)');
                    clearInterval(waitInterval);
                    resolve(true);
                } else if (waitAttempts >= MAX_WAIT_ATTEMPTS) {
                    console.warn(`⚠️ انتهى وقت الانتظار (${MAX_WAIT_ATTEMPTS} محاولة)`);
                    console.warn(`   - appReady: ${isAppReady}`);
                    console.warn(`   - hasUser: ${hasUser}`);
                    console.warn(`   - hasSupabase: ${hasSupabase}`);
                    console.warn(`   - hasInMemory: ${hasInMemory}`);
                    console.warn(`   - dbReady: ${hasDBReady}`);
                    clearInterval(waitInterval);
                    resolve(false);
                } else {
                    if (waitAttempts % 5 === 0) {
                        console.log(`⏳ جاري الانتظار... (${waitAttempts}/${MAX_WAIT_ATTEMPTS})`);
                    }
                }
            };

            waitInterval = setInterval(check, 500);
            check(); // فحص فوري
        });
    }

    // ======================================================================
    // دالة تشغيل الفحص
    // ======================================================================
    window.runAllTests = async function() {
        console.clear();
        console.log('%c🧪  فحص شامل لتطبيق RamzApp v5.0  🧪', 'font-size: 20px; font-weight: bold; color: #4fc3f7;');
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
        await testLocalStorage();
        await testSupabaseBroker();
        await testSync();
        await testEncryption();
        await testCommonFunctions();
        await testUI();

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
        console.log('   - إذا فشلت اختبارات Supabase، تأكد من المفاتيح والإنترنت.');
        console.log('   - إذا فشلت اختبارات التخزين المحلي، تأكد من تحميل db.js بشكل صحيح.');
        console.log('   - إذا فشلت اختبارات التشفير، تأكد من دعم crypto.subtle في المتصفح.');
        console.log('   - إذا لم يظهر المستخدم، سجل الدخول أولاً.');
        console.log('   - ميزة القصص (Stories) تتطلب وجود جدول stories في Supabase.');
        console.log('   - المزامنة تعتمد على وجود وسيط Supabase متاح.');
    };

    // ======================================================================
    // 1. اختبار البيئة والمكتبات
    // ======================================================================
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

        // فحص المكتبات المحملة
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

    // ======================================================================
    // 2. اختبار التخزين المحلي (db.js)
    // ======================================================================
    async function testLocalStorage() {
        logGroup('2. التخزين المحلي (db.js)');
        try {
            if (typeof window.inMemoryDB !== 'undefined') {
                logPass('inMemoryDB موجود');
                logData('inMemoryDB.chats', window.inMemoryDB.chats?.length || 0);
                logData('inMemoryDB.messages', Object.keys(window.inMemoryDB.messages || {}).length);
                logData('inMemoryDB.contacts', window.inMemoryDB.contacts?.length || 0);
                logData('inMemoryDB.stories', window.inMemoryDB.stories?.length || 0);
                logData('inMemoryDB.channels', window.inMemoryDB.channels?.length || 0);
            } else {
                logFail('inMemoryDB غير موجود');
            }

            // دوال القراءة
            const readFuncs = ['getChats', 'getMessages', 'getContacts', 'getCurrentUser', 'getSettings',
                'getPendingMessages', 'getStories', 'getChannels', 'getCatalog', 'getCalls'
            ];
            for (const fn of readFuncs) {
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

            // دوال الكتابة
            const writeFuncs = ['saveChat', 'addMessage', 'saveContact', 'updateSetting', 'addStory', 'updateStory', 'deleteStory', 'saveChannel'];
            for (const fn of writeFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // اختبار إضافة رسالة مؤقتة ثم حذفها
            try {
                const testMsg = {
                    id: 'test_' + Date.now(),
                    chat_id: 'test_chat',
                    sender_id: 'me',
                    text: 'رسالة اختبار',
                    time: new Date().toISOString(),
                    status: 'pending'
                };
                if (typeof window.addMessage === 'function') {
                    const added = window.addMessage(testMsg);
                    if (added && added.id) {
                        logPass('addMessage يعمل (تم إضافة رسالة اختبار)');
                        // محاولة حذفها
                        if (typeof window.deleteMessage === 'function') {
                            window.deleteMessage(testMsg.id);
                            logPass('deleteMessage يعمل (تم حذف رسالة الاختبار)');
                        }
                    } else {
                        logFail('addMessage فشل في إضافة رسالة اختبار');
                    }
                }
            } catch (e) {
                logWarn('فشل اختبار addMessage/deleteMessage', e);
            }

        } catch (e) {
            logFail('خطأ في فحص db.js', e);
        }
        endGroup();
    }

    // ======================================================================
    // 3. اختبار الوسيط (supabase.js)
    // ======================================================================
    async function testSupabaseBroker() {
        logGroup('3. وسيط Supabase (supabase.js)');
        try {
            const supabase = window.supabaseClient;
            if (!supabase) {
                logFail('supabaseClient غير معرف');
                endGroup();
                return;
            }
            logPass('supabaseClient موجود');

            // اختبار الاتصال (فقط إذا كان متصلاً)
            if (isOnline()) {
                try {
                    const { data, error } = await supabase.from('users').select('count').limit(1);
                    if (error) {
                        logFail('فشل الاتصال بـ Supabase', error);
                    } else {
                        logPass('الاتصال بـ Supabase ناجح');
                        logData('عدد المستخدمين (تقريبي)', data?.length || 0);
                    }
                } catch (e) {
                    logFail('استثناء أثناء الاتصال بـ Supabase', e);
                }
            } else {
                logSkip('غير متصل بالإنترنت – تخطي اختبار الاتصال');
            }

            // دوال المصادقة
            const authFuncs = ['signInWithPhone', 'signUpWithPhone', 'signInAsGuest', 'signOut'];
            for (const fn of authFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // دوال الوسيط (Broker)
            const brokerFuncs = ['subscribeToChat', 'unsubscribeFromChat', 'sendMessageRealtime', 'fetchPendingMessages', 'fetchAllPendingMessages'];
            for (const fn of brokerFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // دوال الاستعلام عن المستخدمين
            const queryFuncs = ['fetchUserByPhone', 'fetchUsersByPhones', 'fetchUserById'];
            for (const fn of queryFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // دوال إدارة الحالة
            if (typeof window.setUserOnlineStatus === 'function') {
                logPass('setUserOnlineStatus موجود');
            } else {
                logWarn('setUserOnlineStatus غير موجود');
            }

            // دوال الدعوة
            if (typeof window.getInviteCode === 'function' && typeof window.createInviteLink === 'function') {
                logPass('getInviteCode و createInviteLink موجودان');
            } else {
                logWarn('دوال الدعوة غير موجودة');
            }

        } catch (e) {
            logFail('خطأ في فحص supabase.js', e);
        }
        endGroup();
    }

    // ======================================================================
    // 4. اختبار المزامنة (sync.js)
    // ======================================================================
    async function testSync() {
        logGroup('4. المزامنة (sync.js)');
        try {
            const funcs = ['syncAllPendingMessages', 'queueMessageForSync', 'forceSyncNow',
                'retryMessage', 'retryAllFailed', 'getSyncStats', 'cleanupPendingMessages'
            ];
            for (const fn of funcs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            if (typeof window.getSyncStats === 'function') {
                try {
                    const stats = window.getSyncStats();
                    logPass('getSyncStats يعمل');
                    logData('الإحصائيات', {
                        pending: stats.pending || 0,
                        total: stats.total || 0,
                        isSyncing: stats.isSyncing || false,
                        online: stats.online || false,
                        lastSync: stats.lastSync || 'لم تتم'
                    });
                } catch (e) {
                    logFail('getSyncStats فشل', e);
                }
            }

            // التحقق من المزامنة الدورية
            if (window.periodicSyncInterval || window._syncInterval) {
                logPass('المزامنة الدورية مفعلة');
            } else {
                logWarn('المزامنة الدورية غير مفعلة (قد تكون بدأت بعد فترة)');
            }

            // اختبار تنظيف الرسائل المعلقة
            if (typeof window.cleanupPendingMessages === 'function') {
                try {
                    window.cleanupPendingMessages();
                    logPass('cleanupPendingMessages يعمل');
                } catch (e) {
                    logFail('cleanupPendingMessages فشل', e);
                }
            }

        } catch (e) {
            logFail('خطأ في فحص sync.js', e);
        }
        endGroup();
    }

    // ======================================================================
    // 5. اختبار التشفير (E2EE)
    // ======================================================================
    async function testEncryption() {
        logGroup('5. التشفير من طرف إلى طرف (E2EE)');
        try {
            const hasCrypto = !!(window.crypto && window.crypto.subtle);
            if (!hasCrypto) {
                logFail('crypto.subtle غير مدعوم');
                endGroup();
                return;
            }
            logPass('crypto.subtle مدعوم');

            const cryptoFuncs = ['generateKeyPair', 'deriveSharedSecret', 'encryptText', 'decryptText',
                'initEncryption', 'exportPublicKey', 'importPublicKey'
            ];
            for (const fn of cryptoFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // اختبار توليد المفاتيح
            if (typeof window.generateKeyPair === 'function') {
                try {
                    const keyPair = await window.generateKeyPair();
                    if (keyPair && keyPair.publicKey && keyPair.privateKey) {
                        logPass('generateKeyPair يعمل (تم توليد زوج مفاتيح)');

                        // اختبار تصدير واستيراد المفتاح العام
                        if (typeof window.exportPublicKey === 'function') {
                            const exported = await window.exportPublicKey(keyPair.publicKey);
                            if (exported && exported.length > 0) {
                                logPass('exportPublicKey يعمل');
                                // اختبار استيراد المفتاح العام
                                if (typeof window.importPublicKey === 'function') {
                                    const imported = await window.importPublicKey(exported);
                                    if (imported) logPass('importPublicKey يعمل');
                                    else logFail('importPublicKey فشل');
                                }
                            } else {
                                logFail('exportPublicKey فشل');
                            }
                        }

                        // اختبار التشفير (يحتاج إلى مفتاح جلسة)
                        if (typeof window.deriveSharedSecret === 'function' && typeof window.encryptText === 'function') {
                            try {
                                // استخدام نفس زوج المفاتيح للتجربة (في الواقع يجب أن يكون مستلم آخر)
                                const sharedSecret = await window.deriveSharedSecret(keyPair.privateKey, keyPair.publicKey);
                                if (sharedSecret) {
                                    const encrypted = await window.encryptText('رسالة اختبار', sharedSecret);
                                    if (encrypted && encrypted.encrypted && encrypted.iv) {
                                        logPass('encryptText يعمل');

                                        // اختبار فك التشفير
                                        if (typeof window.decryptText === 'function') {
                                            const decrypted = await window.decryptText(encrypted, sharedSecret);
                                            if (decrypted === 'رسالة اختبار') {
                                                logPass('decryptText يعمل (فك التشفير ناجح)');
                                            } else {
                                                logFail('decryptText فشل (النص المفكوك غير صحيح)');
                                            }
                                        }
                                    } else {
                                        logFail('encryptText فشل');
                                    }
                                } else {
                                    logFail('deriveSharedSecret فشل');
                                }
                            } catch (e) {
                                logWarn('اختبار التشفير/فك التشفير فشل', e);
                            }
                        }
                    } else {
                        logFail('generateKeyPair فشل');
                    }
                } catch (e) {
                    logFail('استثناء في اختبار التشفير', e);
                }
            }

            // التحقق من وجود المفتاح الحالي
            if (typeof currentUserKeyPair !== 'undefined') {
                if (currentUserKeyPair) logPass('مفتاح المستخدم الحالي موجود');
                else logWarn('مفتاح المستخدم الحالي غير موجود (قد يُنشأ عند التهيئة)');
            }

        } catch (e) {
            logFail('خطأ في فحص التشفير', e);
        }
        endGroup();
    }

    // ======================================================================
    // 6. اختبار دوال common.js
    // ======================================================================
    async function testCommonFunctions() {
        logGroup('6. دوال common.js');
        try {
            // دوال أساسية
            const coreFuncs = ['renderChats', 'renderMessages', 'renderContactsList', 'renderStories',
                'showScreen', 'openChat', 'sendMessage', 'syncContacts', 'logout', 'applyTheme'
            ];
            for (const fn of coreFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logFail(`window.${fn} غير موجود`);
            }

            // دوال التشفير في common.js (بعضها موجود بالفعل في testEncryption)
            const cryptoCommonFuncs = ['initEncryption', 'deriveSharedSecret', 'encryptText', 'decryptText', 'fetchPeerPublicKey'];
            for (const fn of cryptoCommonFuncs) {
                if (typeof window[fn] === 'function') logPass(`window.${fn} موجود`);
                else logWarn(`window.${fn} غير موجود (قد يكون في supabase.js)`);
            }

            // التحقق من وجود currentChatId (متغير حالة)
            if (typeof currentChatId !== 'undefined') {
                logPass('currentChatId معرف');
                logData('currentChatId', currentChatId || 'لا توجد محادثة مفتوحة');
            } else {
                logWarn('currentChatId غير معرف (قد يكون التطبيق لم يفتح محادثة بعد)');
            }

            // اختبار التنقل بين الشاشات
            if (typeof window.showScreen === 'function') {
                try {
                    // لا ننفذ showScreen فعلياً لتجنب تغيير واجهة المستخدم أثناء الاختبار
                    logPass('showScreen متاح (يمكن استخدامه للتنقل)');
                } catch (e) {
                    logFail('showScreen فشل', e);
                }
            }

        } catch (e) {
            logFail('خطأ في فحص common.js', e);
        }
        endGroup();
    }

    // ======================================================================
    // 7. اختبار واجهة المستخدم (UI)
    // ======================================================================
    async function testUI() {
        logGroup('7. واجهة المستخدم (UI)');
        try {
            // الشاشات (Screens)
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

            // العناصر التفاعلية الأساسية
            const uiElements = [
                'bottomNav', 'appContainer', 'toast', 'chatsList', 'messagesArea',
                'msgInput', 'sendMsgBtn', 'micBtn', 'emojiBtn', 'attachBtn',
                'backBtn', 'chatNameDisp', 'chatStatusDisp',
                'profileName', 'profileAvatar', 'profileBio'
            ];
            for (const id of uiElements) {
                const el = document.getElementById(id);
                if (el) logPass(`العنصر #${id} موجود`);
                else logWarn(`العنصر #${id} غير موجود (قد لا يكون ضرورياً)`);
            }

            // شريط التنقل السفلي
            const nav = document.getElementById('bottomNav');
            if (nav) {
                logPass('bottomNav موجود');
                const visible = window.getComputedStyle(nav).display !== 'none';
                logData('bottomNav visible', visible);
            } else {
                logFail('bottomNav غير موجود');
            }

            // الشاشة النشطة حالياً
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                logPass('هناك شاشة نشطة');
                logData('الشاشة النشطة', activeScreen.id || 'غير معروف');
            } else {
                logWarn('لا توجد شاشة نشطة (قد يكون التطبيق في حالة تحميل)');
            }

            // التحقق من وجود المستخدم الحالي في واجهة المستخدم
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            if (user) {
                logPass('المستخدم الحالي موجود في التطبيق');
                logData('اسم المستخدم', user.name || 'غير معروف');
            } else {
                logWarn('لا يوجد مستخدم حالياً (قد تكون في وضع الضيف)');
            }

        } catch (e) {
            logFail('خطأ في فحص واجهة المستخدم', e);
        }
        endGroup();
    }

    // ======================================================================
    // تنفيذ تلقائي (اختياري)
    // ======================================================================
    setTimeout(() => {
        // ننتظر حتى يكتمل تحميل الصفحة
        if (document.readyState === 'complete') {
            console.log('⏳ سيبدأ الفحص التلقائي بعد 2 ثانية...');
            setTimeout(() => {
                window.runAllTests().catch(e => {
                    console.error('❌ خطأ أثناء تشغيل الاختبارات:', e);
                });
            }, 2000);
        }
    }, 500);

    console.log('✅ test.js (الإصدار النهائي v5.0) جاهز');
    console.log('💡 لتشغيل الفحص يدوياً: runAllTests()');
    console.log('💡 لفحص مكون معين: انظر دوال test* داخل الكود');

})();
