const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const storage = new Map();
const elements = new Map();
function element(id = "") {
  if (!elements.has(id)) elements.set(id, {
    id, style: {}, dataset: {}, hidden: false, disabled: false,
    value: "", textContent: "", innerHTML: "", children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {}, setAttribute() {}, focus() {}, scrollIntoView() {},
    querySelector() { return null; }, matches() { return false; }, closest() { return null; },
    getBoundingClientRect() { return { width: 134, height: 134 }; }
  });
  return elements.get(id);
}

const staleWord = {
  english: "Police", kanji: "警察", hiragana: "けいさつ", jlpt: "N5", category: "People", pos: "Noun",
  srsVersion: 2, intervalDays: 0, easeFactor: 2.3, repetitions: 0, lapses: 0,
  reviewLog: [], correctCount: 0, failCount: 0, dueDate: "2026-09-17",
  nextReviewAt: "2026-09-17T00:00:00.000Z", lastReviewed: null, lastReviewedAt: null
};
const staleStats = { totalReviews: 0, successfulReviews: 0, totalFailures: 0, xp: 0, reviewHistory: {}, lessonHistory: {} };
let holdUploads = false;
const uploadResolvers = [];
const uploadCalls = [];
let savedRevision = 0;
const cloud = {
  rpc(name, args) {
    assert.equal(name, "save_kanji_srs_profile");
    const payload = { words: args.p_words, stats: args.p_stats, settings: args.p_settings };
    uploadCalls.push(payload);
    const result = { data: { revision: ++savedRevision }, error: null };
    if (!holdUploads) return Promise.resolve(result);
    return new Promise(resolve => uploadResolvers.push(() => resolve(result)));
  },
  from() {
    return {
      upsert(payload) {
        uploadCalls.push(payload);
        if (!holdUploads) return Promise.resolve({ error: null });
        return new Promise(resolve => uploadResolvers.push(() => resolve({ error: null })));
      },
      select() {
        return { eq() { return { maybeSingle: async () => ({
          data: { words: [staleWord], stats: staleStats, settings: { dailyGoal: 20, chunkSize: 5, strokeSpeed: "quick", gardenState: { version: 2, plots: [] } } },
          error: null
        }) }; } };
      }
    };
  },
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} }
};

const sandbox = {
  console, Date, Math, JSON, Blob, FileReader: class {},
  document: {
    hidden: false, getElementById: element, querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, createElement(tag) { return element(`created-${tag}-${elements.size}`); }
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  location: { href: "http://localhost/" }, alert() {}, confirm() { return true; },
  setTimeout() { return 1; }, clearTimeout() {}, setInterval() {},
  URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
  supabase: { createClient: () => cloud }, addEventListener() {}, matchMedia() { return { matches: false }; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const projectRoot = fs.existsSync(path.join(__dirname, "auth.js"))
  ? __dirname
  : path.resolve(__dirname, "..");
vm.runInContext(fs.readFileSync(path.join(projectRoot, "app.js"), "utf8"), sandbox, { filename: "app.js" });
vm.runInContext(fs.readFileSync(path.join(projectRoot, "auth.js"), "utf8"), sandbox, { filename: "auth.js" });
const run = code => vm.runInContext(code, sandbox);

(async () => {
  run(`currentUser = { id: "user-1", email: "test@example.com" }`);
  run(`words = normaliseWords([{...${JSON.stringify(staleWord)}, repetitions:1, correctCount:1,
    intervalDays:1, dueDate:"2026-09-18", nextReviewAt:"2026-09-18T00:00:00.000Z",
    lastReviewed:"2026-09-17", lastReviewedAt:"2026-09-17T01:00:00.000Z"}]);
    stats = normaliseStats({...${JSON.stringify(staleStats)}, totalReviews:1, successfulReviews:1,
      xp:5, reviewHistory:{"2026-09-17":1}});
    userSettings = normaliseSettings({...userSettings, strokeSpeed:"quick"});
    saveData();`);
  assert(storage.get("kanjiSRSPendingSync:user-1"), "local review should be marked pending");

  await run("loadCloudData()");
  assert.equal(run("words[0].correctCount"), 1, "stale cloud state must not replace the completed local review");
  assert.equal(uploadCalls.at(-1).words[0].correctCount, 1, "refresh recovery should upload the local review");
  assert.equal(uploadCalls.at(-1).settings.strokeSpeed, "quick", "stroke speed should sync with settings");
  assert.equal(storage.has("kanjiSRSPendingSync:user-1"), false, "successful recovery should clear pending state");

  holdUploads = true;
  run("words[0].correctCount = 2; stats.totalReviews = 2; saveData()");
  const olderSave = run("saveToCloud()");
  await new Promise(resolve => setImmediate(resolve));
  run("words[0].correctCount = 3; stats.totalReviews = 3; saveData()");
  const newerSave = run("saveToCloud()");
  await new Promise(resolve => setImmediate(resolve));
  const callsBeforeRelease = uploadCalls.length;
  uploadResolvers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(uploadCalls.length, callsBeforeRelease + 1, "newer write should wait for the older request");
  assert.equal(uploadCalls.at(-1).words[0].correctCount, 3, "ordered retry should contain the newest state");
  uploadResolvers.shift()();
  await Promise.all([olderSave, newerSave]);
  assert.equal(storage.has("kanjiSRSPendingSync:user-1"), false, "newest successful write should clear pending state");

  console.log("PASS: completed reviews survive refresh and overlapping cloud saves stay ordered");
})().catch(error => { console.error(error); process.exitCode = 1; });
