// ======================================================================
// media.js - الإصدار النهائي v5.6 (نظام تخزين الملفات الهجين)
// ======================================================================

(function() {
    'use strict';

    // ======================================================================
    // التكوين الأساسي
    // ======================================================================
    const MEDIA_FOLDER_NAME = 'RamzApp_Media';
    const DB_NAME = 'RamzAppMediaStore';
    const STORE_NAME = 'files';
    const FALLBACK_STORE_NAME = 'fallback_files';
    const HANDLE_STORE_NAME = 'directory_handles';
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 ميجابايت كحد أقصى

    let directoryHandle = null;
    let mediaReady = false;
    let useFallback = false;
    let indexedDBReady = false;
    let initPromise = null;

    // ======================================================================
    // دوال مساعدة
    // ======================================================================
    function generateUniqueFileName(messageId, fileType) {
        const ts = Date.now();
        const ext = getExtensionFromMime(fileType);
        return `ramz_${ts}_${messageId.slice(-8)}.${ext}`;
    }

    function getExtensionFromMime(mimeType) {
        if (!mimeType) return 'bin';
        const map = {
            'image/': 'jpg',
            'audio/': 'webm',
            'video/': 'mp4',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'text/plain': 'txt',
            'application/json': 'json',
            'application/zip': 'zip'
        };
        for (const [key, value] of Object.entries(map)) {
            if (mimeType.startsWith(key)) return value;
        }
        return mimeType.split('/').pop() || 'bin';
    }

    function getMimeFromExtension(ext) {
        const map = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
            'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
            'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
            'pdf': 'application/pdf', 'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain', 'json': 'application/json', 'zip': 'application/zip'
        };
        return map[ext.toLowerCase()] || 'application/octet-stream';
    }

    function isImageType(mimeType) {
        return mimeType && mimeType.startsWith('image/');
    }

    function isVideoType(mimeType) {
        return mimeType && mimeType.startsWith('video/');
    }

    function isAudioType(mimeType) {
        return mimeType && mimeType.startsWith('audio/');
    }

    function isDocumentType(mimeType) {
        if (!mimeType) return false;
        const docTypes = ['application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'application/json', 'application/zip'];
        return docTypes.some(t => mimeType.includes(t));
    }

    // ======================================================================
    // IndexedDB (الاحتياطي الدائم)
    // ======================================================================
    function openFallbackDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 3);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(FALLBACK_STORE_NAME)) {
                    db.createObjectStore(FALLBACK_STORE_NAME, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
                    db.createObjectStore(HANDLE_STORE_NAME);
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveToFallbackIndexedDB(fileName, data, mimeType) {
        try {
            const db = await openFallbackDB();
            const tx = db.transaction(FALLBACK_STORE_NAME, 'readwrite');
            const store = tx.objectStore(FALLBACK_STORE_NAME);
            const record = {
                id: fileName,
                data: data, // Base64 أو Blob
                mimeType: mimeType,
                savedAt: new Date().toISOString()
            };
            await new Promise((resolve, reject) => {
                const req = store.put(record);
                req.onsuccess = resolve;
                req.onerror = reject;
            });
            indexedDBReady = true;
            return true;
        } catch (e) {
            console.warn('⚠️ فشل حفظ الملف في IndexedDB', e);
            return false;
        }
    }

    async function getFromFallbackIndexedDB(fileName) {
        try {
            const db = await openFallbackDB();
            const tx = db.transaction(FALLBACK_STORE_NAME, 'readonly');
            const store = tx.objectStore(FALLBACK_STORE_NAME);
            return await new Promise((resolve, reject) => {
                const req = store.get(fileName);
                req.onsuccess = () => resolve(req.result);
                req.onerror = reject;
            });
        } catch (e) {
            return null;
        }
    }

    async function deleteFromFallbackIndexedDB(fileName) {
        try {
            const db = await openFallbackDB();
            const tx = db.transaction(FALLBACK_STORE_NAME, 'readwrite');
            const store = tx.objectStore(FALLBACK_STORE_NAME);
            await new Promise((resolve, reject) => {
                const req = store.delete(fileName);
                req.onsuccess = resolve;
                req.onerror = reject;
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    async function getAllFallbackFiles() {
        try {
            const db = await openFallbackDB();
            const tx = db.transaction(FALLBACK_STORE_NAME, 'readonly');
            const store = tx.objectStore(FALLBACK_STORE_NAME);
            return await new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result.map(r => r.id));
                req.onerror = reject;
            });
        } catch (e) {
            return [];
        }
    }

    // ======================================================================
    // إدارة مقابض المجلدات (Directory Handles)
    // ======================================================================
    function openHandleDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('RamzAppFileHandles', 1);
            req.onupgradeneeded = (e) => {
                if (!e.target.result.objectStoreNames.contains(HANDLE_STORE_NAME)) {
                    e.target.result.createObjectStore(HANDLE_STORE_NAME);
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = reject;
        });
    }

    async function saveDirectoryHandle(handle) {
        try {
            const db = await openHandleDB();
            const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
            const store = tx.objectStore(HANDLE_STORE_NAME);
            await new Promise((resolve, reject) => {
                const req = store.put(handle, 'mediaFolder');
                req.onsuccess = resolve;
                req.onerror = reject;
            });
        } catch (e) { /* تجاهل */ }
    }

    async function loadDirectoryHandle() {
        try {
            const db = await openHandleDB();
            const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
            const store = tx.objectStore(HANDLE_STORE_NAME);
            return await new Promise((resolve, reject) => {
                const req = store.get('mediaFolder');
                req.onsuccess = () => resolve(req.result);
                req.onerror = reject;
            });
        } catch (e) {
            return null;
        }
    }

    // ======================================================================
    // File System Access API
    // ======================================================================
    function isFileSystemAccessSupported() {
        return 'showDirectoryPicker' in window && 'storage' in navigator && 'getDirectory' in navigator.storage;
    }

    async function verifyPermission(handle) {
        const opts = { mode: 'readwrite' };
        if (await handle.queryPermission(opts) === 'granted') return true;
        return await handle.requestPermission(opts) === 'granted';
    }

    // ======================================================================
    // الدوال العامة – API الرئيسية
    // ======================================================================

    // ----- التهيئة -----
    window.initMedia = async function() {
        if (initPromise) return initPromise;
        initPromise = (async () => {
            // محاولة تحميل المقبض المحفوظ
            if (isFileSystemAccessSupported()) {
                try {
                    const saved = await loadDirectoryHandle();
                    if (saved && await verifyPermission(saved)) {
                        directoryHandle = saved;
                        mediaReady = true;
                        useFallback = false;
                        console.log('✅ تم تحميل مجلد الوسائط من File System');
                        return true;
                    }
                } catch (e) { /* تجاهل */ }
            }

            // محاولة فتح مجلد جديد
            const result = await window.requestNewDirectory();
            if (result) {
                return true;
            }

            // الاحتياطي: استخدام IndexedDB
            console.log('⚠️ استخدام IndexedDB كتخزين احتياطي للوسائط');
            useFallback = true;
            mediaReady = true;
            try {
                await openFallbackDB();
                indexedDBReady = true;
            } catch (e) { /* تجاهل */ }
            return false;
        })();
        return initPromise;
    };

    // ----- طلب مجلد جديد من المستخدم -----
    window.requestNewDirectory = async function() {
        if (!isFileSystemAccessSupported()) {
            useFallback = true;
            mediaReady = true;
            return false;
        }
        try {
            const handle = await window.showDirectoryPicker({
                id: 'ramzapp_media',
                mode: 'readwrite',
                startIn: 'documents'
            });
            directoryHandle = handle;
            await saveDirectoryHandle(handle);
            mediaReady = true;
            useFallback = false;
            console.log('✅ تم اختيار مجلد الوسائط بنجاح');
            return true;
        } catch (e) {
            if (e.name !== 'AbortError' && e.name !== 'SecurityError') {
                console.warn('⚠️ فشل اختيار المجلد', e);
            }
            useFallback = true;
            mediaReady = true;
            return false;
        }
    };

    // ----- حفظ ملف وسائط (للرسائل) -----
    window.saveMedia = async function(messageId, data, fileType) {
        if (!mediaReady) {
            await window.initMedia();
        }

        if (!data) {
            console.warn('⚠️ لا توجد بيانات للحفظ');
            return null;
        }

        const fileName = generateUniqueFileName(messageId, fileType);

        // محاولة الحفظ في نظام الملفات
        if (!useFallback && directoryHandle) {
            try {
                let blob;
                if (typeof data === 'string' && data.startsWith('data:')) {
                    blob = await fetch(data).then(r => r.blob());
                } else if (data instanceof Blob) {
                    blob = data;
                } else if (data instanceof File) {
                    blob = data;
                } else {
                    blob = new Blob([data], { type: fileType || 'application/octet-stream' });
                }

                // التحقق من حجم الملف
                if (blob.size > MAX_FILE_SIZE) {
                    console.warn('⚠️ حجم الملف كبير جداً:', blob.size);
                    // محاولة ضغط الصورة إذا كانت كبيرة جداً
                    if (isImageType(blob.type) && blob.size > 5 * 1024 * 1024) {
                        try {
                            blob = await compressImage(blob);
                            console.log('✅ تم ضغط الصورة بنجاح');
                        } catch (compressError) {
                            console.warn('⚠️ فشل ضغط الصورة:', compressError);
                        }
                    }
                }

                const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                // تخزين نسخة احتياطية في IndexedDB (في حالة فقدان الوصول)
                try {
                    const base64 = await window.blobToBase64(blob);
                    await saveToFallbackIndexedDB(fileName, base64, fileType || blob.type);
                } catch (fallbackError) {
                    console.warn('⚠️ فشل حفظ النسخة الاحتياطية في IndexedDB', fallbackError);
                }

                return fileName;
            } catch (e) {
                console.warn('⚠️ فشل الحفظ في نظام الملفات، استخدام الاحتياطي', e);
                useFallback = true;
            }
        }

        // الاحتياطي: الحفظ في IndexedDB
        try {
            let base64Data = data;
            if (data instanceof Blob || data instanceof File) {
                base64Data = await window.blobToBase64(data);
            } else if (typeof data !== 'string') {
                base64Data = new TextDecoder().decode(data);
            }
            await saveToFallbackIndexedDB(fileName, base64Data, fileType || 'application/octet-stream');
            return fileName;
        } catch (e) {
            console.error('❌ فشل حفظ الملف في الاحتياطي', e);
            return null;
        }
    };

    // ----- ضغط الصور (مساعدة) -----
    async function compressImage(blob, maxWidth = 1280, maxHeight = 1280, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // حساب الأبعاد الجديدة
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((compressedBlob) => {
                    if (compressedBlob) {
                        resolve(compressedBlob);
                    } else {
                        reject(new Error('فشل ضغط الصورة'));
                    }
                }, blob.type || 'image/jpeg', quality);
            };
            img.onerror = () => reject(new Error('فشل تحميل الصورة للضغط'));
            img.src = URL.createObjectURL(blob);
            setTimeout(() => {
                URL.revokeObjectURL(img.src);
            }, 10000);
        });
    }

    // ----- الحصول على رابط URL للملف (للعرض في الواجهة) -----
    window.getMediaUrl = async function(fileName) {
        if (!fileName) return null;

        // محاولة الجلب من نظام الملفات
        if (!useFallback && directoryHandle) {
            try {
                const fileHandle = await directoryHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                return URL.createObjectURL(file);
            } catch (e) {
                // الملف غير موجود في نظام الملفات
            }
        }

        // الجلب من الاحتياطي (IndexedDB)
        const record = await getFromFallbackIndexedDB(fileName);
        if (record) {
            const mimeType = record.mimeType || getMimeFromExtension(fileName.split('.').pop());
            if (record.data && record.data.startsWith('data:')) {
                return record.data;
            }
            if (record.data) {
                try {
                    const blob = new Blob(
                        [Uint8Array.from(atob(record.data), c => c.charCodeAt(0))],
                        { type: mimeType }
                    );
                    return URL.createObjectURL(blob);
                } catch (e) {
                    console.warn('⚠️ فشل تحويل البيانات إلى Blob', e);
                }
            }
        }

        return null;
    };

    // ----- الحصول على الملف كـ Blob -----
    window.getMediaBlob = async function(fileName) {
        if (!fileName) return null;

        if (!useFallback && directoryHandle) {
            try {
                const fileHandle = await directoryHandle.getFileHandle(fileName);
                return await fileHandle.getFile();
            } catch (e) { /* تجاهل */ }
        }

        const record = await getFromFallbackIndexedDB(fileName);
        if (record) {
            const mimeType = record.mimeType || getMimeFromExtension(fileName.split('.').pop());
            if (record.data && record.data.startsWith('data:')) {
                try {
                    const response = await fetch(record.data);
                    return await response.blob();
                } catch (e) {
                    console.warn('⚠️ فشل تحويل data URL إلى Blob', e);
                }
            }
            if (record.data) {
                try {
                    const byteCharacters = atob(record.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    return new Blob([byteArray], { type: mimeType });
                } catch (e) {
                    console.warn('⚠️ فشل تحويل Base64 إلى Blob', e);
                }
            }
        }
        return null;
    };

    // ----- الحصول على الملف كـ File (مع اسم) -----
    window.getMediaFile = async function(fileName) {
        const blob = await window.getMediaBlob(fileName);
        if (!blob) return null;
        return new File([blob], fileName, { type: blob.type });
    };

    // ----- حذف ملف وسائط -----
    window.deleteMedia = async function(fileName) {
        if (!fileName) return false;

        let deleted = false;
        // حذف من نظام الملفات
        if (!useFallback && directoryHandle) {
            try {
                await directoryHandle.removeEntry(fileName);
                deleted = true;
            } catch (e) { /* تجاهل */ }
        }

        // حذف من الاحتياطي
        const fallbackDeleted = await deleteFromFallbackIndexedDB(fileName);
        if (fallbackDeleted) deleted = true;

        return deleted;
    };

    // ----- سرد جميع الملفات في المجلد -----
    window.listMediaFiles = async function() {
        const files = [];

        // من نظام الملفات
        if (!useFallback && directoryHandle) {
            try {
                for await (const [name, handle] of directoryHandle.entries()) {
                    if (handle.kind === 'file' && name.startsWith('ramz_')) {
                        try {
                            const file = await handle.getFile();
                            files.push({
                                name: name,
                                size: file.size,
                                type: file.type,
                                lastModified: file.lastModified,
                                path: name,
                                isFallback: false
                            });
                        } catch (e) { /* تجاهل */ }
                    }
                }
            } catch (e) { /* تجاهل */ }
        }

        // من الاحتياطي
        const fallbackFiles = await getAllFallbackFiles();
        for (const name of fallbackFiles) {
            if (name.startsWith('ramz_') && !files.find(f => f.name === name)) {
                const record = await getFromFallbackIndexedDB(name);
                files.push({
                    name: name,
                    size: record?.data?.length || 0,
                    type: record?.mimeType || 'unknown',
                    lastModified: Date.now(),
                    path: name,
                    isFallback: true
                });
            }
        }

        return files;
    };

    // ----- تنظيف الملفات غير المستخدمة (بناءً على قائمة المفاتيح النشطة) -----
    window.cleanupUnusedMedia = async function(activeNames) {
        if (!activeNames || !activeNames.length) return;
        const activeSet = new Set(activeNames);

        // تنظيف نظام الملفات
        if (!useFallback && directoryHandle) {
            try {
                for await (const [name, handle] of directoryHandle.entries()) {
                    if (handle.kind === 'file' && name.startsWith('ramz_') && !activeSet.has(name)) {
                        await directoryHandle.removeEntry(name);
                    }
                }
            } catch (e) { /* تجاهل */ }
        }

        // تنظيف IndexedDB
        try {
            const allFiles = await getAllFallbackFiles();
            for (const name of allFiles) {
                if (name.startsWith('ramz_') && !activeSet.has(name)) {
                    await deleteFromFallbackIndexedDB(name);
                }
            }
        } catch (e) { /* تجاهل */ }
    };

    // ----- الحصول على حجم المجلد -----
    window.getMediaUsage = async function() {
        let totalSize = 0;

        // من نظام الملفات
        if (!useFallback && directoryHandle) {
            try {
                for await (const [name, handle] of directoryHandle.entries()) {
                    if (handle.kind === 'file' && name.startsWith('ramz_')) {
                        try {
                            const file = await handle.getFile();
                            totalSize += file.size;
                        } catch (e) { /* تجاهل */ }
                    }
                }
            } catch (e) { /* تجاهل */ }
        }

        // من الاحتياطي
        try {
            const fallbackFiles = await getAllFallbackFiles();
            for (const name of fallbackFiles) {
                if (name.startsWith('ramz_')) {
                    const record = await getFromFallbackIndexedDB(name);
                    if (record?.data) {
                        totalSize += record.data.length;
                    }
                }
            }
        } catch (e) { /* تجاهل */ }
        return totalSize;
    };

    // ======================================================================
    // دوال تحويل البيانات (مساعدات)
    // ======================================================================
    window.blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    window.base64ToBlob = (base64, mimeType) => {
        try {
            const parts = base64.split(',');
            const contentType = mimeType || parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
            const raw = atob(parts[1] || parts[0]);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
                bytes[i] = raw.charCodeAt(i);
            }
            return new Blob([bytes], { type: contentType });
        } catch (e) {
            console.warn('⚠️ فشل تحويل Base64 إلى Blob:', e);
            return null;
        }
    };

    window.dataURLToBlob = function(dataURL) {
        return window.base64ToBlob(dataURL);
    };

    // ======================================================================
    // دوال الحالة
    // ======================================================================
    window.isMediaReady = () => mediaReady;
    window.isUsingFallback = () => useFallback;
    window.getMediaFolderName = () => {
        if (useFallback) return '📦 التخزين الاحتياطي (IndexedDB)';
        return directoryHandle?.name || 'غير محدد';
    };
    window.getMaxFileSize = () => MAX_FILE_SIZE;

    // ======================================================================
    // التهيئة التلقائية
    // ======================================================================
    console.log('✅ media.js (الإصدار النهائي v5.6 - تخزين هجين) جاهز');
    console.log('💾 يدعم التخزين المباشر بنظام الملفات (OPFS) + احتياطي IndexedDB');

    // محاولة التهيئة التلقائية بعد تحميل الصفحة
    if (document.readyState === 'complete') {
        setTimeout(() => window.initMedia().catch(() => {}), 500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => window.initMedia().catch(() => {}), 1000);
        });
    }

})();
