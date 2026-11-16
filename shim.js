/* Standalone runtime for the website version.
   Inside Claude the page uses window.claude; on its own (GitHub Pages) this file
   provides the same small API, keeping all data in this browser's IndexedDB. */
(function(){
  if (window.claude) return;
  const DBN = "rental-app", VER = 1;
  let dbp = null;
  function idb(){
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DBN, VER);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs"); if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn){ const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); let out; Promise.resolve(fn(s)).then(v => out = v); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
  const listeners = {}; // collection -> Set(fn)
  async function readCol(col){
    const out = [];
    await tx("docs", "readonly", s => new Promise(res => {
      const c = s.openCursor(IDBKeyRange.bound(col + "/", col + "/￿"));
      c.onsuccess = () => { const cur = c.result; if (!cur) return res(); const id = String(cur.key).slice(col.length + 1); if (!id.includes("/")) out.push({ id, d: cur.value }); cur.continue(); };
    }));
    return out;
  }
  async function notify(col){
    const set = listeners[col]; if (!set || !set.size) return;
    const rows = await readCol(col);
    for (const fn of set) fn(rows);
  }
  function snapFrom(rows, order){
    let r = rows.slice();
    if (order) r.sort((a, b) => { const x = a.d[order.f] ?? 0, y = b.d[order.f] ?? 0; return (x > y ? 1 : x < y ? -1 : 0) * (order.dir === "desc" ? -1 : 1); });
    return { docs: r.map(x => ({ id: x.id, data: () => JSON.parse(JSON.stringify(x.d)) })), metadata: { fromCache: false } };
  }
  function docRef(col, id){
    const key = col + "/" + id;
    return {
      id,
      async get(){ const v = await tx("docs", "readonly", s => reqP(s.get(key))); return { exists: v !== undefined, id, data: () => v }; },
      async set(data){ await tx("docs", "readwrite", s => reqP(s.put(JSON.parse(JSON.stringify(data)), key))); await notify(col); },
      async update(patch){ await tx("docs", "readwrite", async s => { const cur = await reqP(s.get(key)); if (cur === undefined) throw Object.assign(new Error("not_found"), { code: "not_found" }); return reqP(s.put(Object.assign({}, cur, JSON.parse(JSON.stringify(patch))), key)); }); await notify(col); },
      async delete(){ await tx("docs", "readwrite", s => reqP(s.delete(key))); await notify(col); }
    };
  }
  function colRef(col, order){
    return {
      doc(id){ return docRef(col, id || newId()); },
      orderBy(f, dir){ return colRef(col, { f, dir: dir || "asc" }); },
      onSnapshot(cb, err){
        const fn = rows => { try { cb(snapFrom(rows, order)); } catch (e) { console.error(e); } };
        (listeners[col] = listeners[col] || new Set()).add(fn);
        readCol(col).then(fn, e => err && err(e));
        return () => listeners[col].delete(fn);
      },
      async get(){ return snapFrom(await readCol(col), order); }
    };
  }
  const db = {
    collection: path => colRef(path),
    doc: path => { const i = path.lastIndexOf("/"); return docRef(path.slice(0, i), path.slice(i + 1)); }
  };
  /* photos */
  const urls = {};
  async function loadBlobs(){
    await tx("blobs", "readonly", s => new Promise(res => { const c = s.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return res(); urls[cur.key] = URL.createObjectURL(cur.value); cur.continue(); }; }));
  }
  window.__blobURL = id => urls[id] || "";
  const assets = {
    async upload(blob){ const id = newId() + newId(); await tx("blobs", "readwrite", s => reqP(s.put(blob, id))); urls[id] = URL.createObjectURL(blob); return { id, url: urls[id], sizeBytes: blob.size, contentType: blob.type }; },
    async delete(id){ await tx("blobs", "readwrite", s => reqP(s.delete(id))); if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } },
    async list(){ return { assets: Object.keys(urls).map(id => ({ id, url: urls[id] })), usage: {} }; }
  };
  /* saving files: share sheet on phones (WhatsApp, LINE, WeChat), download elsewhere */
  const downloads = {
    async save({ filename, data }){
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.html?$/i.test(filename) ? "text/html" : "application/octet-stream" });
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: filename }); return; }
        catch (e) { if (e && e.name === "AbortError") throw { code: "declined" }; }
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
  };
  /* backup & restore of everything on this device */
  async function exportAll(){
    const docs = {}, blobs = {};
    await tx("docs", "readonly", s => new Promise(res => { const c = s.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return res(); docs[cur.key] = cur.value; cur.continue(); }; }));
    const raw = [];
    await tx("blobs", "readonly", s => new Promise(res => { const c = s.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return res(); raw.push([cur.key, cur.value]); cur.continue(); }; }));
    for (const [k, b] of raw) blobs[k] = { type: b.type, data: await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }) };
    return JSON.stringify({ app: "rental-app", version: 1, exportedAt: new Date().toISOString(), docs, blobs });
  }
  async function importAll(text){
    const j = JSON.parse(text);
    if (!j || j.app !== "rental-app" || !j.docs) throw new Error("not a backup");
    await tx("docs", "readwrite", s => { for (const [k, v] of Object.entries(j.docs)) s.put(v, k); });
    const entries = Object.entries(j.blobs || {});
    for (const [k, v] of entries) { const b = await (await fetch(v.data)).blob(); await tx("blobs", "readwrite", s => reqP(s.put(b, k))); urls[k] = URL.createObjectURL(b); }
    for (const col of Object.keys(listeners)) notify(col);
    return { docs: Object.keys(j.docs).length, photos: entries.length };
  }
  window.__standalone = { exportAll, importAll };
  const ready = loadBlobs().catch(() => {});
  window.claude = { use: async name => { await ready; return ({ db, assets, downloads })[name] || null; } };
})();
