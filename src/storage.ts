class FileStore {
  private static readonly DB_NAME = "taller-listas-dobles";
  private static readonly STORE = "files";
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
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

  private async run<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    try {
      const db = await this.open();
      return await new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(FileStore.STORE, mode).objectStore(FileStore.STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return undefined;
    }
  }

  async put(id: string, blob: Blob): Promise<boolean> {
    return (await this.run("readwrite", (s) => s.put(blob, id))) !== undefined;
  }

  async get(id: string): Promise<Blob | undefined> {
    return (await this.run("readonly", (s) => s.get(id))) as Blob | undefined;
  }

  async delete(id: string): Promise<void> {
    await this.run("readwrite", (s) => s.delete(id));
  }

  async clear(): Promise<void> {
    await this.run("readwrite", (s) => s.clear());
  }
}
