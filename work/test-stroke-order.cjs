const assert = require("node:assert/strict");
const { sandbox, run, elements } = require("./test-lesson-review-split.cjs");

const writerCalls = [];
let animateCount = 0;
const animationOrder = [];
let reducedMotion = false;
let fetchMode = "success";
let deferredFetchResolve = null;
const fetchCounts = new Map();

function response(ok, data, status = ok ? 200 : 404) {
  return { ok, status, json: async () => data };
}

sandbox.matchMedia = () => ({ matches: reducedMotion });
sandbox.HanziWriter = {
  create(target, character, options) {
    const call = { target, character, options };
    writerCalls.push(call);
    return {
      animateCharacter({ onComplete } = {}) {
        animateCount++;
        animationOrder.push(character);
        if (onComplete) onComplete();
      },
      hideCharacter({ onComplete } = {}) { if (onComplete) onComplete(); },
      pauseAnimation() {},
      cancelQuiz() {}
    };
  }
};
sandbox.fetch = async url => {
  const character = decodeURIComponent(url.match(/\/([^/]+)\.json$/)[1]);
  fetchCounts.set(character, (fetchCounts.get(character) || 0) + 1);
  if (fetchMode === "deferred") return new Promise(resolve => { deferredFetchResolve = resolve; });
  if (fetchMode === "network") throw new Error("offline");
  if (character === "𠮷") return response(false, null, 404);
  return response(true, { strokes: ["M0 0"] });
};

function setWord(kanji) {
  run(`
    words = [normaliseWord({english:"Test",kanji:${JSON.stringify(kanji)},hiragana:"test",...newSrsFields()})];
    quizWords = words.slice();
    quizIndex = 0;
    resetStrokeOrderGuidance();
    unlockStrokeOrderGuidance();
    document.getElementById("strokeOrderSection").hidden = false;
  `);
}

(async () => {
  assert.equal(fetchCounts.size, 0, "stroke data must not load during initial page setup");
  run("resetStrokeOrderGuidance()");
  assert.equal(elements.get("strokeOrderButton").hidden, true);
  run("unlockStrokeOrderGuidance()");
  assert.equal(elements.get("strokeOrderButton").hidden, false);
  assert.deepEqual(Array.from(run(`extractKanjiCharacters("警察・けいさつ ABC")`)), ["警", "察"]);

  setWord("警察");
  await run("renderStrokeOrderGuidance()");
  assert.deepEqual(writerCalls.slice(-2).map(call => call.character), ["警", "察"]);
  assert.deepEqual(animationOrder.slice(-2), ["警", "察"], "characters must animate sequentially in written order");
  assert.equal(elements.get("strokeOrderStatus").textContent.startsWith("Stroke order complete"), true);

  setWord("学校");
  await run("renderStrokeOrderGuidance({guided:true})");
  const guidedCalls = writerCalls.slice(-2);
  assert.deepEqual(guidedCalls.map(call => call.character), ["学", "校"]);
  assert.deepEqual(animationOrder.slice(-2), ["学", "校"]);
  assert.equal(guidedCalls.every(call => call.options.strokeAnimationSpeed === 1), true);
  assert.equal(guidedCalls.every(call => call.options.delayBetweenStrokes === 180), true);

  const relaxed = run(`getStrokeAnimationTiming("relaxed")`);
  const standard = run(`getStrokeAnimationTiming("standard")`);
  const quick = run(`getStrokeAnimationTiming("quick")`);
  assert.equal(relaxed.strokeAnimationSpeed < standard.strokeAnimationSpeed, true);
  assert.equal(standard.strokeAnimationSpeed < quick.strokeAnimationSpeed, true);
  assert.equal(run(`getStrokeAnimationTiming("invalid").strokeAnimationSpeed`), standard.strokeAnimationSpeed);

  run(`userSettings.strokeSpeed = "relaxed"`);
  setWord("川");
  await run("renderStrokeOrderGuidance({guided:true})");
  assert.equal(writerCalls.at(-1).options.strokeAnimationSpeed, 0.55);
  run(`userSettings.strokeSpeed = "quick"`);
  setWord("火");
  await run("renderStrokeOrderGuidance()");
  assert.equal(writerCalls.at(-1).options.strokeAnimationSpeed, 1.65);
  run(`userSettings.strokeSpeed = "standard"`);

  elements.get("strokeSpeedInput").value = "relaxed";
  await run("previewStrokeSpeedSetting()");
  assert.equal(writerCalls.at(-1).character, "日");
  assert.equal(writerCalls.at(-1).options.strokeAnimationSpeed, 0.55);
  elements.get("strokeSpeedInput").value = "quick";
  await run("previewStrokeSpeedSetting()");
  assert.equal(writerCalls.at(-1).options.strokeAnimationSpeed, 1.65, "changing the setting should replay the preview at the new speed");

  setWord("々警警");
  await run("renderStrokeOrderGuidance()");
  const repeated = writerCalls.slice(-2);
  assert.deepEqual(repeated.map(call => call.character), ["警", "警"]);
  assert.notEqual(repeated[0].target.id, repeated[1].target.id);
  assert.equal(fetchCounts.get("警"), 1, "successful character data should be cached");

  setWord("かな・ABC");
  await run("renderStrokeOrderGuidance()");
  assert.equal(elements.get("strokeOrderStatus").textContent, "Stroke order isn’t available for this word yet.");

  setWord("警𠮷");
  await run("renderStrokeOrderGuidance()");
  assert.equal(elements.get("strokeOrderStatus").textContent.startsWith("1 of 2"), true);

  fetchMode = "network";
  setWord("龘");
  await run("renderStrokeOrderGuidance()");
  assert.equal(elements.get("strokeOrderStatus").textContent.includes("isn’t available"), true);

  fetchMode = "deferred";
  setWord("鬱");
  const writersBeforeStaleRequest = writerCalls.length;
  const staleRender = run("renderStrokeOrderGuidance()");
  run("resetStrokeOrderGuidance()");
  deferredFetchResolve(response(true, { strokes: ["M0 0"] }));
  await staleRender;
  assert.equal(writerCalls.length, writersBeforeStaleRequest, "a stale response must not create a writer");

  // Guided practice can be left immediately while data is still loading.
  fetchMode = "deferred";
  run(`
    words = [normaliseWord({english:"Dragon",kanji:"龍",hiragana:"りゅう",...newSrsFields()})];
    lessonPracticeQueue = words.slice();
    lessonRecallQueue = words.slice();
    lessonRetryWord = null;
    quizWords = lessonPracticeQueue;
    quizIndex = 0;
    quizOriginalCount = 1;
    quizMode = "lessons";
    lessonPhase = "practice";
    resetStrokeOrderGuidance();
    configureStudyControls();
  `);
  const pendingPractice = run("beginLessonPractice()");
  assert.equal(elements.get("lessonPracticeContinue").disabled, false, "Continue must be enabled immediately");
  run("continueLessonToConfirmation()");
  assert.equal(run("lessonPhase"), "transition");
  deferredFetchResolve(response(true, { strokes: ["M0 0"] }));
  await pendingPractice;
  assert.equal(run("lessonPhase"), "transition", "late stroke data must not reopen the practice card");

  fetchMode = "success";
  reducedMotion = true;
  setWord("森");
  const animationsBefore = animateCount;
  await run("renderStrokeOrderGuidance()");
  const reducedCall = writerCalls.at(-1);
  assert.equal(reducedCall.options.showCharacter, true);
  assert.equal(animateCount, animationsBefore, "reduced motion must not autoplay");

  reducedMotion = false;
  setWord("山");
  await run("renderStrokeOrderGuidance()");
  const cards = elements.get("strokeOrderCharacters").children;
  const replay = cards[0].children.at(-1);
  const beforeReplay = animateCount;
  replay.click();
  assert.equal(animateCount, beforeReplay + 1);

  console.log("Stroke-order guidance scenarios passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
