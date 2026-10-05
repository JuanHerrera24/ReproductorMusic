"use strict";
class FileStore {
    constructor() {
        this.dbPromise = null;
    }
    open() {
        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(FileStore.DB_NAME, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(FileStore.STORE);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return this.dbPromise;
    }
    async run(mode, action) {
        try {
            const db = await this.open();
            return await new Promise((resolve, reject) => {
                const request = action(db.transaction(FileStore.STORE, mode).objectStore(FileStore.STORE));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        catch {
            return undefined;
        }
    }
    async put(id, blob) {
        return (await this.run("readwrite", (s) => s.put(blob, id))) !== undefined;
    }
    async get(id) {
        return (await this.run("readonly", (s) => s.get(id)));
    }
    async delete(id) {
        await this.run("readwrite", (s) => s.delete(id));
    }
    async clear() {
        await this.run("readwrite", (s) => s.clear());
    }
}
FileStore.DB_NAME = "taller-listas-dobles";
FileStore.STORE = "files";
