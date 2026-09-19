const assert = require("node:assert/strict");
const content = require("../travel-content.js");
const journey = require("../travel-system.js");

const NOW = "2026-09-18T00:00:00.000Z";
const catalog = journey.normaliseTravelContent(content);
assert.deepEqual(catalog.validationErrors, []);
assert.deepEqual(catalog.companions.map(item => item.id), ["map-tanuki"]);
assert.equal(catalog.companions[0].milestoneUnits, 8);
assert.equal(catalog.progression.requiredUnits, 30);

const duplicate = journey.normaliseTravelContent({
  ...content,
  companions: [...content.companions, { ...content.companions[0] }]
});
assert(duplicate.validationErrors.some(error => error.includes("duplicate id")));

function word(id, logs) {
  return { id, kanji: id, hiragana: `${id}-reading`, reviewLog: logs };
}

const activity = [
  word("a", [
    { activity: "lesson", rating: "good", reviewedAt: "2026-09-18T01:00:00.000Z", nextInterval: 1 },
    { activity: "review", rating: "again", reviewedAt: "2026-09-18T02:00:00.000Z", nextInterval: 1 },
    { activity: "review", rating: "good", reviewedAt: "2026-09-18T03:00:00.000Z", nextInterval: 7 },
    { activity: "review", rating: "easy", reviewedAt: "2026-09-18T04:00:00.000Z", nextInterval: 30 }
  ]),
  word("b", [{ activity: "lesson", confirmed: true, reviewedAt: "2026-09-18T05:00:00.000Z" }]),
  word("before", [{ activity: "lesson", confirmed: true, reviewedAt: "2026-09-17T23:00:00.000Z" }])
];

let state = journey.createDefaultTravelState(NOW);
let progress = journey.calculateJourneyProgress(state, activity, content);
assert.equal(progress.units, 5);
assert.equal(progress.eventIds.length, 5, "each qualifying study event counts once");
assert.equal(progress.scheduledReviewsCompleted, 3, "retries remain reviews but do not add duplicate journey units");

state = journey.synchroniseProgress(state, activity, content, "2026-09-18T06:00:00.000Z");
assert.equal(state.highestJourneyUnits, 5);
assert.deepEqual(state.unlockedCompanionIds, []);

state = journey.synchroniseProgress(state, [], content, "2026-09-18T07:00:00.000Z", 8);
assert.deepEqual(state.unlockedCompanionIds, ["map-tanuki"]);
assert.deepEqual(state.pendingCompanionIds, ["map-tanuki"], "a new discovery creates one notification");
assert.deepEqual(state.visibleCompanionIds, [], "unlocking does not choose pond visibility for the user");

state = journey.setCompanionVisible(state, "map-tanuki", true, content, "2026-09-18T08:00:00.000Z");
assert.deepEqual(state.visibleCompanionIds, ["map-tanuki"]);
state = journey.dismissCompanionNotification(state, "map-tanuki", content, "2026-09-18T09:00:00.000Z");
assert.deepEqual(state.pendingCompanionIds, []);
assert.deepEqual(state.notifiedCompanionIds, ["map-tanuki"]);

const refreshed = journey.normaliseTravelState(JSON.parse(JSON.stringify(state)), content, "2026-09-19T00:00:00.000Z");
assert.deepEqual(refreshed.visibleCompanionIds, ["map-tanuki"]);
assert.deepEqual(refreshed.pendingCompanionIds, [], "dismissed notifications do not return on reload");
assert.equal(refreshed.highestJourneyUnits, 8, "journey progress never regresses when old logs disappear");

const locked = journey.setCompanionVisible(journey.createDefaultTravelState(NOW), "map-tanuki", true, content, NOW);
assert.deepEqual(locked.visibleCompanionIds, [], "locked companions cannot be selected");

const legacy = journey.normaliseTravelState({
  activeJourney: { startedAt: NOW },
  befriendedCharacterIds: ["map-tanuki"],
  selectedCompanionId: "map-tanuki"
}, content, NOW);
assert.deepEqual(legacy.unlockedCompanionIds, ["map-tanuki"]);
assert.deepEqual(legacy.visibleCompanionIds, ["map-tanuki"]);
assert.deepEqual(legacy.pendingCompanionIds, [], "existing users are not shown a duplicate discovery notification");

const remote = journey.setCompanionVisible(state, "map-tanuki", false, content, "2026-09-20T00:00:00.000Z");
const merged = journey.mergeTravelStates(state, remote, content, "2026-09-21T00:00:00.000Z");
assert.deepEqual(merged.visibleCompanionIds, [], "newer pond choice wins during cloud merge");
assert(merged.unlockedCompanionIds.includes("map-tanuki"));

console.log("Simplified journey and companion scenarios passed.");
