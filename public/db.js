// this is used to cache sound files on user device
// instead of fetching them over network every time

/** @type {Map<string, IDBDatabase>} */
const dbs = new Map();
/** @type {Map<string, Promise<IDBDatabase>>} */
const dbPromises = new Map();

open()

/**
 *
 * @param {string} dbName
 * @param {string} storeName
 * @returns {Promise<IDBDatabase>}
 */
export async function open(dbName = "db", storeName = "store") {
  let promise = dbPromises.get(dbName);
  if (promise !== undefined) {
    return promise;
  }
  let startTime = performance.now();
  promise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
    };
    request.onsuccess = (event) => {
      /** @type {IDBOpenDBRequest | null} */
      // @ts-ignore
      const target = event.target;
      if (target === null) {
        return reject("Could not open database, event target is null");
      }
      const result = target.result;
      if (result !== undefined) {
        dbs.set(dbName, result);
      }
      console.log(`Opened database in ${(performance.now() - startTime).toFixed(0)}ms`);
      return resolve(result)
    };
    // Create the object store if it doesn't exist
    request.onupgradeneeded = (event) => {
        /** @type {IDBDatabase | undefined} */
        // @ts-ignore
        const result = event.target?.result;
        if (result) {
          result.createObjectStore(storeName, { keyPath: "url" });
        }
    };
  });
  dbPromises.set(dbName, promise);
  return promise;
}

/**
 * @param {string} url
 * @returns {Promise<ArrayBuffer | undefined>}
 */
export async function load(url, dbName = "db", storeName = "store") {
  let startTime = performance.now();
  const db = await open(dbName);
  // check if db has the item and return it
  // otherwise fetch it, store it in db, and return the item
  /**
   * @type {ArrayBuffer | undefined}
   */
  const item = await new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(url);
    request.onsuccess = () => {
      console.log(`Loaded ${url} from indexedDB in ${(performance.now() - startTime).toFixed(0)}ms`);
      resolve(request?.result?.data);
    };
    request.onerror = () => {
      resolve(undefined);
    };
  });
  if (item !== undefined) {
    return item;
  }
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  store.put({ url, data });
  console.log(`Fetched and stored ${url} in ${(performance.now() - startTime).toFixed(0)}ms`);
  return data
}
