// media.js - إدارة مجلد الوسائط (بدون export)
(function() {
    let directoryHandle = null;
    let mediaReady = false;
    let useFallback = false;
    const FALLBACK_STORE = new Map();
    const MEDIA_FOLDER_NAME = 'RamzApp Media';
    const DB_NAME = 'RamzAppFileHandles';
    const HANDLE_STORE = 'directory_handles';

    function isFileSystemAccessSupported() {
        return 'showDirectoryPicker' in window;
    }

    function openHandleDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                if (!e.target.result.objectStoreNames.contains(HANDLE_STORE)) {
                    e.target.result.createObjectStore(HANDLE_STORE);
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = reject;
        });
    }

    async function saveDirectoryHandle(handle) {
        const db = await openHandleDB();
        const tx = db.transaction(HANDLE_STORE, 'readwrite');
        tx.objectStore(HANDLE_STORE).put(handle, 'mediaFolder');
        return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    }

    async function loadDirectoryHandle() {
        const db = await openHandleDB();
        const tx = db.transaction(HANDLE_STORE, 'readonly');
        const req = tx.objectStore(HANDLE_STORE).get('mediaFolder');
        return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = reject; });
    }

    async function verifyPermission(handle) {
        const opts = { mode: 'readwrite' };
        if (await handle.queryPermission(opts) === 'granted') return true;
        return await handle.requestPermission(opts) === 'granted';
    }

    window.initMedia = async function() {
        if (!isFileSystemAccessSupported()) {
            useFallback = true;
            mediaReady = true;
            return false;
        }
        try {
            const saved = await loadDirectoryHandle();
            if (saved && await verifyPermission(saved)) {
                directoryHandle = saved;
                mediaReady = true;
                return true;
            }
            return await window.requestNewDirectory();
        } catch (e) {
            useFallback = true;
            mediaReady = true;
            return false;
        }
    };

    window.requestNewDirectory = async function() {
        if (!isFileSystemAccessSupported()) {
            useFallback = true; mediaReady = true; return false;
        }
        try {
            const handle = await window.showDirectoryPicker({ id: 'ramzapp_media', mode: 'readwrite', startIn: 'documents' });
            directoryHandle = handle;
            await saveDirectoryHandle(handle);
            mediaReady = true;
            useFallback = false;
            return true;
        } catch (e) {
            useFallback = true; mediaReady = true; return false;
        }
    };

    function generateFileName(messageId, fileType) {
        const ts = Date.now();
        const ext = (fileType.split('/').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5);
        return `ramz_${ts}_${messageId.slice(-8)}.${ext}`;
    }

    window.saveMedia = async function(messageId, data, fileType) {
        if (!mediaReady) return saveFallback(messageId, data, fileType);
        if (useFallback) return saveFallback(messageId, data, fileType);
        try {
            const fileName = generateFileName(messageId, fileType);
            let blob;
            if (typeof data === 'string' && data.startsWith('data:')) {
                blob = await fetch(data).then(r => r.blob());
            } else if (data instanceof Blob) {
                blob = data;
            } else {
                blob = new Blob([data], { type: fileType });
            }
            const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return fileName;
        } catch (e) {
            return saveFallback(messageId, data, fileType);
        }
    };

    function saveFallback(messageId, data, fileType) {
        const fileName = generateFileName(messageId, fileType);
        FALLBACK_STORE.set(fileName, data);
        return fileName;
    }

    window.getMediaUrl = async function(fileName) {
        if (!fileName) return null;
        if (FALLBACK_STORE.has(fileName)) {
            const d = FALLBACK_STORE.get(fileName);
            return typeof d === 'string' ? d : URL.createObjectURL(d);
        }
        if (useFallback || !directoryHandle) return null;
        try {
            const fileHandle = await directoryHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            return URL.createObjectURL(file);
        } catch (e) { return null; }
    };

    window.deleteMedia = async function(fileName) {
        FALLBACK_STORE.delete(fileName);
        if (!useFallback && directoryHandle) {
            try { await directoryHandle.removeEntry(fileName); } catch (e) {}
        }
    };

    window.cleanupUnusedMedia = async function(activeNames) {
        if (useFallback || !directoryHandle) return;
        const active = new Set(activeNames);
        for await (const [name, handle] of directoryHandle.entries()) {
            if (handle.kind === 'file' && name.startsWith('ramz_') && !active.has(name)) {
                await directoryHandle.removeEntry(name);
            }
        }
    };

    window.isMediaReady = () => mediaReady;
    window.isUsingFallback = () => useFallback;
    window.getMediaFolderName = () => directoryHandle?.name || (useFallback ? 'ذاكرة مؤقتة' : 'غير محدد');
    window.blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    console.log('✅ media.js ready');
})();
