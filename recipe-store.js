/** Offline IndexedDB store. No accounts, tracking, remote API, or sync. */
const DB_NAME = 'recipe-nest-v1';
const STORE = 'recipes';
let dbPromise;

function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('This browser does not support local recipe storage.'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open recipe storage.'));
  }).catch(error => { dbPromise = undefined; throw error; });
  return dbPromise;
}

async function request(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = action(store);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || new Error('Could not save changes.'));
    tx.onabort = () => reject(tx.error || new Error('Changes were cancelled.'));
  });
}
export const listRecipes = () => request('readonly', store => store.getAll());
export const getRecipe = id => request('readonly', store => store.get(id));
export const putRecipe = item => request('readwrite', store => store.put(item));
export const removeRecipe = id => request('readwrite', store => store.delete(id));

/** Merge imported recipes without overwriting an existing recipe ID. */
export async function importRecipes(items) {
  if (!Array.isArray(items)) throw new Error('This is not a Recipe Nest backup.');
  if (items.length > 2000) throw new Error('The backup contains too many recipes.');
  const existing = new Map((await listRecipes()).map(r => [r.id, r]));
  let imported = 0;
  for (const original of items) {
    if (!original || typeof original.markdown !== 'string' || typeof original.title !== 'string') continue;
    if (original.markdown.length > 200000) continue;
    const copy = JSON.parse(JSON.stringify(original));
    if (typeof copy.id !== 'string') copy.id = crypto.randomUUID();
    if (existing.has(copy.id)) {
      const current = existing.get(copy.id);
      if (current.markdown === copy.markdown && JSON.stringify(current.versions || []) === JSON.stringify(copy.versions || [])) continue;
      copy.id = crypto.randomUUID(); // Keep both distinct edits, never overwrite.
    }
    copy.versions = Array.isArray(copy.versions) ? copy.versions.slice(0, 100) : [];
    if (typeof copy.favorite !== 'boolean') copy.favorite = false;
    await putRecipe(copy);
    existing.set(copy.id, copy);
    imported++;
  }
  return imported;
}