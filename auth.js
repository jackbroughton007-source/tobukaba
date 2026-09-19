/*
  SUPABASE SETUP
  1. Create a project at https://supabase.com
  2. In Project Settings > API, copy the Project URL and publishable/anon key.
  3. Paste them below. The anon key is designed to be used in a browser; the
     database rules in supabase-schema.sql protect each user's data.
*/
const SUPABASE_URL = "https://snayzoqyylcnmclxjfpd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XsVrmjyipMMwb7vayFxCZw_8CT-vU7-";
const supabaseConfigured =
    !SUPABASE_URL.includes("PASTE_YOUR") &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR") &&
    window.supabase;
const supabaseClient = supabaseConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

let currentUser = null;

let cloudSaveTimer = null;
let cloudSaveInFlight = null;
let cloudRefreshInFlight = null;
let cloudRevision = 0;
let lastCloudSnapshot = null;
let profileChangesChannel = null;
let cloudPollTimer = null;
let isLoadingCloudData = false;

const CLOUD_PENDING_PREFIX = "kanjiSRSPendingSync:";
const CLOUD_BASE_PREFIX = "kanjiSRSCloudBase:";
const CLOUD_POLL_INTERVAL_MS = 60 * 1000;

function getPendingCloudKey() {
    return currentUser ? `${CLOUD_PENDING_PREFIX}${currentUser.id}` : null;
}

function getPendingCloudRevision() {
    const key = getPendingCloudKey();
    return key ? localStorage.getItem(key) : null;
}

function getCloudBaseKey() {
    return currentUser ? `${CLOUD_BASE_PREFIX}${currentUser.id}` : null;
}

function cloneCloudValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function makeJsonbSafe(value) {
    if (typeof value === "string") return value.replaceAll("\u0000", "\u241f");
    if (Array.isArray(value)) return value.map(makeJsonbSafe);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key.replaceAll("\u0000", "\u241f"),
            makeJsonbSafe(item)
        ]));
    }
    return value;
}

function readCloudBase() {
    const key = getCloudBaseKey();
    if (!key) return null;
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value === "object" ? value : null;
    } catch (_) {
        return null;
    }
}

function writeCloudBase(snapshot) {
    const key = getCloudBaseKey();
    if (!key || !snapshot) return;
    lastCloudSnapshot = cloneCloudValue(snapshot);
    localStorage.setItem(key, JSON.stringify(lastCloudSnapshot));
}

function markCloudSavePending() {
    const key = getPendingCloudKey();
    if (!key) return null;

    // A unique token prevents an older in-flight request from marking a
    // newer review as synced.
    const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, revision);
    return revision;
}

let userSettings = normaliseSettings(JSON.parse(localStorage.getItem("kanjiSRSSettings")));

const LEECH_LIMIT = 8;

/*
Adaptive SRS. Each word carries its own interval and ease. The 365-day cap
keeps long-term vocabulary in rotation instead of permanently retiring it.
*/
const SRS = {
    version: 2,
    maxInterval: 365,
    longTermInterval: 60,
    initialEase: 2.3,
    minimumEase: 1.3,
    maximumEase: 3,
    fuzz: 0.05
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function newSrsFields() {
    return {
        srsVersion: SRS.version,
        intervalDays: 0,
        easeFactor: SRS.initialEase,
        repetitions: 0,
        lapses: 0,
        reviewLog: [],
        correctCount: 0,
        failCount: 0,
        dueDate: today(),
        nextReviewAt: new Date().toISOString(),
        lastReviewed: null,
        lastReviewedAt: null
    };
}

function legacyInterval(word) {
    const savedInterval = Number(word.intervalDays);
    if (Number.isFinite(savedInterval) && savedInterval >= 0) {
        return clamp(Math.round(savedInterval), 0, SRS.maxInterval);
    }

    const legacyProgress = clamp(Number(word.correctCount) || 0, 0, 5);
    const legacyDue = String(word.nextReviewAt || word.dueDate || "");
    if (legacyProgress >= 5 || legacyDue.startsWith("9999-")) return 90;

    if (word.lastReviewed && word.nextReviewAt) {
        const last = new Date(`${word.lastReviewed}T00:00:00`).getTime();
        const next = new Date(word.nextReviewAt).getTime();
        const inferred = Math.round((next - last) / DAY_MS);
        if (Number.isFinite(inferred) && inferred > 0) {
            return clamp(inferred, 1, SRS.maxInterval);
        }
    }

    return [0, 1, 3, 7, 14, 90][legacyProgress];
}

function normaliseWord(word) {
    const legacyProgress = clamp(Number(word.correctCount) || 0, 0, 5);
    const wasPermanentlyRetired = legacyProgress >= 5 ||
        String(word.nextReviewAt || word.dueDate || "").startsWith("9999-");
    const intervalDays = legacyInterval(word);
    const lastReviewed = word.lastReviewed ?? null;
    const fallbackLastReviewedTime = lastReviewed
        ? new Date(`${lastReviewed}T00:00:00`).getTime()
        : NaN;
    const fallbackLastReviewedAt = Number.isFinite(fallbackLastReviewedTime)
        ? new Date(fallbackLastReviewedTime).toISOString()
        : null;

    let nextReviewAt = word.nextReviewAt ?? (word.dueDate
        ? new Date(`${word.dueDate}T00:00:00`).toISOString()
        : new Date().toISOString());

    // Old Burned cards were hidden until year 9999. Bring them back gently,
    // once, at the Long-term cadence instead of making them due immediately.
    if (Number(word.srsVersion) < SRS.version && wasPermanentlyRetired) {
        nextReviewAt = new Date(Date.now() + intervalDays * DAY_MS).toISOString();
    }

    const nextReviewTime = new Date(nextReviewAt).getTime();
    if (!Number.isFinite(nextReviewTime)) nextReviewAt = new Date().toISOString();

    const repetitions = Math.max(0, Number(word.repetitions) || legacyProgress);
    const failCount = Math.max(0, Number(word.failCount) || 0);

    return {
        ...word,
        srsVersion: SRS.version,
        intervalDays,
        easeFactor: clamp(Number(word.easeFactor) || SRS.initialEase, SRS.minimumEase, SRS.maximumEase),
        repetitions,
        lapses: Math.max(0, Number(word.lapses) || failCount),
        reviewLog: Array.isArray(word.reviewLog) ? word.reviewLog : [],
        // Kept for backwards-compatible backups; scheduling no longer uses it.
        correctCount: Math.min(5, repetitions),
        failCount,
        dueDate: todayFromDate(new Date(nextReviewAt)),
        nextReviewAt,
        jlpt: String(word.jlpt || "").trim() || "Unknown",
        category: String(word.category || "").trim() || "No Category",
        pos: word.pos ?? "Other",
        lastReviewed,
        lastReviewedAt: word.lastReviewedAt ?? fallbackLastReviewedAt
    };
}


/* =========================================================
   DEFAULT WORDS
========================================================= */

const defaultWords = [

{
english:"Police",
kanji:"警察",
hiragana:"けいさつ",
jlpt:"N3",
category:"Daily Life",
pos:"Noun"
},

{
english:"Youth",
kanji:"青春",
hiragana:"せいしゅん",
jlpt:"N2",
category:"Daily Life",
pos:"Noun"
},

{
english:"Certificate",
kanji:"証明書",
hiragana:"しょうめいしょ",
jlpt:"N2",
category:"Daily Life",
pos:"Noun"
},

{
english:"Crybaby",
kanji:"泣き虫",
hiragana:"なきむし",
jlpt:"N2",
category:"Daily Life",
pos:"Noun"
},

{
english:"Detailed",
kanji:"詳しい",
hiragana:"くわしい",
jlpt:"N3",
category:"Daily Life",
pos:"い-adjective"
},

{
english:"Salt",
kanji:"塩",
hiragana:"しお",
jlpt:"N5",
category:"Food",
pos:"Noun"
},

{
english:"Failure",
kanji:"失敗",
hiragana:"しっぱい",
jlpt:"N3",
category:"Daily Life",
pos:"Noun"
},

{
english:"Same as ever",
kanji:"相変わらず",
hiragana:"あいかわらず",
jlpt:"N2",
category:"Expressions",
pos:"Expression"
},

{
english:"Signature",
kanji:"署名",
hiragana:"しょめい",
jlpt:"N2",
category:"Daily Life",
pos:"Noun"
},

{
english:"Empty seat",
kanji:"空席",
hiragana:"くうせき",
jlpt:"N2",
category:"Daily Life",
pos:"Noun"
},

{
english:"Atom",
kanji:"原子",
hiragana:"げんし",
jlpt:"N2",
category:"Science",
pos:"Noun"
}

];


/* =========================================================
   DATA
========================================================= */

function normaliseWords(savedWords) {

    if (!Array.isArray(savedWords)) {
        return defaultWords.map(word => ({ ...word, ...newSrsFields() }));
    }

    return savedWords.map(normaliseWord);
}

function normaliseStats(savedStats) {
    const source = savedStats && typeof savedStats === "object" ? savedStats : {};
    return {
        totalReviews: Number(source.totalReviews) || 0,
        successfulReviews: Number(source.successfulReviews) || 0,
        totalFailures: Number(source.totalFailures) || 0,
        totalLessons: Number(source.totalLessons) || 0,
        xp: Number(source.xp) || 0,
        reviewHistory: source.reviewHistory || {},
        lessonHistory: source.lessonHistory || {},
        lastStudyDate: source.lastStudyDate ?? null,
        streak: Number(source.streak) || 0
    };
}

function normaliseSettings(savedSettings) {
    const source = savedSettings && typeof savedSettings === "object" ? savedSettings : {};
    const gardenState = normaliseGardenState(source.gardenState);
    const now = new Date().toISOString();
    const travelState = globalThis.TobuKabaTravel
        ? globalThis.TobuKabaTravel.migrateGardenStateToTravelState(
            gardenState,
            source.travelState,
            globalThis.TOBUKABA_TRAVEL_CONTENT,
            now
        )
        : source.travelState || null;
    const strokeSpeed = ["relaxed", "standard", "quick"].includes(source.strokeSpeed)
        ? source.strokeSpeed
        : DEFAULT_SETTINGS.strokeSpeed;
    return {
        dailyGoal: Math.max(1, Math.min(500, parseInt(source.dailyGoal, 10) || DEFAULT_SETTINGS.dailyGoal)),
        chunkSize: Math.max(1, Math.min(100, parseInt(source.chunkSize, 10) || DEFAULT_SETTINGS.chunkSize)),
        strokeSpeed,
        gardenState,
        travelState
    };
}

// This is captured before normalisation writes any defaults. A device that
// already had TobuKaba data before revisioned sync must reconcile that copy
// once, even if the legacy client previously considered it "synced".
const hadLocalStudyDataAtStartup = ["kanjiWords", "kanjiStats", "kanjiSRSSettings"]
    .some(key => localStorage.getItem(key) !== null);

let words = normaliseWords(JSON.parse(localStorage.getItem("kanjiWords")));
// Persist local migrations immediately so a legacy Long-term due date does
// not restart on each reload before the learner next reviews a word.
localStorage.setItem("kanjiWords", JSON.stringify(words));


/* =========================================================
   USER STATS
========================================================= */

let stats = normaliseStats(JSON.parse(localStorage.getItem("kanjiStats")));


/* =========================================================
   QUIZ VARIABLES
========================================================= */

let quizWords = [];
// Number of distinct cards originally loaded into this session.
// Relearning retries do not increase this count.
let quizOriginalCount = 0;

// One state object exists for each review item for the duration of its
// session. Requeueing always refers back to this state rather than creating
// a new logical review item.
let reviewSessionStates = new Map();

// Cards rated Again are placed back into the current session. The retry is a
// confirmation attempt: it does not give the card a second SRS progression
// step. It must be passed before the session ends.
let quizRelearningIndexes = new Set();

let quizIndex = 0;
// The active queue is always explicit: untouched words are lessons and
// previously learned, scheduled words are reviews.
let quizMode = "reviews";
// Lesson progress is intentionally session-only. Abandoning or refreshing a
// lesson never promotes a new word into the learned/SRS state.
let lessonPhase = "practice";
let lessonCompletedThisSession = 0;
let lessonPracticeQueue = [];
let lessonRecallQueue = [];
let lessonRetryWord = null;
let lastQuizState = null;


/* =========================================================
   DATE FUNCTIONS
========================================================= */

function today() {

    const d = new Date();

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;

}


function addDays(dateString, days) {

    const date = new Date(dateString + "T00:00:00");

    date.setDate(date.getDate() + days);

    return todayFromDate(date);

}


function todayFromDate(date) {

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;

}


function setNextReview(word, intervalDays, reviewedAt = new Date()) {

    const safeInterval = clamp(Math.round(intervalDays), 1, SRS.maxInterval);
    const next = new Date(reviewedAt.getTime() + safeInterval * DAY_MS);
    word.intervalDays = safeInterval;
    word.nextReviewAt = next.toISOString();
    word.dueDate = todayFromDate(next);

}


function isLongTerm(word) {
    const hasBeenReviewed = Boolean(word.lastReviewedAt || word.lastReviewed) ||
        Number(word.repetitions) > 0;
    return hasBeenReviewed && Number(word.intervalDays) >= SRS.longTermInterval;
}


function isDue(word) {

    const next = word.nextReviewAt
        ? new Date(word.nextReviewAt).getTime()
        : new Date((word.dueDate || today()) + "T00:00:00").getTime();

    return Number.isFinite(next) && next <= Date.now();

}


function isLeech(word) {

    return word.failCount >= LEECH_LIMIT;

}

function fuzzInterval(interval, randomValue = Math.random()) {
    const rounded = Math.round(interval);
    if (rounded < 4 || rounded >= SRS.maxInterval) {
        return clamp(rounded, 1, SRS.maxInterval);
    }

    const boundedRandom = clamp(Number(randomValue) || 0, 0, 1);
    const factor = 1 - SRS.fuzz + boundedRandom * SRS.fuzz * 2;
    return clamp(Math.round(interval * factor), 1, SRS.maxInterval);
}

function calculateNextInterval(word, rating, reviewedAt = new Date(), randomValue = Math.random()) {
    const previousInterval = clamp(Number(word.intervalDays) || 0, 0, SRS.maxInterval);
    const ease = clamp(Number(word.easeFactor) || SRS.initialEase, SRS.minimumEase, SRS.maximumEase);
    const repetitions = Math.max(0, Number(word.repetitions) || 0);
    const previousReviewTime = word.lastReviewedAt
        ? new Date(word.lastReviewedAt).getTime()
        : NaN;
    const elapsedDays = Number.isFinite(previousReviewTime)
        ? Math.max(0, (reviewedAt.getTime() - previousReviewTime) / DAY_MS)
        : previousInterval;
    const overdueDays = Math.max(0, elapsedDays - previousInterval);

    let interval;
    if (rating === "again") {
        interval = previousInterval <= 1 ? 1 : previousInterval * 0.25;
    } else if (rating === "hard") {
        interval = previousInterval >= SRS.maxInterval
            ? previousInterval * 0.8
            : previousInterval < 1
                ? 1
                : Math.max(previousInterval + 1, previousInterval * 1.2);
    } else if (rating === "good") {
        interval = previousInterval < 1
            ? 1
            : previousInterval === 1 && repetitions <= 1
                ? 3
                : previousInterval * ease + overdueDays * 0.5;
    } else if (rating === "easy") {
        interval = previousInterval < 1
            ? 3
            : previousInterval === 1 && repetitions <= 1
                ? 7
                : previousInterval * ease * 1.3 + overdueDays;
    } else {
        throw new Error(`Unknown SRS rating: ${rating}`);
    }

    return fuzzInterval(interval, randomValue);
}

function applySrsRating(word, rating, reviewedAt = new Date(), randomValue = Math.random(), activity = "review") {
    const previousInterval = clamp(Number(word.intervalDays) || 0, 0, SRS.maxInterval);
    const nextInterval = calculateNextInterval(word, rating, reviewedAt, randomValue);
    let ease = clamp(Number(word.easeFactor) || SRS.initialEase, SRS.minimumEase, SRS.maximumEase);

    const isLesson = activity === "lesson";

    if (rating === "again") {
        ease -= 0.2;
        // Not knowing a word on first exposure is expected. It still receives
        // a short first interval, but it is not a lapse or problem-word failure.
        if (!isLesson) {
            word.failCount = Math.max(0, Number(word.failCount) || 0) + 1;
            word.lapses = Math.max(0, Number(word.lapses) || 0) + 1;
        }
    } else {
        if (rating === "hard") ease -= 0.1;
        if (rating === "easy") ease += 0.1;
        word.repetitions = Math.max(0, Number(word.repetitions) || 0) + 1;
    }

    word.easeFactor = Math.round(clamp(ease, SRS.minimumEase, SRS.maximumEase) * 100) / 100;
    word.correctCount = Math.min(5, Math.max(0, Number(word.repetitions) || 0));
    word.lastReviewed = todayFromDate(reviewedAt);
    word.lastReviewedAt = reviewedAt.toISOString();
    setNextReview(word, nextInterval, reviewedAt);

    if (!Array.isArray(word.reviewLog)) word.reviewLog = [];
    word.reviewLog.push({
        reviewedAt: reviewedAt.toISOString(),
        rating,
        activity,
        previousInterval,
        nextInterval,
        easeFactor: word.easeFactor
    });

    return nextInterval;
}

function cloudWordKey(word) {
    const japaneseIdentity = [word?.kanji, word?.hiragana]
        .map(value => String(value || "").trim().toLocaleLowerCase())
        .join("\u0000");
    return japaneseIdentity !== "\u0000"
        ? japaneseIdentity
        : String(word?.english || "").trim().toLocaleLowerCase();
}

function cloudValuesMatch(left, right) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function reviewLogKey(entry) {
    return [
        entry?.reviewedAt,
        entry?.activity,
        entry?.rating,
        entry?.previousInterval,
        entry?.nextInterval
    ].map(value => String(value ?? "")).join("\u0000");
}

function mergeReviewLogs(...logs) {
    const entries = new Map();
    logs.flat().filter(Boolean).forEach(entry => entries.set(reviewLogKey(entry), entry));
    return [...entries.values()].sort((left, right) =>
        new Date(left.reviewedAt || 0).getTime() - new Date(right.reviewedAt || 0).getTime()
    );
}

function latestWordActivity(word) {
    const direct = new Date(word?.lastReviewedAt || word?.lastReviewed || 0).getTime();
    const logged = (Array.isArray(word?.reviewLog) ? word.reviewLog : [])
        .reduce((latest, entry) => Math.max(latest, new Date(entry.reviewedAt || 0).getTime() || 0), 0);
    return Math.max(Number.isFinite(direct) ? direct : 0, logged);
}

function mergeChangedWord(localWord, remoteWord) {
    const preferred = latestWordActivity(localWord) >= latestWordActivity(remoteWord)
        ? localWord
        : remoteWord;
    const merged = {
        ...preferred,
        repetitions: Math.max(Number(localWord.repetitions) || 0, Number(remoteWord.repetitions) || 0),
        lapses: Math.max(Number(localWord.lapses) || 0, Number(remoteWord.lapses) || 0),
        failCount: Math.max(Number(localWord.failCount) || 0, Number(remoteWord.failCount) || 0),
        reviewLog: mergeReviewLogs(localWord.reviewLog || [], remoteWord.reviewLog || [])
    };
    merged.correctCount = Math.min(5, Math.max(Number(merged.correctCount) || 0, merged.repetitions));
    return normaliseWord(merged);
}

function mergeCloudWords(baseWords = [], localWords = [], remoteWords = []) {
    const base = new Map(baseWords.map(word => [cloudWordKey(word), word]));
    const local = new Map(localWords.map(word => [cloudWordKey(word), word]));
    const remote = new Map(remoteWords.map(word => [cloudWordKey(word), word]));
    const keys = new Set([...base.keys(), ...local.keys(), ...remote.keys()]);
    const merged = [];

    keys.forEach(key => {
        const baseWord = base.get(key);
        const localWord = local.get(key);
        const remoteWord = remote.get(key);

        if (!localWord && !remoteWord) return;
        if (!baseWord) {
            if (localWord && remoteWord) merged.push(mergeChangedWord(localWord, remoteWord));
            else merged.push(normaliseWord(localWord || remoteWord));
            return;
        }

        if (!localWord) {
            // A local deletion wins only when the server copy was not changed
            // independently after the shared base snapshot.
            if (!cloudValuesMatch(remoteWord, baseWord)) merged.push(normaliseWord(remoteWord));
            return;
        }

        if (!remoteWord) {
            // Respect a remote deletion unless this device also changed the word.
            if (!cloudValuesMatch(localWord, baseWord)) merged.push(normaliseWord(localWord));
            return;
        }

        const localChanged = !cloudValuesMatch(localWord, baseWord);
        const remoteChanged = !cloudValuesMatch(remoteWord, baseWord);
        if (localChanged && remoteChanged) merged.push(mergeChangedWord(localWord, remoteWord));
        else merged.push(normaliseWord(localChanged ? localWord : remoteWord));
    });

    return merged;
}

function mergeCloudCount(baseValue, localValue, remoteValue) {
    const base = Number(baseValue) || 0;
    const local = Number(localValue) || 0;
    const remote = Number(remoteValue) || 0;
    if (local === base) return remote;
    if (remote === base) return local;
    if (local < base) return local;
    return Math.max(0, remote + (local - base));
}

function mergeCloudHistory(baseHistory = {}, localHistory = {}, remoteHistory = {}) {
    const merged = {};
    const dates = new Set([...Object.keys(baseHistory), ...Object.keys(localHistory), ...Object.keys(remoteHistory)]);
    dates.forEach(date => {
        const value = mergeCloudCount(baseHistory[date], localHistory[date], remoteHistory[date]);
        if (value > 0) merged[date] = value;
    });
    return merged;
}

function mergeCloudStats(baseStats = {}, localStats = {}, remoteStats = {}) {
    const merged = { ...remoteStats };
    ["totalReviews", "successfulReviews", "totalFailures", "totalLessons", "xp"].forEach(key => {
        merged[key] = mergeCloudCount(baseStats[key], localStats[key], remoteStats[key]);
    });
    merged.reviewHistory = mergeCloudHistory(baseStats.reviewHistory, localStats.reviewHistory, remoteStats.reviewHistory);
    merged.lessonHistory = mergeCloudHistory(baseStats.lessonHistory, localStats.lessonHistory, remoteStats.lessonHistory);
    merged.streak = Math.max(Number(localStats.streak) || 0, Number(remoteStats.streak) || 0);
    merged.lastStudyDate = [localStats.lastStudyDate, remoteStats.lastStudyDate]
        .filter(Boolean).sort().at(-1) || null;
    return normaliseStats(merged);
}

function mergeCloudStatsWithoutBase(localStats = {}, remoteStats = {}) {
    const merged = { ...remoteStats };
    ["totalReviews", "successfulReviews", "totalFailures", "totalLessons", "xp"].forEach(key => {
        merged[key] = Math.max(Number(localStats[key]) || 0, Number(remoteStats[key]) || 0);
    });
    ["reviewHistory", "lessonHistory"].forEach(key => {
        merged[key] = {};
        const dates = new Set([
            ...Object.keys(localStats[key] || {}),
            ...Object.keys(remoteStats[key] || {})
        ]);
        dates.forEach(date => {
            const value = Math.max(Number(localStats[key]?.[date]) || 0, Number(remoteStats[key]?.[date]) || 0);
            if (value > 0) merged[key][date] = value;
        });
    });
    merged.streak = Math.max(Number(localStats.streak) || 0, Number(remoteStats.streak) || 0);
    merged.lastStudyDate = [localStats.lastStudyDate, remoteStats.lastStudyDate]
        .filter(Boolean).sort().at(-1) || null;
    return normaliseStats(merged);
}

function mergeCloudSettings(baseSettings = {}, localSettings = {}, remoteSettings = {}) {
    const merged = { ...remoteSettings };
    ["dailyGoal", "chunkSize", "strokeSpeed", "gardenState"].forEach(key => {
        if (!cloudValuesMatch(localSettings[key], baseSettings[key])) merged[key] = localSettings[key];
    });
    if (globalThis.TobuKabaTravel) {
        merged.travelState = globalThis.TobuKabaTravel.mergeTravelStates(
            localSettings.travelState,
            remoteSettings.travelState,
            globalThis.TOBUKABA_TRAVEL_CONTENT
        );
    }
    return normaliseSettings(merged);
}

function currentCloudSnapshot(revision = cloudRevision) {
    return {
        revision: Number(revision) || 0,
        words: makeJsonbSafe(cloneCloudValue(words)),
        stats: makeJsonbSafe(cloneCloudValue(stats)),
        settings: makeJsonbSafe(cloneCloudValue(userSettings))
    };
}

function normaliseCloudSnapshot(data) {
    return {
        revision: Number(data?.revision) || 0,
        words: normaliseWords(data?.words),
        stats: normaliseStats(data?.stats),
        settings: normaliseSettings(data?.settings)
    };
}

function mergeCloudSnapshots(baseSnapshot, localSnapshot, remoteSnapshot) {
    const hasBase = Boolean(baseSnapshot);
    const base = baseSnapshot || { words: [], stats: {}, settings: {} };
    const mergedSettings = hasBase
        ? mergeCloudSettings(base.settings, localSnapshot.settings, remoteSnapshot.settings)
        : normaliseSettings(remoteSnapshot.settings);
    if (!hasBase && globalThis.TobuKabaTravel) {
        mergedSettings.travelState = globalThis.TobuKabaTravel.mergeTravelStates(
            localSnapshot.settings?.travelState,
            remoteSnapshot.settings?.travelState,
            globalThis.TOBUKABA_TRAVEL_CONTENT
        );
    }
    return {
        revision: remoteSnapshot.revision,
        words: mergeCloudWords(base.words, localSnapshot.words, remoteSnapshot.words),
        stats: hasBase
            ? mergeCloudStats(base.stats, localSnapshot.stats, remoteSnapshot.stats)
            : mergeCloudStatsWithoutBase(localSnapshot.stats, remoteSnapshot.stats),
        settings: mergedSettings
    };
}

function persistRuntimeData() {
    localStorage.setItem("kanjiWords", JSON.stringify(words));
    localStorage.setItem("kanjiStats", JSON.stringify(stats));
    localStorage.setItem("kanjiSRSSettings", JSON.stringify(userSettings));
}

function applyRuntimeSnapshot(snapshot) {
    words = normaliseWords(snapshot.words);
    stats = normaliseStats(snapshot.stats);
    userSettings = normaliseSettings(snapshot.settings);
    persistRuntimeData();
    if (typeof updateAll === "function") updateAll();
}


/* =========================================================
   SAVE
========================================================= */

function saveData() {

    synchroniseGardenState();
    synchroniseTravelProgress();
    persistRuntimeData();
    markCloudSavePending();
    queueCloudSave();

}

function setSyncStatus(message) {
    const status = document.getElementById("syncStatus");
    if (status) status.textContent = message;
}

function deviceIsOnline() {
    return typeof navigator === "undefined" || navigator.onLine !== false;
}

function setAuthMessage(message) {
    const target = document.getElementById("authMessage");
    if (target) target.textContent = message;
}

function showAuthenticatedApp() {
    document.getElementById("authView").hidden = true;
    document.getElementById("appShell").hidden = false;
    document.getElementById("heroNavigation").hidden = false;
    document.getElementById("accountEmail").textContent = currentUser.email || "your account";
    showPage("dashboard");
}

function showAuthScreen(message = "") {
    document.getElementById("appShell").hidden = true;
    document.getElementById("heroNavigation").hidden = true;
    document.getElementById("authView").hidden = false;
    setAuthMessage(message);
}

function queueCloudSave() {
    if (!supabaseClient || !currentUser || isLoadingCloudData) return;
    clearTimeout(cloudSaveTimer);
    setSyncStatus("Saving…");
    cloudSaveTimer = setTimeout(saveToCloud, 100);
}

async function saveToCloud() {
    if (!supabaseClient || !currentUser || isLoadingCloudData) return;

    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;

    // Keep writes ordered so a slower, older request cannot overwrite the
    // result of a newer review in the single profile row.
    if (cloudSaveInFlight) {
        await cloudSaveInFlight;
        if (getPendingCloudRevision()) return saveToCloud();
        return;
    }

    synchroniseGardenState();
    synchroniseTravelProgress();

    const pendingKey = getPendingCloudKey();
    const pendingToken = getPendingCloudRevision();
    const snapshot = currentCloudSnapshot();
    const expectedRevision = cloudRevision;

    setSyncStatus("Saving…");
    cloudSaveInFlight = supabaseClient.rpc("save_kanji_srs_profile", {
        p_expected_revision: expectedRevision,
        p_words: snapshot.words,
        p_stats: snapshot.stats,
        p_settings: snapshot.settings
    });

    let data;
    let error;
    try {
        ({ data, error } = await cloudSaveInFlight);
    } finally {
        cloudSaveInFlight = null;
    }

    if (error) {
        console.error("TobuKaba cloud sync failed", error);
        const errorCode = error?.code ? ` (error ${error.code})` : "";
        setSyncStatus(deviceIsOnline()
            ? `Could not sync — changes remain on this device.${errorCode}`
            : "Offline — changes will sync when you reconnect.");
        return;
    }

    const savedProfile = Array.isArray(data) ? data[0] : data;
    if (!savedProfile) {
        // Another device saved first. Pull that revision, replay this
        // device's changes over their shared base, and try again.
        await refreshCloudData({ mergePending: true, showApp: false });
        if (getPendingCloudRevision()) return saveToCloud();
        return;
    }

    cloudRevision = Number(savedProfile.revision) || expectedRevision + 1;
    writeCloudBase({ ...snapshot, revision: cloudRevision });

    if (pendingKey && pendingToken && localStorage.getItem(pendingKey) === pendingToken) {
        localStorage.removeItem(pendingKey);
    }

    const stillPending = Boolean(getPendingCloudRevision());
    setSyncStatus(stillPending ? "Saving…" : "Synced across devices");

    // If another review completed during the request, send that newer state
    // after the older write has finished.
    if (stillPending) return saveToCloud();
}

async function refreshCloudData({ mergePending = true, showApp = false } = {}) {
    if (!supabaseClient || !currentUser) return;
    if (cloudRefreshInFlight) return cloudRefreshInFlight;

    cloudRefreshInFlight = (async () => {
        const { data, error } = await supabaseClient
            .from("kanji_srs_profiles")
            .select("words, stats, settings, revision, updated_at")
            .eq("user_id", currentUser.id)
            .maybeSingle();

        if (error) {
            setSyncStatus(deviceIsOnline()
                ? "Could not check for updates — local changes are safe."
                : "Offline — changes will sync when you reconnect.");
            return { error };
        }

        const hasPendingLocalChanges = Boolean(getPendingCloudRevision());
        if (!data) {
            cloudRevision = 0;
            lastCloudSnapshot = null;
            if (!hasPendingLocalChanges) markCloudSavePending();
            return { needsSave: true };
        }

        const remoteSnapshot = normaliseCloudSnapshot(data);
        if (remoteSnapshot.revision < cloudRevision) return { data };

        const cloudDataNeededSrsMigration = Array.isArray(data.words) &&
            data.words.some(word => Number(word.srsVersion) < SRS.version);
        const cloudDataNeededGardenMigration = !data.settings?.gardenState ||
            Number(data.settings.gardenState.version || 1) < GARDEN_STATE_VERSION;
        const cloudDataNeededTravelMigration = !data.settings?.travelState ||
            Number(data.settings.travelState.version || 0) < (globalThis.TobuKabaTravel?.TRAVEL_STATE_VERSION || 1);

        if (hasPendingLocalChanges && mergePending) {
            const localSnapshot = currentCloudSnapshot();
            const baseSnapshot = lastCloudSnapshot || readCloudBase();
            const mergedSnapshot = mergeCloudSnapshots(baseSnapshot, localSnapshot, remoteSnapshot);
            cloudRevision = remoteSnapshot.revision;
            writeCloudBase(remoteSnapshot);
            isLoadingCloudData = true;
            applyRuntimeSnapshot(mergedSnapshot);
            isLoadingCloudData = false;
            return { data, needsSave: true };
        }

        cloudRevision = remoteSnapshot.revision;
        writeCloudBase(remoteSnapshot);
        isLoadingCloudData = true;
        applyRuntimeSnapshot(remoteSnapshot);
        isLoadingCloudData = false;

        if (cloudDataNeededSrsMigration || cloudDataNeededGardenMigration || cloudDataNeededTravelMigration) {
            markCloudSavePending();
            return { data, needsSave: true };
        }

        setSyncStatus("Synced across devices");
        return { data };
    })();

    try {
        return await cloudRefreshInFlight;
    } finally {
        cloudRefreshInFlight = null;
        if (showApp) showAuthenticatedApp();
    }
}

async function loadCloudData() {
    if (!supabaseClient || !currentUser) return;

    isLoadingCloudData = true;
    lastCloudSnapshot = readCloudBase();
    cloudRevision = Number(lastCloudSnapshot?.revision) || 0;
    if (!lastCloudSnapshot && hadLocalStudyDataAtStartup && !getPendingCloudRevision()) {
        markCloudSavePending();
    }
    setSyncStatus("Loading your study data…");
    isLoadingCloudData = false;

    const result = await refreshCloudData({ mergePending: true, showApp: true });
    if (result?.error) {
        showAuthenticatedApp();
        return;
    }

    if (result?.needsSave || getPendingCloudRevision()) await saveToCloud();
    else setSyncStatus("Synced across devices");
}

async function syncWithCloud() {
    if (!supabaseClient || !currentUser || document.hidden) return;
    if (getPendingCloudRevision()) await saveToCloud();
    const result = await refreshCloudData({ mergePending: true, showApp: false });
    if (result?.needsSave || getPendingCloudRevision()) await saveToCloud();
}

async function handleRemoteProfileChange(payload) {
    const remote = payload?.new;
    if (!remote || remote.user_id !== currentUser?.id) return;
    if (Number(remote.revision) <= cloudRevision || cloudSaveInFlight) return;

    if (getPendingCloudRevision()) {
        const result = await refreshCloudData({ mergePending: true, showApp: false });
        if (result?.needsSave || getPendingCloudRevision()) await saveToCloud();
        return;
    }

    const remoteSnapshot = normaliseCloudSnapshot(remote);
    cloudRevision = remoteSnapshot.revision;
    writeCloudBase(remoteSnapshot);
    isLoadingCloudData = true;
    applyRuntimeSnapshot(remoteSnapshot);
    isLoadingCloudData = false;
    setSyncStatus("Updated from another device");
}

function stopCloudSyncListeners() {
    if (cloudPollTimer) clearInterval(cloudPollTimer);
    cloudPollTimer = null;
    if (profileChangesChannel && supabaseClient?.removeChannel) {
        supabaseClient.removeChannel(profileChangesChannel);
    }
    profileChangesChannel = null;
}

function startCloudSyncListeners() {
    stopCloudSyncListeners();
    if (!supabaseClient || !currentUser || !supabaseClient.channel) return;

    profileChangesChannel = supabaseClient
        .channel(`kanji-srs-profile-${currentUser.id}`)
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "kanji_srs_profiles",
            filter: `user_id=eq.${currentUser.id}`
        }, handleRemoteProfileChange)
        .subscribe(status => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                setSyncStatus("Live sync reconnecting — periodic sync remains active");
            }
        });

    // Focus/visibility checks below are immediate. This interval is a quiet
    // fallback for browsers that suspend or block a WebSocket connection.
    cloudPollTimer = setInterval(syncWithCloud, CLOUD_POLL_INTERVAL_MS);
}

function readCredentials() {
    return {
        email: document.getElementById("authEmail").value.trim(),
        password: document.getElementById("authPassword").value
    };
}

async function signIn() {
    if (!supabaseClient) return;
    const { email, password } = readCredentials();
    if (!email || !password) return setAuthMessage("Enter your email address and password.");
    setAuthMessage("Signing in…");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
}

async function signUp() {
    if (!supabaseClient) return;
    const { email, password } = readCredentials();
    if (!email || password.length < 6) return setAuthMessage("Use an email address and a password of at least 6 characters.");
    setAuthMessage("Creating your account…");
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) return setAuthMessage(error.message);
    setAuthMessage(data.session ? "Account created. Loading your data…" : "Check your email to confirm your account, then sign in.");
}

async function resetPassword() {
    if (!supabaseClient) return;
    const email = document.getElementById("authEmail").value.trim();
    if (!email) return setAuthMessage("Enter your email address first.");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    setAuthMessage(error ? error.message : "Password-reset instructions have been sent if that account exists.");
}

async function signOut() {
    clearTimeout(cloudSaveTimer);
    await saveToCloud();
    stopCloudSyncListeners();
    await supabaseClient.auth.signOut();
}

async function initialiseAuthentication() {
    if (!supabaseClient) {
        showAuthScreen("Add your Supabase Project URL and publishable/anon key in the SUPABASE SETUP section of this file.");
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadCloudData();
        startCloudSyncListeners();
    } else {
        showAuthScreen();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session && (!currentUser || session.user.id !== currentUser.id)) {
            currentUser = session.user;
            await loadCloudData();
            startCloudSyncListeners();
        } else if (!session) {
            stopCloudSyncListeners();
            currentUser = null;
            cloudRevision = 0;
            lastCloudSnapshot = null;
            showAuthScreen();
        }
    });

}




window.addEventListener("focus", syncWithCloud);
window.addEventListener("online", syncWithCloud);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncWithCloud();
});
window.addEventListener("pagehide", () => {
    if (getPendingCloudRevision()) saveToCloud();
});

initialiseAuthentication();
