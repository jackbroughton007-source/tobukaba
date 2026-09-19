const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const elements = new Map();

function element(id = "") {
  if (!elements.has(id)) {
    const node = {
      id,
      style: {},
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      children: [],
      textContent: "",
      innerHTML: "",
      value: "",
      hidden: false,
      disabled: false,
      open: false,
      appendChild(child) { this.children.push(child); return child; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren(...children) { this.children = []; this.append(...children); },
      focus() {},
      getBoundingClientRect() { return { width: 134, height: 134 }; },
      setAttribute(name, value) { this[name] = String(value); },
      removeAttribute(name) { delete this[name]; },
      addEventListener() {},
      querySelector() { return null; },
      matches() { return false; },
      closest() { return null; }
    };
    elements.set(id, node);
  }
  return elements.get(id);
}

const document = {
  hidden: false,
  getElementById: element,
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement(tag) { return element(`created-${tag}-${elements.size}`); }
};

const sandbox = {
  console,
  document,
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  location: { href: "http://localhost/" },
  alert() {},
  confirm() { return true; },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  Blob,
  URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
  FileReader: class {},
  Date,
  Math,
  JSON
};
sandbox.addEventListener = function() {};
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const file of ["word-collections.js", "app.js", "auth.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

const run = code => vm.runInContext(code, sandbox);

assert.equal(run("WORD_COLLECTIONS.length"), 4);
assert.deepEqual(Array.from(run("WORD_COLLECTIONS.map(collection => collection.words.length)")), [20, 20, 20, 20]);
assert.deepEqual(Array.from(run("WORD_COLLECTIONS.slice(2).map(collection => collection.id)")), [
  "useful-opposites-and-descriptions",
  "food-and-shopping"
]);
assert.equal(run("WORD_COLLECTIONS.flatMap(collection => collection.words).every(word => word.category === 'No Category' && word.jlpt === 'Unknown')"), true);

assert.equal(run("normaliseWord({kanji:'空',hiragana:'そら',english:'sky',category:''}).category"), "No Category");
assert.equal(run("normaliseWord({kanji:'塩',hiragana:'しお',english:'salt',category:'Food'}).category"), "Food");

run(`
  words = [];
  stats = normaliseStats(null);
  userSettings = { dailyGoal: 20, chunkSize: 5 };
  activeCollectionId = "useful-everyday-verbs";
  selectedCollectionWordIds.clear();
  selectAllCollectionWords();
`);
assert.equal(run("selectedCollectionWordIds.size"), 20);
run("importSelectedCollectionWords()");
assert.equal(run("words.length"), 20);
assert.equal(run("getNewLessonWords().length"), 20);
assert.equal(run("getDueReviewWords().length"), 0);
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("stats.totalReviews"), 0);
assert.equal(run("words.every(word => word.category === 'No Category' && word.jlpt === 'Unknown')"), true);
assert.equal(run("words.every(word => word.collectionId === 'useful-everyday-verbs')"), true);
assert.equal(JSON.parse(storage.get("kanjiWords")).length, 20);

// Matching uses written form plus reading, so an exact catalogue duplicate is
// skipped while a genuinely different reading can remain a separate entry.
run(`
  words = [normaliseWord({english:"existing",kanji:"人",hiragana:"ひと",...newSrsFields()})];
  stats = normaliseStats(null);
  activeCollectionId = "everyday-life";
  selectedCollectionWordIds.clear();
  selectAllCollectionWords();
  importSelectedCollectionWords();
`);
assert.equal(run("words.length"), 20);
assert.equal(run("words.filter(word => word.kanji === '人' && word.hiragana === 'ひと').length"), 1);
assert.equal(run("stats.totalLessons + stats.totalReviews"), 0);
assert.equal(run("wordIdentity({kanji:'生',hiragana:'せい'}) === wordIdentity({kanji:'生',hiragana:'なま'})"), false);

const html = fs.readFileSync("index.html", "utf8");
assert(html.includes('<option selected>No Category</option>'), "Manual additions should default to No Category");
assert(html.includes('id="wordCollectionsPanel"'), "Vocabulary should expose the collection browser");
assert(/word-collections\.js\?v=[^"]+/.test(html), "Collection data must load before app behavior");

run("renderVocabulary()");
const renderedRow = elements.get("vocabularyTable").children[0]?.innerHTML || "";
assert.equal((renderedRow.match(/<td\b/g) || []).length, 5, "Vocabulary information should be grouped into five columns");
for (const label of ["Word", "Meaning", "Details", "Learning", "Actions"]) {
  assert(renderedRow.includes(`data-label="${label}"`), `Responsive row should include ${label}`);
}

console.log("Beginner word collection scenarios passed.");
