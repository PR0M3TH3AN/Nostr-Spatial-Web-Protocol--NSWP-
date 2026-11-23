/**
 * The files this browser keeps for this site: the pictures and video a visitor hung (library.ts), and their own
 * songs (sound.ts). One store, in the browser's own database. Nothing in it is sent anywhere.
 *
 * It is a file of its own, with no renderer in it, so that a page which only draws the menu (a client's, above a
 * world) can keep a visitor's songs without loading one. Moved out of library.ts word for word.
 */
const DB = "nswp-panels";
function files(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
/** Do one thing to the kept files. Returns undefined where this browser keeps nothing. */
export async function fileStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await files();
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction("files", mode).objectStore("files"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}
