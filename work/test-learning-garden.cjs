const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const elements = new Map();

function element(id = "") {
  if (!elements.has(id)) {
    const listeners = {};
    const classes = new Set();
    const node = {
      id,
      style: { setProperty(name, value) { this[name] = value; } },
      dataset: {},
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); },
        toggle(name, force) {
          const enabled = force === undefined ? !classes.has(name) : Boolean(force);
          if (enabled) classes.add(name); else classes.delete(name);
          return enabled;
        }
      },
      children: [],
      textContent: "",
      innerHTML: "",
      value: "",
      hidden: false,
      disabled: false,
      isConnected: true,
      appendChild(child) { this.children.push(child); child.parentNode = this; child.isConnected = true; return child; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren(...children) { this.children = []; this.append(...children); },
      focus() {},
      scrollIntoView() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 134, height: 134 }; },
      setAttribute(name, value) { this[name] = String(value); },
      addEventListener(name, handler) { (listeners[name] ||= []).push(handler); },
      dispatch(name) { (listeners[name] || []).forEach(handler => handler({ target: this, currentTarget: this })); },
      click() { (listeners.click || []).forEach(handler => handler({ target: this, currentTarget: this, detail: 0, clientX: 0, clientY: 0 })); },
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === ".garden-reaction" ? this.children.filter(child => child.className?.includes("garden-reaction")) : []; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); },
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
sandbox.reduceMotion = false;
sandbox.matchMedia = function() { return { matches: sandbox.reduceMotion }; };
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync("app.js", "utf8"), sandbox, { filename: "app.js" });
vm.runInContext(fs.readFileSync("auth.js", "utf8"), sandbox, { filename: "auth.js" });

function run(code) {
  return vm.runInContext(code, sandbox);
}

// The awake mascot remains the fallback until the sleeping asset loads.
const gardenScene = element("learningGardenScene");
const sleepingMascot = element("gardenSleepingTobuKaba");
sleepingMascot.complete = false;
run("prepareGardenMascotSwap()");
assert.equal(gardenScene.classList.contains("sleeping-mascot-ready"), false);
sleepingMascot.naturalWidth = 1374;
sleepingMascot.dispatch("load");
assert.equal(gardenScene.classList.contains("sleeping-mascot-ready"), true);
sleepingMascot.dispatch("error");
assert.equal(gardenScene.classList.contains("sleeping-mascot-ready"), false);

run(`
  function gardenFixtureWord(index, intervalDays = 1, learned = true) {
    const day = String((index % 28) + 1).padStart(2, "0");
    return normaliseWord({
      english: "Word " + index,
      kanji: "語" + index,
      hiragana: "ご" + index,
      ...newSrsFields(),
      intervalDays,
      repetitions: learned ? 1 : 0,
      lastReviewed: learned ? "2026-01-" + day : null,
      lastReviewedAt: learned ? "2026-01-" + day + "T00:00:00.000Z" : null,
      reviewLog: learned ? [{activity:"lesson", reviewedAt:"2026-01-" + day + "T00:00:00.000Z"}] : []
    });
  }
  words = Array.from({length: 41}, (_, index) => gardenFixtureWord(index + 1));
  words.push(gardenFixtureWord(99, 0, false));
  stats = normaliseStats(null);
  userSettings = normaliseSettings(null);
  userSettings.gardenState.startedAt = "2026-06-01T00:00:00.000Z";
  synchroniseGardenState();
`);

assert.deepEqual(Array.from(run("userSettings.gardenState.plots.map(plot => plot.wordKeys.length)")), [10, 0, 0, 0]);
assert.equal(run("userSettings.gardenState.plots.flatMap(plot => plot.wordKeys).length"), 10);
assert.equal(run("userSettings.gardenState.plots.flatMap(plot => plot.wordKeys).some(key => key.includes('語99'))"), false);

// Later plots use only Lessons completed after the garden was introduced.
run(`
  words.push(...Array.from({length:20}, (_, offset) => {
    const word = gardenFixtureWord(100 + offset);
    const learnedAt = "2026-07-" + String(offset + 1).padStart(2, "0") + "T00:00:00.000Z";
    word.lastReviewed = learnedAt.slice(0, 10);
    word.lastReviewedAt = learnedAt;
    word.reviewLog = [{activity:"lesson", reviewedAt:learnedAt}];
    return word;
  }));
  synchroniseGardenState();
`);
assert.deepEqual(Array.from(run("userSettings.gardenState.plots.map(plot => plot.wordKeys.length)")), [10, 10, 10, 0]);

// Once assigned, inserting a learned word with an earlier timestamp does not reshuffle plots.
const originalAssignment = run("JSON.stringify(userSettings.gardenState.plots.map(plot => plot.wordKeys))");
run(`
  words.unshift(normaliseWord({
    english:"Older", kanji:"古語", hiragana:"こご", ...newSrsFields(), intervalDays:60,
    repetitions:1, lastReviewed:"2020-01-01", lastReviewedAt:"2020-01-01T00:00:00.000Z",
    reviewLog:[{activity:"lesson", reviewedAt:"2020-01-01T00:00:00.000Z"}]
  }));
  synchroniseGardenState();
`);
assert.equal(run("JSON.stringify(userSettings.gardenState.plots.map(plot => plot.wordKeys))"), originalAssignment);

// Plant choice is allowed only when a plot has ten learned words, and remains changeable.
run("chooseGardenPlant('plot-1', 'maple')");
assert.equal(run("userSettings.gardenState.plots[0].plant"), "maple");
run("chooseGardenPlant('plot-1', 'hydrangea')");
assert.equal(run("userSettings.gardenState.plots[0].plant"), "hydrangea");

// Existing intervals alone do not grow a newly chosen plant.
run(`
  const firstPlotKeys = new Set(userSettings.gardenState.plots[0].wordKeys);
  words.filter(word => firstPlotKeys.has(wordIdentity(word))).slice(0, 6).forEach(word => word.intervalDays = 60);
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.plots[0].highestStage"), "planted");

// Six qualifying Reviews after planting advance through the real SRS milestones.
run(`
  words.filter(word => firstPlotKeys.has(wordIdentity(word))).slice(0, 6).forEach(word => {
    word.intervalDays = 7;
    word.reviewLog.push({activity:"review", rating:"good", reviewedAt:"2030-01-01T00:00:00.000Z"});
  });
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.plots[0].highestStage"), "taking-root");
run(`
  words.filter(word => firstPlotKeys.has(wordIdentity(word))).slice(0, 6).forEach(word => word.intervalDays = 30);
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.plots[0].highestStage"), "growing-well");
run(`
  words.filter(word => firstPlotKeys.has(wordIdentity(word))).slice(0, 6).forEach(word => word.intervalDays = 60);
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.plots[0].highestStage"), "flourishing");

// A later lapse or deleted vocabulary item cannot visually regress earned growth.
run(`
  words.filter(word => firstPlotKeys.has(wordIdentity(word))).forEach(word => word.intervalDays = 1);
  words = words.filter(word => wordIdentity(word) !== userSettings.gardenState.plots[0].wordKeys[0]);
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.plots[0].highestStage"), "flourishing");

// Seven distinct active days permanently unlock the visiting bird.
run(`
  stats.reviewHistory = {"2026-09-01":1,"2026-09-02":2,"2026-09-03":1,"2026-09-04":1};
  stats.lessonHistory = {"2026-09-04":2,"2026-09-05":1,"2026-09-06":1,"2026-09-07":1};
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.unlockedAmbience.includes('visiting-bird')"), true);
run("stats.reviewHistory = {}; stats.lessonHistory = {}; synchroniseGardenState()");
assert.equal(run("userSettings.gardenState.unlockedAmbience.includes('visiting-bird')"), true);
run("saveData()");
assert.equal(JSON.parse(storage.get("kanjiSRSSettings")).gardenState.unlockedAmbience.includes("visiting-bird"), true);

// Legacy settings migrate to the complete four-plot schema without losing their values.
run("userSettings = normaliseSettings({dailyGoal:31, chunkSize:7})");
assert.equal(run("userSettings.dailyGoal"), 31);
assert.equal(run("userSettings.chunkSize"), 7);
assert.equal(run("userSettings.gardenState.plots.length"), 4);

// Version 1 gardens retain choices but historical vocabulary prepares at most one plot.
run(`
  words = Array.from({length:40}, (_, index) => gardenFixtureWord(index + 1));
  userSettings.gardenState = normaliseGardenState({
    plots:Array.from({length:4}, (_, index) => ({
      id:"plot-" + (index + 1),
      plant:index === 1 ? "maple" : null,
      wordKeys:words.slice(index * 10, index * 10 + 10).map(wordIdentity),
      highestStage:index === 0 ? "taking-root" : "planted"
    })),
    unlockedAmbience:[]
  });
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.version"), 2);
assert.deepEqual(Array.from(run("userSettings.gardenState.plots.map(plot => plot.wordKeys.length)")), [10, 0, 0, 0]);
assert.equal(run("userSettings.gardenState.plots[1].plant"), "maple");
assert.equal(run("userSettings.gardenState.plots[1].highestStage"), "preparing");

// A pending legacy choice becomes active when ten genuinely new Lessons arrive.
run(`
  words.push(...Array.from({length:10}, (_, offset) => {
    const word = gardenFixtureWord(200 + offset);
    const learnedAt = "2035-01-" + String(offset + 1).padStart(2, "0") + "T00:00:00.000Z";
    word.lastReviewed = learnedAt.slice(0, 10);
    word.lastReviewedAt = learnedAt;
    word.reviewLog = [{activity:"lesson", reviewedAt:learnedAt}];
    return word;
  }));
  synchroniseGardenState();
`);
assert.equal(run("userSettings.gardenState.plots[1].wordKeys.length"), 10);
assert.equal(run("userSettings.gardenState.plots[1].plant"), "maple");
assert.equal(run("Boolean(userSettings.gardenState.plots[1].plantedAt)"), true);

run(`
  words = Array.from({length: 9}, (_, index) => gardenFixtureWord(index + 1));
  userSettings.gardenState = createDefaultGardenState();
  chooseGardenPlant("plot-1", "wildflowers");
`);
assert.equal(run("userSettings.gardenState.plots[0].plant"), null);

// Garden interactions remain bounded, keyboard-native, and motion-aware.
const hippoButton = element("gardenTobuKabaButton");
const hippoGeometryBefore = hippoButton.getBoundingClientRect();
run("triggerGardenTobuKabaBlink()");
assert.equal(hippoButton.classList.contains("is-blinking"), true);
const hippoGeometryDuring = hippoButton.getBoundingClientRect();
assert.deepEqual(hippoGeometryDuring, hippoGeometryBefore);
hippoButton.classList.remove("is-blinking");
const hippoGeometryAfter = hippoButton.getBoundingClientRect();
assert.deepEqual(hippoGeometryAfter, hippoGeometryBefore);

const pond = element("gardenPond");
sandbox.pondFixture = pond;
run("createGardenPondReaction({currentTarget:pondFixture,detail:0,clientX:0,clientY:0})");
assert.equal(pond.querySelectorAll(".garden-reaction").length, 5);
run("clearGardenPondReactions(pondFixture)");
assert.equal(pond.querySelectorAll(".garden-reaction").length, 0);

const maturePlot = element("matureGardenPlot");
maturePlot.dataset.stage = "flourishing";
maturePlot.dataset.plant = "wildflowers";
sandbox.maturePlotFixture = maturePlot;
run("triggerGardenPlantSway({currentTarget:maturePlotFixture})");
assert.equal(maturePlot.classList.contains("is-swaying"), true);

sandbox.reduceMotion = true;
hippoButton.classList.remove("is-blinking");
run("triggerGardenTobuKabaBlink()");
assert.equal(hippoButton.classList.contains("is-blinking"), false);
run("createGardenPondReaction({currentTarget:pondFixture,detail:0,clientX:0,clientY:0})");
assert.equal(pond.querySelectorAll(".garden-reaction").length, 0);

const gardenMarkup = fs.readFileSync("index.html", "utf8");
assert.match(gardenMarkup, /<button[^>]+id="gardenPond"[^>]+aria-label="Make ripples in the Home Pond"/);
assert.match(gardenMarkup, /<button[^>]+id="gardenTobuKabaButton"[^>]+aria-label="Make TobuKaba blink"/);
assert.match(gardenMarkup, /tobukaba-garden-blink\.png/);
assert.match(gardenMarkup, /id="homePondEnvironment"/);
assert.match(gardenMarkup, /id="homePondMotion"/);
assert.match(gardenMarkup, /id="homePondCape"[^>]+cape-draped-v3\.png/);

const gardenStyles = fs.readFileSync("styles.css", "utf8");
assert.match(gardenStyles, /\.travel-home-scene\s*\{[\s\S]*aspect-ratio:1672 \/ 941/);
assert.match(gardenStyles, /\.home-pond-layer\s*\{[\s\S]*z-index:var\(--home-pond-layer-depth,1\)/);
assert.match(gardenStyles, /\.travel-home-scene \.garden-tobukaba-button,[\s\S]*transform:translate\(-50%,-50%\) !important;[\s\S]*transition:none !important;/);
assert.match(gardenStyles, /\.travel-home-scene \.garden-tobukaba-button \.garden-resting-tobukaba[\s\S]*mask-image:none/);
assert.match(gardenStyles, /\.travel-home-scene \.pond-visitor:hover,[\s\S]*transform:translate\(-50%,-50%\);[\s\S]*transition:none/);
assert.match(gardenStyles, /\.home-pond-cape\s*\{[\s\S]*inset:0;[\s\S]*object-fit:fill;[\s\S]*transform:none;/);
assert.match(gardenStyles, /@media \(prefers-reduced-motion:reduce\)[\s\S]*home-pond-water-reflections[\s\S]*animation:none !important/);
assert.match(gardenStyles, /@media \(prefers-reduced-motion:reduce\)[\s\S]*home-pond-cloud-loop[\s\S]*display:none/);
assert.match(gardenStyles, /@media \(prefers-reduced-motion:reduce\)[\s\S]*home-pond-lily-path[\s\S]*display:none/);
assert.match(gardenStyles, /@media \(prefers-reduced-motion:reduce\)[\s\S]*home-pond-artwork-accent[\s\S]*display:none/);
assert.match(gardenStyles, /\.travel-home-scene::after\s*\{\s*display:none;\s*\}/);
assert.match(gardenStyles, /\.garden-plot-visual::before[\s\S]*var\(--garden-soil\)/);

console.log("Learning Garden scenarios passed.");
