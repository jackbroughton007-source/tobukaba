const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const elements = new Map();

function element(id = "") {
  if (!elements.has(id)) {
    const listeners = {};
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
      isConnected: true,
      appendChild(child) { this.children.push(child); child.isConnected = true; return child; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren(...children) {
        const disconnect = child => { child.isConnected = false; (child.children || []).forEach(disconnect); };
        this.children.forEach(disconnect);
        this.children = [];
        this.append(...children);
      },
      focus() {},
      getBoundingClientRect() { return { width: 134, height: 134 }; },
      setAttribute(name, value) { this[name] = String(value); },
      addEventListener(name, handler) { (listeners[name] ||= []).push(handler); },
      click() { (listeners.click || []).forEach(handler => handler({ target: this })); },
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
  setTimeout(fn) { return 1; },
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

vm.runInContext(fs.readFileSync("app.js", "utf8"), sandbox, { filename: "app.js" });
vm.runInContext(fs.readFileSync("auth.js", "utf8"), sandbox, { filename: "auth.js" });

function run(code) {
  return vm.runInContext(code, sandbox);
}

function resetFixture() {
  run(`
    words = [
      normaliseWord({english:"New",kanji:"新",hiragana:"しん",...newSrsFields()}),
      normaliseWord({english:"Due",kanji:"時",hiragana:"とき",...newSrsFields(),lastReviewed:"2026-09-01",lastReviewedAt:"2026-09-01T00:00:00.000Z",repetitions:2,correctCount:2,intervalDays:3,nextReviewAt:"2026-09-04T00:00:00.000Z"}),
      normaliseWord({english:"Future",kanji:"先",hiragana:"さき",...newSrsFields(),lastReviewed:"2026-09-17",lastReviewedAt:"2026-09-17T00:00:00.000Z",repetitions:2,correctCount:2,intervalDays:30,nextReviewAt:"2099-01-01T00:00:00.000Z"})
    ];
    stats = normaliseStats(null);
    userSettings = {dailyGoal:1,chunkSize:5,strokeSpeed:"standard"};
    localStorage.setItem("kanjiWords", JSON.stringify(words));
    localStorage.setItem("kanjiStats", JSON.stringify(stats));
    resetQuizScreen();
  `);
}

resetFixture();
assert.deepEqual(Array.from(run("getNewLessonWords().map(w => w.kanji)")), ["新"]);
assert.deepEqual(Array.from(run("getDueReviewWords().map(w => w.kanji)")), ["時"]);

run(`startQuiz("lessons")`);
assert.equal(run("quizMode"), "lessons");
assert.deepEqual(Array.from(run("quizWords.slice(0, quizOriginalCount).map(w => w.kanji)")), ["新"]);
assert.equal(run("lessonPhase"), "practice");
assert.equal(elements.get("reviewRatingButtons").hidden, true);
assert.equal(elements.get("lessonPracticeActions").hidden, false);
assert.equal(elements.get("lessonConfirmationActions").hidden, true);

// Review ratings cannot complete a Lesson or change its learning state.
run(`rateWord("again")`);
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("isNewWord(words[0])"), true);
assert.equal(run("getNewLessonWords().length"), 1);

// Pass 1 ends at an explicit transition before the hidden recall check.
run(`continueLessonToConfirmation()`);
assert.equal(run("lessonPhase"), "transition");
assert.equal(elements.get("lessonRoundTransition").hidden, false);
assert.equal(run("stats.totalLessons"), 0);
run(`startLessonRecallRound()`);
assert.equal(run("lessonPhase"), "confirm");
assert.equal(run("stats.totalLessons"), 0);
assert.equal(elements.get("answerRevealArea").hidden, false);
assert.equal(elements.get("lessonConfirmationActions").hidden, false);
assert.equal(elements.get("showAnswerBtn").classList.keyboardPeek, undefined);

// Review again loops to practice and still records nothing.
run(`reviewLessonAgain()`);
assert.equal(run("lessonPhase"), "retry-practice");
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("isNewWord(words[0])"), true);

// Only explicit OK in the confirmation pass completes the Lesson.
run(`continueLessonToConfirmation(); completeLesson()`);
assert.equal(run("stats.totalLessons"), 1);
assert.equal(run("stats.totalReviews"), 0);
assert.equal(run("stats.totalFailures"), 0);
assert.equal(run("words[0].failCount"), 0);
assert.equal(run("words[0].lapses"), 0);
assert.equal(run("isNewWord(words[0])"), false);
assert.equal(run("words[0].intervalDays"), 1);
assert.equal(run("words[0].reviewLog.at(-1).activity"), "lesson");
assert.equal(run("words[0].reviewLog.at(-1).rating"), "good");
assert.equal(run("getNewLessonWords().length"), 0);
assert.equal(run("getDueReviewWords().some(w => w.kanji === '新')"), false);

// Accidental repeated completion cannot count the Lesson twice.
run(`completeLesson()`);
assert.equal(run("stats.totalLessons"), 1);
assert.equal(run("stats.totalReviews"), 0);
run(`words[0].nextReviewAt = "2000-01-01T00:00:00.000Z"`);
assert.equal(run("getDueReviewWords().some(w => w.kanji === '新')"), true);

// Review history does not affect the lesson goal or block an untouched lesson.
resetFixture();
run(`stats.reviewHistory[today()] = 99; localStorage.setItem("kanjiStats", JSON.stringify(stats)); startQuiz("lessons")`);
assert.equal(run("quizOriginalCount"), 1);
assert.equal(run("getRemainingDailyLessons()"), 1);

// Abandoning either pass leaves the word untouched and available next time.
resetFixture();
run(`startQuiz("lessons"); resetQuizScreen()`);
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("isNewWord(words[0])"), true);
assert.equal(run("getNewLessonWords().length"), 1);

resetFixture();
run(`startQuiz("lessons"); continueLessonToConfirmation(); startLessonRecallRound(); resetQuizScreen()`);
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("isNewWord(words[0])"), true);

// A larger Lesson teaches the whole chunk first, then uses one stable,
// independently shuffled recall queue.
run(`
  words = ["一","二","三","四"].map((kanji,index) => normaliseWord({
    english:"New "+index,kanji,hiragana:"new"+index,...newSrsFields()
  }));
  stats = normaliseStats(null);
  userSettings = {dailyGoal:4,chunkSize:4,strokeSpeed:"standard"};
  localStorage.setItem("kanjiWords", JSON.stringify(words));
  localStorage.setItem("kanjiStats", JSON.stringify(stats));
  resetQuizScreen();
  startQuiz("lessons");
`);
const practiceOrder = Array.from(run("lessonPracticeQueue.map(word => word.kanji)"));
const recallOrder = Array.from(run("lessonRecallQueue.map(word => word.kanji)"));
assert.equal(practiceOrder.length, 4);
assert.equal(recallOrder.length, 4);
assert.notDeepEqual(recallOrder, practiceOrder, "recall should not simply repeat practice order");
assert.notEqual(recallOrder[0], practiceOrder.at(-1), "the last taught item must not be recalled first");
run(`showQuizWord(); showQuizWord()`);
assert.deepEqual(Array.from(run("lessonRecallQueue.map(word => word.kanji)")), recallOrder, "rendering must not reshuffle recall");
run(`continueLessonToConfirmation(); continueLessonToConfirmation(); continueLessonToConfirmation(); continueLessonToConfirmation()`);
assert.equal(run("lessonPhase"), "transition");
assert.equal(run("stats.totalLessons"), 0);
run(`startLessonRecallRound()`);
assert.equal(run("lessonPhase"), "confirm");
assert.equal(run("getCurrentQuizWord().kanji"), recallOrder[0]);

// Review again reteaches the item, then places its recall behind another card.
const retryKanji = run("getCurrentQuizWord().kanji");
run(`reviewLessonAgain()`);
assert.equal(run("lessonPhase"), "retry-practice");
assert.equal(run("stats.totalLessons"), 0);
run(`continueLessonToConfirmation()`);
assert.equal(run("lessonPhase"), "confirm");
assert.notEqual(run("getCurrentQuizWord().kanji"), retryKanji);
assert.equal(run("lessonRecallQueue[1].kanji"), retryKanji);

// A partial chunk counts only the item explicitly confirmed with OK.
run(`completeLesson()`);
assert.equal(run("stats.totalLessons"), 1);
assert.equal(run("words.filter(word => !isNewWord(word)).length"), 1);
run(`
  words = normaliseWords(JSON.parse(localStorage.getItem("kanjiWords")));
  stats = normaliseStats(JSON.parse(localStorage.getItem("kanjiStats")));
  resetQuizScreen();
`);
assert.equal(run("getNewLessonWords().length"), 3);

// Two-card lessons keep A before B in recall so B is not tested immediately
// after B's guided practice.
run(`
  const two = words.slice(0, 2);
  lessonPracticeQueue = two;
  lessonRecallQueue = createLessonRecallQueue(two, () => 0.99);
`);
assert.deepEqual(
  Array.from(run("lessonRecallQueue.map(word => word.kanji)")),
  Array.from(run("lessonPracticeQueue.map(word => word.kanji)"))
);

// Regression: a cloud refresh can replace canonical word objects while the
// active Lesson queue still holds its original references. A retried card's
// later OK must update the canonical collection and survive a full reload.
run(`
  words = ["食","飲"].map((kanji,index) => normaliseWord({
    english:index === 0 ? "Eat" : "Drink",kanji,hiragana:index === 0 ? "たべる" : "のむ",...newSrsFields()
  }));
  stats = normaliseStats(null);
  userSettings = normaliseSettings({dailyGoal:2,chunkSize:2,strokeSpeed:"standard"});
  localStorage.setItem("kanjiWords", JSON.stringify(words));
  localStorage.setItem("kanjiStats", JSON.stringify(stats));
  resetQuizScreen();
  startQuiz("lessons");
  continueLessonToConfirmation();
  continueLessonToConfirmation();
  startLessonRecallRound();
`);
const retriedIdentity = run("wordIdentity(getCurrentQuizWord())");
run(`reviewLessonAgain(); continueLessonToConfirmation()`);
const otherIdentity = run("wordIdentity(getCurrentQuizWord())");
assert.notEqual(otherIdentity, retriedIdentity);
run(`completeLesson()`);
assert.equal(run("stats.totalLessons"), 1);

// Reconstructing canonical runtime objects reproduces a cloud refresh while
// preserving the session's stale queue references.
run(`words = normaliseWords(JSON.parse(localStorage.getItem("kanjiWords")))`);
assert.equal(run("wordIdentity(getCurrentQuizWord())"), retriedIdentity);
run(`completeLesson()`);

// Simulate a browser refresh using only persisted state.
run(`
  words = normaliseWords(JSON.parse(localStorage.getItem("kanjiWords")));
  stats = normaliseStats(JSON.parse(localStorage.getItem("kanjiStats")));
`);
assert.equal(run("words.filter(word => !isNewWord(word)).length"), 2);
assert.equal(run("stats.totalLessons"), 2);
assert.equal(run("words.every(word => word.reviewLog.filter(entry => entry.activity === 'lesson').length === 1)"), true);
assert.equal(run("words.every(word => new Date(word.nextReviewAt).getTime() > Date.now())"), true);
assert.equal(run("getNewLessonWords().length"), 0);
assert.equal(run("currentCloudSnapshot().words.filter(word => !isNewWord(word)).length"), 2);

// Multiple retry cycles, a duplicate retry representation, and repeated OK
// still produce one canonical completion and one Lesson log.
run(`
  words = [normaliseWord({english:"Tree",kanji:"木",hiragana:"き",...newSrsFields()})];
  stats = normaliseStats(null);
  userSettings = normaliseSettings({dailyGoal:1,chunkSize:1,strokeSpeed:"standard"});
  localStorage.setItem("kanjiWords", JSON.stringify(words));
  localStorage.setItem("kanjiStats", JSON.stringify(stats));
  resetQuizScreen();
  startQuiz("lessons");
  continueLessonToConfirmation();
  startLessonRecallRound();
  reviewLessonAgain();
  continueLessonToConfirmation();
  reviewLessonAgain();
  continueLessonToConfirmation();
  lessonRecallQueue.push(lessonRecallQueue[0]);
  quizWords = lessonRecallQueue;
  completeLesson();
  completeLesson();
`);
assert.equal(run("stats.totalLessons"), 1);
assert.equal(run("words[0].reviewLog.filter(entry => entry.activity === 'lesson').length"), 1);
assert.equal(run("lessonRecallQueue.length"), 0);
assert.equal(run("normaliseWords(JSON.parse(localStorage.getItem('kanjiWords')))[0].repetitions"), 1);
assert.equal(run(`(() => {
  const learned = normaliseWords(JSON.parse(localStorage.getItem("kanjiWords")))[0];
  const stale = normaliseWord({english:"Tree",kanji:"木",hiragana:"き",...newSrsFields()});
  return isNewWord(mergeCloudWords([stale], [learned], [stale])[0]);
})()`), false, "a stale cloud word must not restore a completed Lesson to new");

// A genuine due review uses review statistics and never enters Lessons.
resetFixture();
run(`startQuiz("reviews"); rateWord("good")`);
assert.equal(run("stats.totalReviews"), 1);
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("stats.successfulReviews"), 1);
assert.equal(run("stats.reviewHistory[today()]"), 1);
assert.equal(run("words.find(w => w.kanji === '時').reviewLog.at(-1).activity"), "review");

// Meeting or exceeding the numeric goal never blocks another due review.
run(`words.find(w => w.kanji === "先").nextReviewAt = "2000-01-01T00:00:00.000Z"; updateDashboard(); startQuiz("reviews")`);
assert.equal(run("quizOriginalCount"), 1);
assert.equal(run("quizWords[0].kanji"), "先");
assert.equal(elements.get("homeReviewCta").disabled, false);
assert.equal(elements.get("todayLessons").textContent, 0);
assert.equal(elements.get("goalProgress").style.width, "0%");

// Normalization preserves legacy data and supplies new lesson fields.
run(`stats = normaliseStats({totalReviews:7,reviewHistory:{"2026-01-01":2}})`);
assert.equal(run("stats.totalReviews"), 7);
assert.equal(run("stats.totalLessons"), 0);
assert.equal(run("Object.keys(stats.lessonHistory).length"), 0);

// Stroke speed migrates safely and participates in settings reconciliation.
assert.equal(run(`normaliseSettings({dailyGoal:20,chunkSize:5}).strokeSpeed`), "standard");
assert.equal(run(`normaliseSettings({strokeSpeed:"invalid"}).strokeSpeed`), "standard");
assert.equal(run(`normaliseSettings({strokeSpeed:"relaxed"}).strokeSpeed`), "relaxed");
assert.equal(run(`mergeCloudSettings(
  {dailyGoal:20,chunkSize:5,strokeSpeed:"standard"},
  {dailyGoal:20,chunkSize:5,strokeSpeed:"quick"},
  {dailyGoal:20,chunkSize:5,strokeSpeed:"relaxed"}
).strokeSpeed`), "quick");

// Adaptive scheduling still caps intervals at one year.
run(`
  const capped = normaliseWord({english:"Cap",kanji:"年",hiragana:"ねん",...newSrsFields(),lastReviewed:"2025-01-01",lastReviewedAt:"2025-01-01T00:00:00.000Z",repetitions:20,intervalDays:365,nextReviewAt:"2025-12-31T00:00:00.000Z"});
  applySrsRating(capped,"easy",new Date("2026-09-17T00:00:00.000Z"),0.5,"review");
  if (capped.intervalDays !== 365) throw new Error("interval cap failed");
`);

function setDueReviewWords(count, chunkSize = 1) {
  run(`
    words = Array.from({length:${count}}, (_, index) => normaliseWord({
      english:"Due " + index, kanji:"語" + index, hiragana:"ご" + index,
      ...newSrsFields(), lastReviewed:"2026-09-01",
      lastReviewedAt:"2026-09-01T00:00:00.000Z", repetitions:2,
      correctCount:2, intervalDays:3, nextReviewAt:"2000-01-01T00:00:00.000Z"
    }));
    stats = normaliseStats(null);
    userSettings = {...userSettings, chunkSize:${chunkSize}};
    localStorage.setItem("kanjiWords", JSON.stringify(words));
    localStorage.setItem("kanjiStats", JSON.stringify(stats));
    resetQuizScreen();
    startQuiz("reviews");
  `);
}

// Review sessions load every due item, independently of the lesson chunk size.
setDueReviewWords(3, 1);
assert.equal(run("quizOriginalCount"), 3);
assert.equal(run("quizWords.length"), 3);

// Correct first try completes immediately without recording a mistake.
setDueReviewWords(1);
run(`rateWord("good")`);
assert.equal(run("stats.totalReviews"), 1);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).completed"), true);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).mistakes"), 0);

// A wrong answer stays incomplete, then resolves while preserving its session mistakes.
setDueReviewWords(1);
run(`rateWord("again")`);
assert.equal(run("stats.totalReviews"), 0);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).completed"), false);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).mistakes"), 1);
run(`rateWord("good")`);
assert.equal(run("stats.totalReviews"), 1);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).completed"), true);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).mistakes"), 1);

// Repeated failures accumulate on the same logical item until its correct answer.
setDueReviewWords(1);
run(`rateWord("again"); rateWord("again"); rateWord("good")`);
assert.equal(run("stats.totalReviews"), 1);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).mistakes"), 2);
assert.equal(run("quizWords.length"), 3);

// Failed items retain independent state, and the last successful retry ends the session.
setDueReviewWords(2);
run(`rateWord("again"); rateWord("again")`);
assert.equal(run("stats.totalReviews"), 0);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[0])).mistakes"), 1);
assert.equal(run("reviewSessionStates.get(wordIdentity(words[1])).mistakes"), 1);
run(`rateWord("good")`);
assert.equal(run("stats.totalReviews"), 1);
assert.equal(run("document.getElementById('quizFinished').style.display"), "none");
run(`rateWord("good")`);
assert.equal(run("stats.totalReviews"), 2);
assert.equal(run("document.getElementById('quizFinished').style.display"), "block");

console.log("Lesson/review split scenarios passed.");

module.exports = { sandbox, run, elements, storage };
