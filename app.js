/* =========================================================
   SETTINGS
========================================================= */

const GARDEN_PLOT_COUNT = 4;
const GARDEN_WORDS_PER_PLOT = 10;
const GARDEN_STATE_VERSION = 2;
const GARDEN_PLANTS = Object.freeze({
    maple: "Japanese maple",
    hydrangea: "Hydrangeas",
    wildflowers: "Wildflower patch"
});
const GARDEN_STAGES = Object.freeze(["preparing", "planted", "taking-root", "growing-well", "flourishing"]);

function createDefaultGardenState() {
    return {
        version: GARDEN_STATE_VERSION,
        startedAt: new Date().toISOString(),
        plots: Array.from({ length: GARDEN_PLOT_COUNT }, (_, index) => ({
            id: `plot-${index + 1}`,
            plant: null,
            plantedAt: null,
            wordKeys: [],
            highestStage: "preparing"
        })),
        unlockedAmbience: []
    };
}

function normaliseGardenState(savedState) {
    const hasSavedState = savedState && typeof savedState === "object";
    const source = hasSavedState ? savedState : {};
    const savedVersion = Math.max(1, Number(source.version) || (hasSavedState ? 1 : GARDEN_STATE_VERSION));
    const savedStartedAt = new Date(source.startedAt || "");
    const startedAt = savedVersion >= GARDEN_STATE_VERSION && Number.isFinite(savedStartedAt.getTime())
        ? savedStartedAt.toISOString()
        : (hasSavedState ? null : new Date().toISOString());
    const savedPlots = Array.isArray(source.plots) ? source.plots : [];
    const seenWordKeys = new Set();
    const plots = Array.from({ length: GARDEN_PLOT_COUNT }, (_, index) => {
        const id = `plot-${index + 1}`;
        const saved = savedPlots.find(plot => plot?.id === id) || savedPlots[index] || {};
        const wordKeys = Array.isArray(saved.wordKeys)
            ? saved.wordKeys
                .map(key => String(key || "").replaceAll("\u0000", "\u241f"))
                .filter(key => key && !seenWordKeys.has(key) && seenWordKeys.add(key))
                .slice(0, GARDEN_WORDS_PER_PLOT)
            : [];
        return {
            id,
            plant: Object.hasOwn(GARDEN_PLANTS, saved.plant) ? saved.plant : null,
            plantedAt: Number.isFinite(new Date(saved.plantedAt || "").getTime())
                ? new Date(saved.plantedAt).toISOString()
                : null,
            wordKeys,
            highestStage: GARDEN_STAGES.includes(saved.highestStage) ? saved.highestStage : "preparing"
        };
    });
    return {
        version: savedVersion,
        startedAt,
        plots,
        unlockedAmbience: Array.isArray(source.unlockedAmbience)
            ? [...new Set(source.unlockedAmbience.filter(item => item === "visiting-bird"))]
            : []
    };
}

function createInitialTravelState() {
    const now = new Date().toISOString();
    if (!globalThis.TobuKabaTravel || !globalThis.TOBUKABA_TRAVEL_CONTENT) return null;
    return globalThis.TobuKabaTravel.createDefaultTravelState(now);
}

const DEFAULT_SETTINGS = {
    // Keep the persisted key for backwards compatibility. It now represents
    // the learner's daily new-word/Lesson target, never a Review limit.
    dailyGoal: 20,
    chunkSize: 5,
    strokeSpeed: "standard",
    gardenState: createDefaultGardenState(),
    travelState: createInitialTravelState()
};

const WORD_COLLECTIONS = Array.isArray(globalThis.TOBUKABA_WORD_COLLECTIONS)
    ? globalThis.TOBUKABA_WORD_COLLECTIONS
    : [];
let activeCollectionId = null;
const selectedCollectionWordIds = new Set();

/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(page) {

    const selectedPage = document.getElementById(page);
    if (!selectedPage) return;

    // Set both the CSS class and the native hidden state. The latter keeps
    // sections hidden even if a future stylesheet is missing or overridden.
    document.querySelectorAll(".page").forEach(section => {
        const isSelected = section === selectedPage;
        section.classList.toggle("active", isSelected);
        section.hidden = !isSelected;
    });

    const navigationPage = page === "add" ? "vocabulary" : page;
    document.querySelectorAll(".nav-link").forEach(button => {
        const isActive = button.dataset.page === navigationPage;
        button.classList.toggle("active", isActive);
        if (isActive) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });

    const accountMenu = document.querySelector(".navigation-account");
    if (accountMenu) accountMenu.open = false;

    updateHeaderMode(page);

    updateAll();

}


/* =========================================================
   QUIZ
========================================================= */

function getTodayReviews() {
    return stats.reviewHistory[today()] || 0;
}


function getRemainingDailyLessons() {
    return Math.max(0, userSettings.dailyGoal - getTodayLessons());
}

function getNewLessonWords() {
    return words.filter(isNewWord);
}

function getDueReviewWords() {
    return words.filter(isDueReview);
}

function getTodayLessons() {
    return stats.lessonHistory[today()] || 0;
}

function openStudy(mode) {
    showPage("quiz");
    startQuiz(mode);
}

function createLessonRecallQueue(practiceQueue, randomValue = Math.random) {
    const recallQueue = [...practiceQueue];
    if (recallQueue.length === 2) {
        // A, B, recall A provides spacing for both items. Reversing two cards
        // would make B's recall immediately follow B's guided practice.
        return recallQueue;
    }

    for (let index = recallQueue.length - 1; index > 0; index--) {
        const target = Math.floor(Math.max(0, Math.min(0.999999, Number(randomValue()) || 0)) * (index + 1));
        [recallQueue[index], recallQueue[target]] = [recallQueue[target], recallQueue[index]];
    }

    if (recallQueue.length >= 3) {
        const sameOrder = recallQueue.every((word, index) => word === practiceQueue[index]);
        if (sameOrder) [recallQueue[0], recallQueue[1]] = [recallQueue[1], recallQueue[0]];

        const mostRecentlyPractised = practiceQueue.at(-1);
        if (recallQueue[0] === mostRecentlyPractised) {
            const swapIndex = recallQueue.findIndex((word, index) => index > 0 && word !== mostRecentlyPractised);
            if (swapIndex > 0) [recallQueue[0], recallQueue[swapIndex]] = [recallQueue[swapIndex], recallQueue[0]];
        }
    }

    return recallQueue;
}

function getCurrentQuizWord() {
    if (quizMode === "lessons" && lessonPhase === "retry-practice") return lessonRetryWord;
    return quizWords[quizIndex];
}

function getReviewSessionState(word) {
    return reviewSessionStates.get(wordIdentity(word));
}

function getCompletedReviewCount() {
    return Array.from(reviewSessionStates.values())
        .filter(state => state.completed).length;
}

function startQuiz(mode = quizMode) {

    quizMode = mode === "lessons" ? "lessons" : "reviews";

    // Starting a session always creates a fresh queue from the words
    // that are genuinely due RIGHT NOW. Reviewed words cannot re-enter
    // until their SRS nextReviewAt timestamp has arrived.
    quizWords = [];
    quizOriginalCount = 0;
    reviewSessionStates = new Map();
    quizRelearningIndexes = new Set();
    quizIndex = 0;
    lessonPhase = "practice";
    lessonCompletedThisSession = 0;
    lessonPracticeQueue = [];
    lessonRecallQueue = [];
    lessonRetryWord = null;
    lastQuizState = null;

    document.getElementById("quizStart").style.display = "none";
    document.getElementById("quizArea").style.display = "none";
    document.getElementById("quizFinished").style.display = "none";

    const availableWords = (quizMode === "lessons" ? getNewLessonWords() : getDueReviewWords())
        .sort(() => Math.random() - 0.5);

    // Lessons stay intentionally small even if a learner has configured a
    // very large lesson batch. Reviews are always an individual full session.
    const modeLimit = quizMode === "lessons"
        ? Math.min(userSettings.chunkSize, 10)
        : availableWords.length;
    const quizSize = Math.min(modeLimit, availableWords.length);

    quizWords = availableWords.slice(0, quizSize);
    quizOriginalCount = quizWords.length;

    if (quizMode === "reviews") {
        quizWords.forEach(word => {
            reviewSessionStates.set(wordIdentity(word), {
                completed: false,
                mistakes: 0,
                needsAnotherAttempt: false
            });
        });
    }

    if (quizMode === "lessons") {
        lessonPracticeQueue = [...quizWords];
        lessonRecallQueue = createLessonRecallQueue(lessonPracticeQueue);
        quizWords = lessonPracticeQueue;
    }

    if (quizWords.length === 0) {
        document.getElementById("quizFinished").style.display = "block";
        document.getElementById("quizFinishedTitle").textContent = quizMode === "lessons"
            ? "No new lessons waiting"
            : "No reviews due";
        document.getElementById("quizResult").innerHTML = quizMode === "lessons"
            ? `Every word has begun its learning path.<br><br>Add more vocabulary whenever you are ready.`
            : `No learned words are currently due.<br><br>Your reviewed words will return at their scheduled time.<br><br>You completed ${getTodayReviews()} ${getTodayReviews() === 1 ? "review" : "reviews"} today.`;
        updateNextChunkButton(false);
        resetAnswerReveal();
        return;
    }

    document.getElementById("quizArea").style.display = "block";
    updateNextChunkButton(false);
    showQuizWord();

}

function updateNextChunkButton(show) {
    const button = document.getElementById("nextChunkButton");
    if (!button) return;
    button.style.display = show ? "inline-block" : "none";
}



function showQuizWord() {

    if (typeof resetAnswerReveal === "function") resetAnswerReveal();

    const word = getCurrentQuizWord();
    if (!word) return;

    const isRetry = quizRelearningIndexes.has(quizIndex);
    const isLesson = quizMode === "lessons";

    document.getElementById("ratingAgainHint").textContent = "Couldn't recall or write it";
    document.getElementById("ratingHardHint").textContent = "Correct, with effort";
    document.getElementById("ratingGoodHint").textContent = "Correct";
    document.getElementById("ratingEasyHint").textContent = "Immediate recall";

    const counter = document.getElementById("quizCounter");
    if (isLesson) {
        counter.textContent = lessonPhase === "practice"
            ? `Guided practice • ${quizIndex + 1} of ${quizOriginalCount}`
            : lessonPhase === "retry-practice"
                ? "Guided practice again"
                : `Recall check • ${Math.min(lessonCompletedThisSession + 1, quizOriginalCount)} of ${quizOriginalCount}`;
    } else {
        const displayNumber = Math.min(getCompletedReviewCount() + 1, quizOriginalCount);
        counter.textContent = isRetry
            ? `Retry • Word ${displayNumber} of ${quizOriginalCount}`
            : `Review • Word ${displayNumber} of ${quizOriginalCount}`;
    }

    document.getElementById("quizEnglish")
        .textContent = word.english;

    document.getElementById("quizHiragana")
        .textContent = word.hiragana;

    document.getElementById("quizCategory")
        .innerHTML =
        `<span class="badge">${word.category}</span>
         <span class="badge">${word.jlpt}</span>`;

    document.getElementById("quizProgress")
        .textContent = isRetry ? "RETRY" : isLesson
            ? lessonPhase === "practice" || lessonPhase === "retry-practice" ? "GUIDED PRACTICE" : "RECALL CHECK"
            : isLongTerm(word) ? "LONG-TERM REVIEW" : "SCHEDULED REVIEW";

    document.getElementById("nextInfo")
        .textContent =
        isLesson
            ? lessonPhase === "practice" || lessonPhase === "retry-practice"
                ? "Follow the strokes slowly. Completing this practice does not mark the word as learned."
                : "Try writing it from memory, then reveal it. Choose OK only when you are ready to add it to Reviews."
            : `Current interval: ${word.intervalDays} ${word.intervalDays === 1 ? "day" : "days"} · ${word.repetitions} successful ${word.repetitions === 1 ? "review" : "reviews"}`;

    configureStudyControls();

}


/* =========================================================
   RATING
========================================================= */

function rateWord(rating) {

    // Lessons have their own explicit two-pass flow. Review ratings must never
    // be able to complete or schedule a new lesson item.
    if (quizMode === "lessons") return;

    const word = quizWords[quizIndex];
    const reviewState = getReviewSessionState(word);
    const isRelearning = Boolean(reviewState?.needsAnotherAttempt);

    if (!word) return;

    // A relearning card has already been reviewed and deliberately placed
    // back into this session. It must be allowed through even though its
    // normal SRS nextReviewAt is now in the future.
    if (!isRelearning) {
        // Protect against stale quiz sessions, double-clicks, and another
        // browser tab having reviewed the same word first.
        const isEligible = isDueReview(word);
        if (!isEligible) return;

        const storedWords = JSON.parse(localStorage.getItem("kanjiWords") || "[]");
        const storedWord = storedWords.find(w =>
            w.kanji === word.kanji && w.hiragana === word.hiragana
        );

        if (storedWord) {
            const storedEligible = isDueReview(storedWord);
            if (!storedEligible) return;
        }
    }

    const todayDate = today();
    recordNightStudyReview();

    if (quizMode === "reviews") {
        if (rating === "again") {
            // An incorrect attempt stays unresolved. Its SRS failure is
            // recorded once per attempt, while completion waits for a correct
            // answer later in this same session.
            reviewState.mistakes++;
            reviewState.needsAnotherAttempt = true;
            applySrsRating(word, rating, new Date(), Math.random(), "review");
            stats.totalFailures++;
            stats.xp += 1;
            quizWords.push(word);
            quizRelearningIndexes.add(quizWords.length - 1);
        } else {
            // A retry confirmation intentionally preserves the scheduling
            // result of its earlier failed attempt. A first-try success keeps
            // the existing SRS rating behaviour.
            if (!isRelearning) applySrsRating(word, rating, new Date(), Math.random(), "review");
            reviewState.completed = true;
            reviewState.needsAnotherAttempt = false;
            stats.totalReviews++;
            stats.reviewHistory[todayDate] = (stats.reviewHistory[todayDate] || 0) + 1;
            stats.successfulReviews++;
            stats.xp += rating === "hard" ? 3 : rating === "easy" ? 7 : 5;
        }
    }

    updateStreak();

    saveData();

    // Immediately refresh dashboard/statistics so a new failure
    // appears in "Most Failed Words" without a page reload.
    updateAll();

    quizIndex++;

    if (quizIndex >= quizWords.length) {

        finishQuiz();

    } else {

        showQuizWord();

    }

}

function configureStudyControls() {
    const isLesson = quizMode === "lessons";
    const isPractice = isLesson && (lessonPhase === "practice" || lessonPhase === "retry-practice");
    const isTransition = isLesson && lessonPhase === "transition";
    const answerArea = document.getElementById("answerRevealArea");
    const lessonAnswer = document.getElementById("lessonPracticeAnswer");
    const practiceActions = document.getElementById("lessonPracticeActions");
    const practiceContinue = document.getElementById("lessonPracticeContinue");
    const confirmationActions = document.getElementById("lessonConfirmationActions");
    const transition = document.getElementById("lessonRoundTransition");
    const reviewRatings = document.getElementById("reviewRatingButtons");
    const undoRow = document.getElementById("undoRow");
    const strokeButton = document.getElementById("strokeOrderButton");

    if (answerArea) answerArea.hidden = isPractice || isTransition;
    if (lessonAnswer) {
        lessonAnswer.hidden = !isPractice;
        lessonAnswer.textContent = isPractice ? (getCurrentQuizWord()?.kanji || "—") : "";
    }
    if (practiceActions) practiceActions.hidden = !isPractice;
    if (practiceContinue && isPractice) {
        practiceContinue.disabled = false;
        practiceContinue.textContent = lessonPhase === "retry-practice"
            ? "Continue"
            : quizIndex + 1 < lessonPracticeQueue.length
                ? "Next guided practice"
                : "Finish guided practice";
    }
    if (confirmationActions) confirmationActions.hidden = !(isLesson && !isPractice && !isTransition);
    if (transition) transition.hidden = !isTransition;
    if (reviewRatings) reviewRatings.hidden = isLesson;
    if (undoRow) undoRow.hidden = isLesson;

    if (isPractice) {
        if (strokeButton) strokeButton.hidden = true;
        setTimeout(beginLessonPractice, 0);
    } else if (isLesson && !isTransition) {
        // Stroke order is optional during recall. The button is available, but
        // the guidance remains closed until the learner requests it.
        allowStrokeOrderGuidance();
    }
}

function continueLessonToConfirmation() {
    if (quizMode !== "lessons") return;

    if (lessonPhase === "practice") {
        if (!quizWords[quizIndex]) return;
        if (quizIndex + 1 < lessonPracticeQueue.length) {
            quizIndex++;
            showQuizWord();
        } else {
            showLessonRoundTransition();
        }
        return;
    }

    if (lessonPhase === "retry-practice" && lessonRetryWord) {
        const insertIndex = quizIndex < lessonRecallQueue.length
            ? Math.min(quizIndex + 1, lessonRecallQueue.length)
            : quizIndex;
        lessonRecallQueue.splice(insertIndex, 0, lessonRetryWord);
        lessonRetryWord = null;
        quizWords = lessonRecallQueue;
        lessonPhase = "confirm";
        showQuizWord();
    }
}

function showLessonRoundTransition() {
    if (quizMode !== "lessons") return;
    if (typeof resetAnswerReveal === "function") resetAnswerReveal();
    lessonPhase = "transition";
    quizWords = lessonRecallQueue;
    quizIndex = 0;
    document.getElementById("quizCounter").textContent = "Guided practice complete";
    document.getElementById("quizEnglish").textContent = "Now try recalling the new words.";
    document.getElementById("quizHiragana").textContent = "";
    document.getElementById("quizCategory").replaceChildren();
    document.getElementById("quizProgress").textContent = "RECALL ROUND READY";
    document.getElementById("nextInfo").textContent = "The recall order has been shuffled and will stay fixed for this session.";
    configureStudyControls();
}

function startLessonRecallRound() {
    if (quizMode !== "lessons" || lessonPhase !== "transition" || lessonRecallQueue.length === 0) return;
    lessonPhase = "confirm";
    showQuizWord();
}

function reviewLessonAgain() {
    if (quizMode !== "lessons" || lessonPhase !== "confirm" || !quizWords[quizIndex]) return;
    lessonRetryWord = quizWords[quizIndex];
    lessonRecallQueue.splice(quizIndex, 1);
    quizWords = lessonRecallQueue;
    lessonPhase = "retry-practice";
    showQuizWord();
}

function removeLessonIdentityFromSession(identity) {
    const matches = word => wordIdentity(word) === identity;
    const currentIndex = quizIndex;
    lessonPracticeQueue = lessonPracticeQueue.filter(word => !matches(word));
    lessonRecallQueue = lessonRecallQueue.filter(word => !matches(word));
    if (lessonRetryWord && matches(lessonRetryWord)) lessonRetryWord = null;
    quizWords = lessonRecallQueue;
    quizIndex = lessonRecallQueue.length === 0
        ? 0
        : Math.min(currentIndex, lessonRecallQueue.length - 1);
}

function continueAfterLessonResolution() {
    if (lessonRecallQueue.length === 0) finishQuiz();
    else showQuizWord();
}

function completeLesson() {
    if (quizMode !== "lessons" || lessonPhase !== "confirm") return;
    const queuedWord = getCurrentQuizWord();
    if (!queuedWord) return;

    const identity = wordIdentity(queuedWord);
    const canonicalIndex = words.findIndex(word => wordIdentity(word) === identity);
    if (canonicalIndex < 0) return;

    let canonicalWord = words[canonicalIndex];

    // If another tab or a cloud refresh completed this identity first, adopt
    // that authoritative saved state and clear stale session copies without
    // incrementing Lesson statistics again.
    const storedWords = JSON.parse(localStorage.getItem("kanjiWords") || "[]");
    const storedWord = storedWords.find(word => wordIdentity(word) === identity);
    if (storedWord && !isNewWord(storedWord)) {
        if (isNewWord(canonicalWord)) {
            canonicalWord = normaliseWord(storedWord);
            words[canonicalIndex] = canonicalWord;
            const storedStats = normaliseStats(JSON.parse(localStorage.getItem("kanjiStats") || "null"));
            stats = mergeCloudStatsWithoutBase(stats, storedStats);
        }
        removeLessonIdentityFromSession(identity);
        updateAll();
        continueAfterLessonResolution();
        return;
    }

    // The canonical collection is authoritative. Queue entries can become
    // stale when a cloud snapshot reconstructs `words` during a live Lesson.
    if (!isNewWord(canonicalWord)) {
        removeLessonIdentityFromSession(identity);
        updateAll();
        continueAfterLessonResolution();
        return;
    }

    // From this point the per-card completion is one atomic local transaction:
    // update the canonical word, update statistics, remove every stale queue
    // representation, then persist the canonical collection immediately.
    const todayDate = today();
    const completedAt = new Date();
    applySrsRating(canonicalWord, "good", completedAt, Math.random(), "lesson");
    stats.totalLessons++;
    stats.lessonHistory[todayDate] = (stats.lessonHistory[todayDate] || 0) + 1;
    lessonCompletedThisSession++;
    recordNightStudyReview();
    updateStreak();
    removeLessonIdentityFromSession(identity);
    saveData();
    updateAll();
    continueAfterLessonResolution();
}


function finishQuiz() {

    document.getElementById("quizArea").style.display = "none";
    document.getElementById("quizFinished").style.display = "block";

    const todayReviews = getTodayReviews();
    const todayLessons = getTodayLessons();
    const remainingLessonGoal = getRemainingDailyLessons();
    const dueRemaining = getDueReviewWords().length;
    const lessonRemaining = getNewLessonWords().length;
    const isLesson = quizMode === "lessons";
    const canStartAnotherChunk = isLesson ? lessonRemaining > 0 : false;

    document.getElementById("quizFinishedTitle").textContent = isLesson
        ? "Lesson complete"
        : "Review complete";
    document.getElementById("nextChunkButton").textContent = isLesson
        ? "Start next lesson chunk"
        : "Start reviews";

    let message = isLesson
        ? `You learned ${lessonCompletedThisSession} new ${lessonCompletedThisSession === 1 ? "word" : "words"}. ${lessonCompletedThisSession === 1 ? "It has" : "They have"} now joined your SRS.`
        : `You reviewed ${quizOriginalCount} ${quizOriginalCount === 1 ? "word" : "words"} in this session.`;
    message +=
        (!isLesson && quizWords.length > quizOriginalCount
            ? `<br>${quizWords.length - quizOriginalCount} retry ${quizWords.length - quizOriginalCount === 1 ? "attempt was" : "attempts were"} included for failed cards.`
            : "");

    if (isLesson) {
        message += lessonRemaining > 0
            ? `<br><br>${lessonRemaining} new ${lessonRemaining === 1 ? "word remains" : "words remain"} available for lessons.`
            : `<br><br>Every available word has begun its learning path.`;
        message += `<br><br>${todayLessons} / ${userSettings.dailyGoal} new words learned today.`;
        if (remainingLessonGoal <= 0) message += `<br><br>Today’s lesson goal is complete.`;
    } else {
        message += `<br><br>${todayReviews} ${todayReviews === 1 ? "review" : "reviews"} completed today.`;
    }

    if (!isLesson && dueRemaining > 0) {
        message += `<br><br>${dueRemaining} more ${dueRemaining === 1 ? "word is" : "words are"} currently due.`;
    } else if (!isLesson) {
        message += `<br><br>No more words are currently due.`;
    }

    document.getElementById("quizResult").innerHTML = message;
    updateNextChunkButton(canStartAnotherChunk);
    resetAnswerReveal();
    updateAll();

}



/* =========================================================
   STREAK
========================================================= */

function updateStreak() {

    const todayDate = today();

    if (stats.lastStudyDate === todayDate) {

        return;

    }

    if (!stats.lastStudyDate) {

        stats.streak = 1;

    } else {

        const yesterday =
            addDays(todayDate, -1);

        if (stats.lastStudyDate === yesterday) {

            stats.streak++;

        } else {

            stats.streak = 1;

        }

    }

    stats.lastStudyDate = todayDate;

}


/* =========================================================
   ADD WORD
========================================================= */

function addWord() {

    const english =
        document.getElementById("newEnglish")
        .value.trim();

    const kanji =
        document.getElementById("newKanji")
        .value.trim();

    const hiragana =
        document.getElementById("newHiragana")
        .value.trim();

    const jlpt =
        document.getElementById("newJLPT").value;

    const category =
        document.getElementById("newCategory").value;

    const pos =
        document.getElementById("newPOS").value;


    if (!english || !kanji || !hiragana) {

        alert("Please enter English, kanji and hiragana.");

        return;

    }


    if (words.some(word => wordIdentity(word) === wordIdentity({ kanji, hiragana }))) {

        alert("This written form and reading are already in your vocabulary.");

        return;

    }


    words.push({

        english,

        kanji,

        hiragana,

        jlpt,

        category,

        pos,

        ...newSrsFields()

    });


    saveData();

    alert("Word added!");

    document.getElementById("newEnglish").value = "";

    document.getElementById("newKanji").value = "";

    document.getElementById("newHiragana").value = "";

    document.getElementById("newCategory").value = "No Category";

    updateAll();

}


/* =========================================================
   DELETE WORD
========================================================= */

function deleteWord(index) {

    const word = words[index];

    if (!confirm(
        `Delete "${word.kanji} ${word.hiragana}"?`
    )) {

        return;

    }

    words.splice(index, 1);

    saveData();

    updateAll();

}


/* =========================================================
   EDIT WORD
========================================================= */

function editWord(index) {

    const word = words[index];

    document.getElementById("editIndex")
        .value = index;

    document.getElementById("editEnglish")
        .value = word.english;

    document.getElementById("editKanji")
        .value = word.kanji;

    document.getElementById("editHiragana")
        .value = word.hiragana;

    document.getElementById("editJLPT")
        .value = word.jlpt;

    document.getElementById("editCategory")
        .value = word.category;

    document.getElementById("editPOS")
        .value = word.pos;

    document.getElementById("editModal")
        .style.display = "block";

}


function closeEdit() {

    document.getElementById("editModal")
        .style.display = "none";

}


function saveEdit() {

    const index =
        Number(document.getElementById("editIndex").value);

    const word = words[index];

    word.english =
        document.getElementById("editEnglish").value.trim();

    word.kanji =
        document.getElementById("editKanji").value.trim();

    word.hiragana =
        document.getElementById("editHiragana").value.trim();

    word.jlpt =
        document.getElementById("editJLPT").value;

    word.category =
        document.getElementById("editCategory").value;

    word.pos =
        document.getElementById("editPOS").value;

    saveData();

    closeEdit();

    updateAll();

}


/* =========================================================
   BEGINNER WORD COLLECTIONS
========================================================= */

function normaliseIdentityPart(value) {
    return String(value || "").normalize("NFKC").trim();
}

function wordIdentity(word) {
    return `${normaliseIdentityPart(word?.kanji)}\u241f${normaliseIdentityPart(word?.hiragana)}`;
}

function hasVocabularyWord(collectionWord) {
    const identity = wordIdentity(collectionWord);
    return words.some(word => wordIdentity(word) === identity);
}

function getActiveWordCollection() {
    return WORD_COLLECTIONS.find(collection => collection.id === activeCollectionId) || null;
}

function toggleWordCollections(forceOpen) {
    const panel = document.getElementById("wordCollectionsPanel");
    const toggle = document.getElementById("wordCollectionsToggle");
    if (!panel || !toggle) return;

    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
    panel.hidden = !shouldOpen;
    toggle.setAttribute("aria-expanded", String(shouldOpen));

    if (shouldOpen) renderWordCollections();
}

function openWordCollection(collectionId) {
    if (!WORD_COLLECTIONS.some(collection => collection.id === collectionId)) return;
    if (activeCollectionId !== collectionId) selectedCollectionWordIds.clear();
    activeCollectionId = collectionId;
    const status = document.getElementById("collectionImportStatus");
    if (status) status.textContent = "";
    renderWordCollections();
}

function closeWordCollection() {
    activeCollectionId = null;
    selectedCollectionWordIds.clear();
    renderWordCollections();
}

function toggleCollectionWord(wordId) {
    const collection = getActiveWordCollection();
    const word = collection?.words.find(item => item.id === wordId);
    if (!word || hasVocabularyWord(word)) return;

    if (selectedCollectionWordIds.has(wordId)) selectedCollectionWordIds.delete(wordId);
    else selectedCollectionWordIds.add(wordId);

    renderWordCollectionDetail();
}

function selectAllCollectionWords() {
    const collection = getActiveWordCollection();
    if (!collection) return;
    collection.words.forEach(word => {
        if (!hasVocabularyWord(word)) selectedCollectionWordIds.add(word.id);
    });
    renderWordCollectionDetail();
}

function clearCollectionSelection() {
    selectedCollectionWordIds.clear();
    renderWordCollectionDetail();
}

function renderWordCollections() {
    const grid = document.getElementById("wordCollectionGrid");
    const detail = document.getElementById("wordCollectionDetail");
    if (!grid || !detail) return;

    grid.innerHTML = WORD_COLLECTIONS.map(collection => {
        const available = collection.words.filter(word => !hasVocabularyWord(word)).length;
        const preview = collection.words.slice(0, 5)
            .map(word => `<span lang="ja">${escapeHtml(word.kanji)}</span>`)
            .join("");
        const availability = available === 0
            ? "All words already added"
            : `${available} ${available === 1 ? "word" : "words"} available`;

        return `
          <article class="word-collection-card">
            <p class="eyebrow">${collection.words.length} WORDS</p>
            <h4>${escapeHtml(collection.name)}</h4>
            <p>${escapeHtml(collection.description)}</p>
            <div class="word-collection-preview" aria-hidden="true">${preview}</div>
            <button class="secondary-btn" type="button" aria-label="Browse ${escapeHtml(collection.name)}" onclick="openWordCollection('${escapeHtml(collection.id)}')">
              Browse <span class="collection-availability">${availability}</span>
            </button>
          </article>`;
    }).join("");

    const collection = getActiveWordCollection();
    grid.hidden = Boolean(collection);
    detail.hidden = !collection;
    if (collection) renderWordCollectionDetail();
}

function renderWordCollectionDetail() {
    const collection = getActiveWordCollection();
    const list = document.getElementById("wordCollectionList");
    const title = document.getElementById("activeCollectionTitle");
    const description = document.getElementById("activeCollectionDescription");
    const count = document.getElementById("collectionSelectionCount");
    const addButton = document.getElementById("addSelectedCollectionWords");
    if (!collection || !list || !title || !description || !count || !addButton) return;

    title.textContent = collection.name;
    description.textContent = collection.description;

    list.innerHTML = collection.words.map(word => {
        const owned = hasVocabularyWord(word);
        const selected = !owned && selectedCollectionWordIds.has(word.id);
        const label = owned ? "In your vocabulary" : selected ? "Selected" : "Add";
        return `
          <article class="collection-word${selected ? " is-selected" : ""}${owned ? " is-owned" : ""}">
            <div class="collection-word-japanese">
              <strong lang="ja">${escapeHtml(word.kanji)}</strong>
              <span lang="ja">${escapeHtml(word.hiragana)}</span>
            </div>
            <div class="collection-word-meaning">
              <strong>${escapeHtml(word.english)}</strong>
              <span>${escapeHtml(word.pos)}</span>
            </div>
            <button type="button" aria-label="${owned ? "Already in your vocabulary" : selected ? "Remove from selection" : "Select"}: ${escapeHtml(word.kanji)}, ${escapeHtml(word.hiragana)}" aria-pressed="${selected}" onclick="toggleCollectionWord('${escapeHtml(word.id)}')" ${owned ? "disabled" : ""}>
              <span aria-hidden="true">${selected || owned ? "✓" : "+"}</span> ${label}
            </button>
          </article>`;
    }).join("");

    const selectedCount = collection.words.filter(word =>
        selectedCollectionWordIds.has(word.id) && !hasVocabularyWord(word)
    ).length;
    count.textContent = selectedCount === 0
        ? "No words selected"
        : `${selectedCount} ${selectedCount === 1 ? "word" : "words"} selected`;
    addButton.disabled = selectedCount === 0;
    addButton.textContent = selectedCount === 0
        ? "Add selected words to Lessons"
        : `Add ${selectedCount} ${selectedCount === 1 ? "word" : "words"} to Lessons`;
}

function importSelectedCollectionWords() {
    const collection = getActiveWordCollection();
    const status = document.getElementById("collectionImportStatus");
    if (!collection || !status) return;

    const requested = collection.words.filter(word => selectedCollectionWordIds.has(word.id));
    const additions = requested.filter(word => !hasVocabularyWord(word));
    const skipped = requested.length - additions.length;

    additions.forEach(word => {
        words.push({
            id: word.id,
            collectionId: collection.id,
            english: word.english,
            kanji: word.kanji,
            hiragana: word.hiragana,
            jlpt: "Unknown",
            category: "No Category",
            pos: word.pos,
            ...newSrsFields()
        });
    });

    selectedCollectionWordIds.clear();
    if (additions.length > 0) saveData();
    updateAll();

    if (additions.length === 0) {
        status.textContent = requested.length
            ? "Those words are already in your vocabulary."
            : "Choose at least one word first.";
        return;
    }

    status.textContent = `${additions.length} new ${additions.length === 1 ? "word was" : "words were"} added to Lessons.${skipped ? ` You already had ${skipped}.` : ""}`;
}


/* =========================================================
   LEARNING GARDEN
   Garden state reads SRS progress but never changes scheduling.
========================================================= */

function getGardenLearningTimestamp(word) {
    const lessonTimes = (Array.isArray(word.reviewLog) ? word.reviewLog : [])
        .filter(entry => entry?.activity === "lesson")
        .map(entry => new Date(entry.reviewedAt).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    if (lessonTimes.length) return lessonTimes[0];

    const reviewTimes = (Array.isArray(word.reviewLog) ? word.reviewLog : [])
        .map(entry => new Date(entry?.reviewedAt).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    if (reviewTimes.length) return reviewTimes[0];

    const fallback = new Date(word.lastReviewedAt || (word.lastReviewed ? `${word.lastReviewed}T00:00:00` : "")).getTime();
    return Number.isFinite(fallback) ? fallback : Number.MAX_SAFE_INTEGER;
}

function getGardenStudyDays() {
    return new Set([
        ...Object.entries(stats.reviewHistory || {}).filter(([, count]) => Number(count) > 0).map(([date]) => date),
        ...Object.entries(stats.lessonHistory || {}).filter(([, count]) => Number(count) > 0).map(([date]) => date)
    ]);
}

function getGardenPlotMetrics(plot) {
    const savedWords = new Map(words.map(word => [wordIdentity(word), word]));
    const plotWords = plot.wordKeys.map(key => savedWords.get(key)).filter(Boolean);
    const plantedTime = new Date(plot.plantedAt || "").getTime();
    const hasQualifyingReview = word => Number.isFinite(plantedTime) &&
        (Array.isArray(word.reviewLog) ? word.reviewLog : []).some(entry => {
            const reviewTime = new Date(entry?.reviewedAt || "").getTime();
            return entry?.activity === "review" && entry.rating !== "again" &&
                Number.isFinite(reviewTime) && reviewTime >= plantedTime;
        });
    const establishedWords = plotWords.filter(hasQualifyingReview);
    return {
        reviewedSincePlanting: establishedWords.length,
        sevenDays: establishedWords.filter(word => Number(word.intervalDays) >= 7).length,
        thirtyDays: establishedWords.filter(word => Number(word.intervalDays) >= 30).length,
        longTerm: establishedWords.filter(word => Number(word.intervalDays) >= 60).length
    };
}

function getEligibleGardenStage(plot) {
    if (plot.wordKeys.length < GARDEN_WORDS_PER_PLOT) return "preparing";
    if (!plot.plant) return "planted";
    const metrics = getGardenPlotMetrics(plot);
    if (metrics.longTerm >= 6) return "flourishing";
    if (metrics.thirtyDays >= 6) return "growing-well";
    if (metrics.sevenDays >= 6) return "taking-root";
    return "planted";
}

function migrateGardenStateToV2(state, learnedWords) {
    if (state.version >= GARDEN_STATE_VERSION) return state;

    const migratedAt = new Date().toISOString();
    const existingOrder = state.plots.flatMap(plot => plot.wordKeys);
    const learnedKeySet = new Set(learnedWords.map(item => item.key));
    const orderedKeys = [...new Set([
        ...existingOrder.filter(key => learnedKeySet.has(key)),
        ...learnedWords.map(item => item.key)
    ])]
        .filter(Boolean);

    state.plots = state.plots.map((plot, index) => ({
        ...plot,
        // Historical vocabulary can prepare one welcoming plot, not an
        // instantly completed garden. Later choices are retained as pending.
        wordKeys: index === 0 ? orderedKeys.slice(0, GARDEN_WORDS_PER_PLOT) : [],
        plantedAt: index === 0 && plot.plant ? migratedAt : null,
        highestStage: index === 0 ? plot.highestStage : "preparing"
    }));
    state.version = GARDEN_STATE_VERSION;
    state.startedAt = migratedAt;
    return state;
}

function synchroniseGardenState() {
    const previous = JSON.stringify(userSettings.gardenState || null);
    const state = normaliseGardenState(userSettings.gardenState);
    const learnedWords = words
        .filter(word => !isNewWord(word))
        .map(word => ({ key: wordIdentity(word), learnedAt: getGardenLearningTimestamp(word) }))
        .filter(item => item.key)
        .sort((a, b) => a.learnedAt - b.learnedAt || a.key.localeCompare(b.key, "ja"));
    migrateGardenStateToV2(state, learnedWords);

    const assignedKeys = new Set(state.plots.flatMap(plot => plot.wordKeys));
    const gardenStartTime = new Date(state.startedAt || "").getTime();

    state.plots.forEach((plot, plotIndex) => {
        const candidates = learnedWords.filter(candidate => {
            if (assignedKeys.has(candidate.key)) return false;
            if (plotIndex === 0) return true;
            return candidate.learnedAt !== Number.MAX_SAFE_INTEGER &&
                Number.isFinite(gardenStartTime) && candidate.learnedAt >= gardenStartTime;
        });
        let candidateIndex = 0;
        while (plot.wordKeys.length < GARDEN_WORDS_PER_PLOT && candidateIndex < candidates.length) {
            const candidate = candidates[candidateIndex++];
            plot.wordKeys.push(candidate.key);
            assignedKeys.add(candidate.key);
        }

        // A plant choice retained from the old garden starts growing only
        // once its corrected plot genuinely becomes ready.
        if (plot.wordKeys.length >= GARDEN_WORDS_PER_PLOT && plot.plant && !plot.plantedAt) {
            plot.plantedAt = new Date().toISOString();
        }

        const eligibleStage = getEligibleGardenStage(plot);
        if (GARDEN_STAGES.indexOf(eligibleStage) > GARDEN_STAGES.indexOf(plot.highestStage)) {
            plot.highestStage = eligibleStage;
        }
    });

    if (getGardenStudyDays().size >= 7 && !state.unlockedAmbience.includes("visiting-bird")) {
        state.unlockedAmbience.push("visiting-bird");
    }

    userSettings.gardenState = state;
    return previous !== JSON.stringify(state);
}

function getGardenStageLabel(stage) {
    return ({
        preparing: "Preparing",
        planted: "Planted",
        "taking-root": "Taking root",
        "growing-well": "Growing well",
        flourishing: "Flourishing"
    })[stage] || "Preparing";
}

function getGardenPlotMessage(plot) {
    if (plot.wordKeys.length < GARDEN_WORDS_PER_PLOT) {
        return `${plot.wordKeys.length} of ${GARDEN_WORDS_PER_PLOT} words planted.`;
    }
    if (!plot.plant) return "This plot is ready. Choose what should grow here.";

    const plantName = GARDEN_PLANTS[plot.plant];
    const metrics = getGardenPlotMetrics(plot);
    if (plot.highestStage === "flourishing") return `Your ${plantName.toLowerCase()} are flourishing.`;
    if (plot.highestStage === "growing-well") return `${metrics.longTerm} of 10 words have reached Long-term.`;
    if (plot.highestStage === "taking-root") return `${metrics.thirtyDays} of 10 words have reached a 30-day interval after planting.`;
    return `${metrics.sevenDays} of 10 words are becoming established through review.`;
}

function updateLearningGardenAtmosphere() {
    const scene = document.getElementById("learningGardenScene");
    const hero = document.querySelector(".site-hero");
    if (!scene || !hero) return;
    scene.dataset.season = hero.dataset.season || "spring";
    scene.dataset.time = hero.dataset.time || "day";
    prepareGardenMascotSwap();
}

function prepareGardenMascotSwap() {
    const scene = document.getElementById("learningGardenScene");
    const sleeping = document.getElementById("gardenSleepingTobuKaba");
    if (!scene || !sleeping) return;

    const showSleepingPose = () => scene.classList.add("sleeping-mascot-ready");
    const keepAwakeFallback = () => scene.classList.remove("sleeping-mascot-ready");
    if (sleeping.complete) {
        if (Number(sleeping.naturalWidth) > 0) showSleepingPose();
        else keepAwakeFallback();
        return;
    }
    if (sleeping.dataset.loadFallbackBound === "true") return;
    sleeping.dataset.loadFallbackBound = "true";
    sleeping.addEventListener("load", showSleepingPose, { once: true });
    sleeping.addEventListener("error", keepAwakeFallback, { once: true });
}

let gardenBlinkTimer = null;
const gardenPlantAnimationTimers = new WeakMap();

function gardenMotionIsReduced() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function triggerGardenTobuKabaBlink() {
    const button = document.getElementById("gardenTobuKabaButton");
    if (!button || gardenMotionIsReduced()) return;

    clearTimeout(gardenBlinkTimer);
    button.classList.remove("is-blinking");
    // Restart the short interaction when TobuKaba is clicked repeatedly.
    void button.offsetWidth;
    button.classList.add("is-blinking");
    gardenBlinkTimer = setTimeout(() => button.classList.remove("is-blinking"), 560);
}

function clearGardenPondReactions(pond) {
    pond?.querySelectorAll?.(".garden-reaction").forEach(reaction => reaction.remove());
}

function createGardenPondReaction(event) {
    const pond = event.currentTarget || document.getElementById("gardenPond");
    if (!pond || gardenMotionIsReduced()) return;

    clearGardenPondReactions(pond);
    const bounds = pond.getBoundingClientRect();
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    const hasPointerPosition = event.detail !== 0 && Number.isFinite(pointerX) && Number.isFinite(pointerY);
    const x = hasPointerPosition ? Math.max(12, Math.min(bounds.width - 12, pointerX - bounds.left)) : bounds.width * .52;
    const y = hasPointerPosition ? Math.max(12, Math.min(bounds.height - 12, pointerY - bounds.top)) : bounds.height * .52;

    for (let index = 0; index < 2; index++) {
        const ripple = document.createElement("span");
        ripple.className = "garden-reaction garden-reaction-ripple";
        ripple.setAttribute("aria-hidden", "true");
        ripple.style.setProperty("--reaction-x", `${x + index * 4}px`);
        ripple.style.setProperty("--reaction-y", `${y + index * 2}px`);
        ripple.style.animationDelay = `${index * 90}ms`;
        pond.appendChild(ripple);
    }

    for (let index = 0; index < 3; index++) {
        const bubble = document.createElement("span");
        bubble.className = "garden-reaction garden-reaction-bubble";
        bubble.setAttribute("aria-hidden", "true");
        bubble.style.setProperty("--reaction-x", `${x + (index - 1) * 9}px`);
        bubble.style.setProperty("--reaction-y", `${y + index * 3}px`);
        bubble.style.setProperty("--bubble-delay", `${index * 75}ms`);
        bubble.style.setProperty("--bubble-drift", `${(index - 1) * 7}px`);
        pond.appendChild(bubble);
    }

    setTimeout(() => clearGardenPondReactions(pond), 900);
}

function triggerGardenPlantSway(event) {
    const plot = event.currentTarget;
    if (!plot || gardenMotionIsReduced() || plot.dataset.stage === "preparing" || plot.dataset.plant === "unplanted") return;

    clearTimeout(gardenPlantAnimationTimers.get(plot));
    plot.classList.remove("is-swaying");
    void plot.offsetWidth;
    plot.classList.add("is-swaying");
    gardenPlantAnimationTimers.set(plot, setTimeout(() => plot.classList.remove("is-swaying"), 720));
}

function bindLearningGardenInteractions() {
    const hippo = document.getElementById("gardenTobuKabaButton");
    const pond = document.getElementById("gardenPond");
    if (hippo && hippo.dataset.interactionBound !== "true") {
        hippo.dataset.interactionBound = "true";
        hippo.addEventListener("click", triggerGardenTobuKabaBlink);
    }
    if (pond && pond.dataset.interactionBound !== "true") {
        pond.dataset.interactionBound = "true";
        pond.addEventListener("click", createGardenPondReaction);
    }
    document.querySelectorAll(".garden-plot-visual").forEach(plot => {
        if (plot.dataset.interactionBound === "true") return;
        plot.dataset.interactionBound = "true";
        plot.addEventListener("click", triggerGardenPlantSway);
    });
}

function renderLearningGarden() {
    const garden = document.getElementById("learningGarden");
    const controls = document.getElementById("gardenPlotControls");
    if (!garden || !controls) return;

    synchroniseGardenState();
    const state = userSettings.gardenState;
    updateLearningGardenAtmosphere();

    state.plots.forEach((plot, index) => {
        const visual = document.getElementById(`gardenPlotVisual${index + 1}`);
        if (!visual) return;
        visual.dataset.stage = plot.highestStage;
        visual.dataset.plant = plot.plant || "unplanted";
        const canSway = plot.highestStage !== "preparing" && Boolean(plot.plant);
        visual.setAttribute("aria-label", `Plot ${index + 1}: ${getGardenStageLabel(plot.highestStage)}${canSway ? ". Make the plant sway" : ""}`);
    });

    const bird = document.getElementById("gardenBird");
    if (bird) bird.hidden = !state.unlockedAmbience.includes("visiting-bird");

    controls.innerHTML = state.plots.map((plot, index) => {
        const ready = plot.wordKeys.length >= GARDEN_WORDS_PER_PLOT;
        const plantButtons = ready
            ? `<div class="garden-plant-choices" role="group" aria-label="Choose a plant for plot ${index + 1}">
                ${Object.entries(GARDEN_PLANTS).map(([key, label]) => `
                  <button type="button" aria-pressed="${plot.plant === key}" onclick="chooseGardenPlant('${plot.id}','${key}')">${escapeHtml(label)}</button>`).join("")}
               </div>`
            : "";
        return `
          <article class="garden-plot-control">
            <div class="garden-plot-control-heading">
              <strong>Garden plot ${index + 1}</strong>
              <span>${escapeHtml(getGardenStageLabel(plot.highestStage))}</span>
            </div>
            <p>${escapeHtml(getGardenPlotMessage(plot))}</p>
            ${plantButtons}
          </article>`;
    }).join("");

    const overview = document.getElementById("gardenOverviewText");
    if (overview) {
        const learnedCount = state.plots.reduce((total, plot) => total + plot.wordKeys.length, 0);
        const flourishing = state.plots.filter(plot => plot.highestStage === "flourishing").length;
        overview.textContent = flourishing
            ? `${flourishing} ${flourishing === 1 ? "part" : "parts"} of the garden ${flourishing === 1 ? "is" : "are"} flourishing.`
            : `${learnedCount} learned ${learnedCount === 1 ? "word is" : "words are"} helping the garden take shape.`;
    }
}

bindLearningGardenInteractions();
document.addEventListener("DOMContentLoaded", bindLearningGardenInteractions);

function chooseGardenPlant(plotId, plant) {
    if (!Object.hasOwn(GARDEN_PLANTS, plant)) return;
    synchroniseGardenState();
    const plot = userSettings.gardenState.plots.find(item => item.id === plotId);
    if (!plot || plot.wordKeys.length < GARDEN_WORDS_PER_PLOT) return;
    if (!plot.plantedAt) plot.plantedAt = new Date().toISOString();
    plot.plant = plant;
    saveData();
    renderLearningGarden();
}

function visitLearningGarden() {
    showPage("statistics");
    setTravelView("home");
    const garden = document.getElementById("learningGarden");
    if (!garden) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    garden.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}


/* =========================================================
   TOBUKABA'S TRAVELS
   Content and state rules live outside the interface in travel-system.js.
========================================================= */

let activeTravelView = "home";

function travelContent() {
    if (!globalThis.TobuKabaTravel || !globalThis.TOBUKABA_TRAVEL_CONTENT) return null;
    return globalThis.TobuKabaTravel.normaliseTravelContent(globalThis.TOBUKABA_TRAVEL_CONTENT);
}

function editableTravelState() {
    return userSettings.travelState;
}

function setEditableTravelState(state) {
    userSettings.travelState = state;
}

function travelProgressForDisplay(state, content) {
    return globalThis.TobuKabaTravel.calculateJourneyProgress(state, words, content);
}

function synchroniseTravelProgress() {
    if (!globalThis.TobuKabaTravel || !globalThis.TOBUKABA_TRAVEL_CONTENT) return false;
    const previous = JSON.stringify(userSettings.travelState || null);
    let state = globalThis.TobuKabaTravel.migrateGardenStateToTravelState(
        userSettings.gardenState,
        userSettings.travelState,
        globalThis.TOBUKABA_TRAVEL_CONTENT
    );
    state = globalThis.TobuKabaTravel.synchroniseProgress(
        state,
        words,
        globalThis.TOBUKABA_TRAVEL_CONTENT
    );
    userSettings.travelState = state;
    return previous !== JSON.stringify(state);
}

function persistTravelChange() {
    saveData();
    updateAll();
}

function setTravelView(view) {
    activeTravelView = "home";
    const homeView = document.getElementById("travelHomeView");
    if (homeView) homeView.hidden = false;
    syncHomePondMotionState();
}

function syncHomePondMotionState() {
    const scene = document.getElementById("learningGardenScene");
    const homeView = document.getElementById("travelHomeView");
    if (!scene) return;
    scene.classList.toggle("is-motion-paused", document.hidden || Boolean(homeView?.hidden));
    const rareEvent = scene.querySelector(".home-pond-rare-event");
    if (rareEvent) {
        const availableTimes = String(rareEvent.dataset.availableTimes || "").split(/\s+/).filter(Boolean);
        rareEvent.hidden = availableTimes.length > 0 && !availableTimes.includes(scene.dataset.time || "day");
    }
}

function togglePondCompanion(companionId) {
    const content = travelContent();
    const state = globalThis.TobuKabaTravel.normaliseTravelState(editableTravelState(), content);
    const visible = !state.visibleCompanionIds.includes(companionId);
    setEditableTravelState(globalThis.TobuKabaTravel.setCompanionVisible(
        state, companionId, visible, content
    ));
    persistTravelChange();
}

function clearCompanionNotification(companionId) {
    const state = editableTravelState();
    if (!state) return;
    setEditableTravelState(globalThis.TobuKabaTravel.dismissCompanionNotification(
        state, companionId, globalThis.TOBUKABA_TRAVEL_CONTENT
    ));
    persistTravelChange();
}

function renderTravelCompletion(state, content) {
    const container = document.getElementById("travelCompletion");
    if (!container) return;
    const companionId = state.pendingCompanionIds[0];
    const companion = content.companions.find(item => item.id === companionId);
    if (!companion) {
        container.hidden = true;
        container.innerHTML = "";
        return;
    }
    container.hidden = false;
    container.innerHTML = `
      <img class="companion-notification-portrait" src="${escapeHtml(companion.portraitAsset || companion.image)}" alt="">
      <div><p class="eyebrow">NEW COMPANION FOUND</p><h4>${escapeHtml(companion.name)} has joined TobuKaba’s adventure.</h4>
      <p>${escapeHtml(companion.description)} Choose whether ${escapeHtml(companion.name)} appears in the Home Pond.</p></div>
      <button class="primary-btn" type="button" onclick="clearCompanionNotification('${escapeHtml(companion.id)}')">Meet ${escapeHtml(companion.name)}</button>`;
}

function travelSceneToken(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function renderJourneyView(state, content) {
    const container = document.getElementById("travelJourneyView");
    if (!container) return;
    const progress = travelProgressForDisplay(state, content);
    const nextCompanion = content.companions.find(companion => !state.unlockedCompanionIds.includes(companion.id));
    const nextCopy = nextCompanion
        ? `${Math.max(0, nextCompanion.milestoneUnits - progress.units)} memory steps until the next discovery.`
        : "Every companion currently on this journey has been discovered.";
    container.innerHTML = `
      <div class="journey-summary-copy">
        <div><p class="eyebrow">JOURNEY PROGRESS</p><h4>A fixed adventure, moved forward by study.</h4></div>
        <strong>${progress.units} of ${progress.requiredUnits} memory steps</strong>
      </div>
      <div class="journey-progress-track" role="progressbar" aria-label="TobuKaba’s journey progress" aria-valuemin="0" aria-valuemax="${progress.requiredUnits}" aria-valuenow="${progress.units}"><span style="width:${progress.ratio * 100}%"></span></div>
      <p class="journey-next-milestone">${escapeHtml(nextCopy)}</p>`;
}

function renderHomePondEnvironment(content) {
    const scene = document.getElementById("learningGardenScene");
    const environment = document.getElementById("homePondEnvironment");
    const motionLayer = document.getElementById("homePondMotion");
    if (!scene || !environment) return;

    const pond = content.homePond || {};
    const layers = Array.isArray(pond.layers) ? pond.layers : [];
    environment.innerHTML = layers.map(layer => {
        const token = travelSceneToken(layer.id || "layer");
        const depth = Math.max(1, Math.min(20, Number(layer.depth) || 1));
        return `<img class="home-pond-layer home-pond-layer-${token}" src="${escapeHtml(layer.asset || "")}" style="--home-pond-layer-depth:${depth}" alt="" draggable="false">`;
    }).join("");

    const anchors = pond.anchors || {};
    const hippo = anchors.tobuKaba || {};
    const interaction = anchors.pondInteraction || {};
    scene.style.setProperty("--home-pond-hippo-left", `${Number(hippo.left) || 35}%`);
    scene.style.setProperty("--home-pond-hippo-top", `${Number(hippo.top) || 62}%`);
    scene.style.setProperty("--home-pond-hippo-width", `${Number(hippo.width) || 18}%`);
    scene.style.setProperty("--home-pond-interaction-left", `${Number(interaction.left) || 50}%`);
    scene.style.setProperty("--home-pond-interaction-top", `${Number(interaction.top) || 63}%`);
    scene.style.setProperty("--home-pond-interaction-width", `${Number(interaction.width) || 70}%`);
    scene.style.setProperty("--home-pond-interaction-height", `${Number(interaction.height) || 48}%`);

    const motion = pond.motion || {};
    const cloudMotion = motion.clouds || {};
    const waterMotion = motion.water || {};
    const lilyMotion = motion.lilyPad || {};
    const rareEvent = motion.rareEvent || {};
    const characterMotion = motion.characters || {};
    scene.style.setProperty("--home-pond-cloud-seconds", `${Number(cloudMotion.duration) || 72}s`);
    scene.style.setProperty("--home-pond-cloud-delay", `${Number(cloudMotion.delay) || 0}s`);
    scene.style.setProperty("--home-pond-cloud-opacity", String(Number(cloudMotion.opacity) || .72));
    scene.style.setProperty("--home-pond-cloud-distance", `${Number(cloudMotion.travelPercent) || 7}%`);
    scene.style.setProperty("--home-pond-cloud-distance-negative", `${-(Number(cloudMotion.travelPercent) || 7)}%`);
    scene.style.setProperty("--home-pond-water-seconds", `${Number(waterMotion.duration) || 15}s`);
    scene.style.setProperty("--home-pond-water-delay", `${Number(waterMotion.delay) || 0}s`);
    scene.style.setProperty("--home-pond-water-opacity", String(Number(waterMotion.opacity) || .16));
    scene.style.setProperty("--home-pond-water-amplitude", `${Number(waterMotion.amplitude) || 1.5}px`);
    scene.style.setProperty("--home-pond-water-amplitude-negative", `${-(Number(waterMotion.amplitude) || 1.5)}px`);
    scene.style.setProperty("--home-pond-water-secondary-seconds", `${Number(waterMotion.secondaryDuration) || 8.6}s`);
    scene.style.setProperty("--home-pond-water-secondary-delay", `${Number(waterMotion.secondaryDelay) || 0}s`);
    scene.style.setProperty("--home-pond-water-secondary-opacity", String(Number(waterMotion.secondaryOpacity) || .1));
    scene.style.setProperty("--home-pond-water-scale", String(Number(waterMotion.horizontalScale) || .006));
    scene.style.setProperty("--home-pond-waterline-seconds", `${Number(waterMotion.waterlineDuration) || 8.5}s`);
    scene.style.setProperty("--home-pond-waterline-delay", `${Number(waterMotion.waterlineDelay) || 0}s`);
    scene.style.setProperty("--home-pond-lily-seconds", `${Number(lilyMotion.duration) || 28}s`);
    scene.style.setProperty("--home-pond-lily-delay", `${Number(lilyMotion.delay) || 0}s`);
    scene.style.setProperty("--home-pond-lily-opacity", String(Number(lilyMotion.opacity) || .96));
    scene.style.setProperty("--home-pond-lily-scale", String(Number(lilyMotion.scale) || .72));
    scene.style.setProperty("--home-pond-lily-start-x", `${Number(lilyMotion.startXPercent) || -7}%`);
    scene.style.setProperty("--home-pond-lily-end-x", `${Number(lilyMotion.endXPercent) || 5}%`);
    scene.style.setProperty("--home-pond-lily-y", `${Number(lilyMotion.verticalPercent) || -11}%`);
    scene.style.setProperty("--home-pond-lily-bob", `${Number(lilyMotion.bobPixels) || 1}px`);
    scene.style.setProperty("--home-pond-lily-rotation", `${Number(lilyMotion.rotationDegrees) || .4}deg`);
    scene.style.setProperty("--home-pond-lily-rotation-negative", `${-(Number(lilyMotion.rotationDegrees) || .4)}deg`);
    scene.style.setProperty("--home-pond-lily-clip", lilyMotion.clip || "polygon(44% 61%,66% 61%,66% 70%,44% 70%)");
    scene.style.setProperty("--home-pond-rare-seconds", `${Number(rareEvent.intervalSeconds) || 32}s`);
    scene.style.setProperty("--home-pond-rare-delay", `${Number(rareEvent.delay) || 0}s`);
    scene.style.setProperty("--home-pond-rare-scale", String(Number(rareEvent.scale) || .45));
    scene.style.setProperty("--home-pond-hippo-float-seconds", `${Number(characterMotion.tobuKaba?.floatSeconds) || 8}s`);
    scene.style.setProperty("--home-pond-hippo-float-pixels", `${Number(characterMotion.tobuKaba?.floatPixels) || 1}px`);
    scene.style.setProperty("--home-pond-hippo-blink-seconds", `${Number(characterMotion.tobuKaba?.blinkSeconds) || 11}s`);
    scene.style.setProperty("--home-pond-kotaro-breathe-seconds", `${Number(characterMotion.kotaro?.breatheSeconds) || 7.5}s`);
    scene.style.setProperty("--home-pond-kotaro-ear-seconds", `${Number(characterMotion.kotaro?.earTwitchSeconds) || 23}s`);
    scene.style.setProperty("--home-pond-kotaro-tail-seconds", `${Number(characterMotion.kotaro?.tailTwitchSeconds) || 37}s`);
    if (motionLayer) {
        const signature = JSON.stringify(motion);
        if (motionLayer.dataset.motionSignature === signature) {
            syncHomePondMotionState();
            return;
        }
        const artworkAccent = item => {
            const id = travelSceneToken(item.id || "accent");
            const kind = travelSceneToken(item.kind || "foliage");
            const depth = Math.max(1, Math.min(20, Number(item.depth) || 8));
            const amplitude = Number(item.amplitude) || 1;
            const style = `--accent-depth:${depth};--accent-clip:${escapeHtml(item.clip || "inset(0)")};--accent-origin:${escapeHtml(item.origin || "50% 50%")} ;--accent-duration:${Number(item.duration) || 10}s;--accent-delay:${Number(item.delay) || 0}s;--accent-amplitude:${amplitude}deg;--accent-amplitude-negative:${-amplitude}deg`;
            return `<span class="home-pond-artwork-accent accent-${kind} accent-${id}" style="${style}"><img src="${escapeHtml(item.asset || "")}" alt="" draggable="false"></span>`;
        };
        motionLayer.innerHTML = motion.enabled === false ? "" : [
            cloudMotion.asset ? `<img class="home-pond-cloud-loop" src="${escapeHtml(cloudMotion.asset)}" style="--motion-depth:${Math.max(1, Math.min(20, Number(cloudMotion.depth) || 1))}" alt="" draggable="false">` : "",
            waterMotion.asset ? `<img class="home-pond-water-reflections home-pond-water-reflections-primary" src="${escapeHtml(waterMotion.asset)}" style="--motion-depth:${Math.max(1, Math.min(20, Number(waterMotion.depth) || 8))}" alt="" draggable="false">` : "",
            waterMotion.asset ? `<img class="home-pond-water-reflections home-pond-water-reflections-secondary" src="${escapeHtml(waterMotion.asset)}" style="--motion-depth:${Math.max(1, Math.min(20, Number(waterMotion.depth) || 8))}" alt="" draggable="false">` : "",
            waterMotion.asset ? `<span class="home-pond-waterline"><img src="${escapeHtml(waterMotion.asset)}" alt="" draggable="false"></span>` : "",
            lilyMotion.asset ? `<span class="home-pond-lily-path" style="--motion-depth:${Math.max(1, Math.min(20, Number(lilyMotion.depth) || 4))}"><img class="home-pond-lily-pad" src="${escapeHtml(lilyMotion.asset)}" alt="" draggable="false"></span>` : "",
            ...(Array.isArray(motion.artworkAccents) ? motion.artworkAccents.map(artworkAccent) : []),
            rareEvent.enabled && rareEvent.asset ? `<img class="home-pond-rare-event" src="${escapeHtml(rareEvent.asset)}" style="--motion-depth:${Math.max(1, Math.min(20, Number(rareEvent.depth) || 8))}" data-available-times="${escapeHtml((rareEvent.availableTimes || []).join(" "))}" alt="" draggable="false">` : ""
        ].join("");
        motionLayer.dataset.motionSignature = signature;
    }
    syncHomePondMotionState();
}

function renderHomePondView(state, content) {
    const controls = document.getElementById("gardenPlotControls");
    if (!controls) return;
    renderHomePondEnvironment(content);
    updateLearningGardenAtmosphere();
    syncHomePondMotionState();

    const visitorLayer = document.getElementById("pondVisitorLayer");
    if (visitorLayer) {
        visitorLayer.innerHTML = content.companions
            .filter(companion => state.visibleCompanionIds.includes(companion.id) && companion.image)
            .map(companion => {
                const position = companion.pondPosition || { left: 70, top: 60, width: 18 };
                const asset = escapeHtml(companion.image);
                return `<button class="pond-visitor pond-visitor-${travelSceneToken(companion.id)}" type="button" style="--visitor-left:${Number(position.left) || 70}%;--visitor-top:${Number(position.top) || 60}%;--visitor-width:${Number(position.width) || 18}%" aria-label="${escapeHtml(`${companion.name}, ${companion.description}`)}"><span class="pond-visitor-breath"><img class="pond-visitor-base" src="${asset}" alt=""><span class="pond-visitor-detail pond-visitor-ear" aria-hidden="true"><img src="${asset}" alt=""></span><span class="pond-visitor-detail pond-visitor-tail" aria-hidden="true"><img src="${asset}" alt=""></span></span></button>`;
            }).join("");
    }
    const visits = document.getElementById("pondFriendVisits");
    if (visits) visits.innerHTML = "";
    const cape = document.getElementById("homePondCape");
    if (cape) {
        cape.src = content.homePond?.capeAsset || "assets/home-pond/spring/cape-draped-v3.png";
        cape.hidden = false;
    }

    controls.innerHTML = `
      <div class="pond-control-heading"><div><p class="eyebrow">COMPANIONS</p><h4>Choose who spends time at the pond.</h4><p>Discovered companions can be shown or given a little quiet time away.</p></div></div>
      <div class="companion-collection">${content.companions.map(companion => {
          const unlocked = state.unlockedCompanionIds.includes(companion.id);
          const visible = unlocked && state.visibleCompanionIds.includes(companion.id);
          return `<article class="companion-card ${unlocked ? "unlocked" : "locked"}">
            <img src="${escapeHtml(companion.portraitAsset || companion.image)}" alt="" ${unlocked ? "" : "aria-hidden=\"true\""}>
            <div><p class="eyebrow">${unlocked ? "DISCOVERED" : `UNLOCKS AT ${companion.milestoneUnits} STEPS`}</p><h5>${unlocked ? escapeHtml(companion.name) : "Undiscovered companion"}</h5><p>${unlocked ? escapeHtml(companion.description) : "Keep studying to meet this friend along TobuKaba’s journey."}</p></div>
            <button type="button" class="${visible ? "quiet-link-button" : "primary-btn"}" ${unlocked ? `onclick="togglePondCompanion('${escapeHtml(companion.id)}')"` : "disabled"}>${unlocked ? (visible ? "Remove from pond" : "Show in pond") : "Locked"}</button>
          </article>`;
      }).join("")}</div>`;
}

function renderHomeJourneyCard(state, content) {
    const card = document.getElementById("homeJourneyCard");
    if (!card) return;
    const progress = travelProgressForDisplay(state, content);
    const found = state.unlockedCompanionIds.length;
    const pending = content.companions.find(companion => state.pendingCompanionIds.includes(companion.id));
    card.innerHTML = `<div class="home-journey-mark" aria-hidden="true">${pending ? "友" : "旅"}</div><div><p class="eyebrow">${pending ? "NEW COMPANION FOUND" : "JOURNEY PROGRESS"}</p><h3 id="homeJourneyTitle">${pending ? `${escapeHtml(pending.name)} has joined TobuKaba’s adventure.` : "Study carries TobuKaba forward."}</h3><p>${pending ? "Visit the Home Pond to choose whether your new friend appears there." : `${progress.units} of ${progress.requiredUnits} memory steps · ${found} companion${found === 1 ? "" : "s"} discovered`}</p><div class="journey-progress-track" aria-hidden="true"><span style="width:${progress.ratio * 100}%"></span></div></div><button class="quiet-link-button" type="button" onclick="visitLearningGarden()">${pending ? "Meet your new friend" : "Visit the Home Pond"}</button>`;
}

function renderTravelSystem() {
    if (!globalThis.TobuKabaTravel || !globalThis.TOBUKABA_TRAVEL_CONTENT) {
        renderLearningGarden();
        return;
    }
    const changed = synchroniseTravelProgress();
    const state = editableTravelState();
    const content = travelContent();
    if (changed) {
        localStorage.setItem("kanjiSRSSettings", JSON.stringify(userSettings));
        if (typeof markCloudSavePending === "function") markCloudSavePending();
        if (typeof queueCloudSave === "function") queueCloudSave();
    }
    activeTravelView = "home";
    renderTravelCompletion(state, content);
    renderJourneyView(state, content);
    renderHomePondView(state, content);
    renderHomeJourneyCard(state, content);
    setTravelView(activeTravelView);
    bindLearningGardenInteractions();
}


/* =========================================================
   VOCABULARY TABLE
========================================================= */

function getNextReviewTime(word) {
    if (word.nextReviewAt) {
        const time = new Date(word.nextReviewAt).getTime();
        if (Number.isFinite(time)) return time;
    }

    const fallback = new Date((word.dueDate || today()) + "T00:00:00").getTime();
    return Number.isFinite(fallback) ? fallback : Date.now();
}

function isNewWord(word) {
    return !word.lastReviewedAt && !word.lastReviewed && Number(word.repetitions) === 0;
}

function isDueReview(word) {
    return !isNewWord(word) && isDue(word);
}

function getVocabularyState(word) {
    if (isNewWord(word)) return "new";
    if (isDueReview(word)) return "due";
    if (isLongTerm(word)) return "long-term";
    return "learning";
}

function formatNextDue(word) {
    const timestamp = getNextReviewTime(word);
    const date = new Date(timestamp);

    if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
        return "—";
    }

    if (isNewWord(word)) {
        return "Available as a lesson";
    }

    if (timestamp <= Date.now()) {
        return "Due now";
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeText = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    if (isToday) return `Today, ${timeText}`;
    if (isTomorrow) return `Tomorrow, ${timeText}`;

    const dateText = date.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric"
    });

    return `${dateText}, ${timeText}`;
}


function renderVocabulary() {

    const search =
        document.getElementById("searchInput")
        .value.toLowerCase();

    const category =
        document.getElementById("categoryFilter").value;

    const jlpt =
        document.getElementById("jlptFilter").value;

    const status =
        document.getElementById("statusFilter").value;


    let filtered = words.filter(word => {

        const matchesSearch =

            word.kanji.toLowerCase().includes(search) ||

            word.hiragana.toLowerCase().includes(search) ||

            word.english.toLowerCase().includes(search);


        const matchesCategory =
            !category || word.category === category;


        const matchesJLPT =
            !jlpt || word.jlpt === jlpt;


        let matchesStatus = true;


        if (["new", "due", "learning", "long-term"].includes(status)) {

            matchesStatus = getVocabularyState(word) === status;

        } else if (status === "leech") {

            matchesStatus = isLeech(word);

        }


        return (

            matchesSearch &&

            matchesCategory &&

            matchesJLPT &&

            matchesStatus

        );

    });


    const sort =
        document.getElementById("sortFilter")?.value || "default";

    if (sort === "dueSoonest") {
        filtered.sort((a, b) => getNextReviewTime(a) - getNextReviewTime(b));
    } else if (sort === "dueLatest") {
        filtered.sort((a, b) => getNextReviewTime(b) - getNextReviewTime(a));
    }


    const tbody =
        document.getElementById("vocabularyTable");

    tbody.innerHTML = "";


    filtered.forEach(word => {

        const realIndex =
            words.indexOf(word);


        let progress = "";

        const vocabularyState = getVocabularyState(word);

        if (vocabularyState === "due") {

            progress = `<span class="badge">Due now · ${word.intervalDays}d</span>`;

        } else if (vocabularyState === "long-term") {

            progress =
                `<span class="badge long-term">Long-term · ${word.intervalDays}d</span>`;

        } else if (vocabularyState === "new") {

            progress = `<span class="badge">New</span>`;

        } else {

            progress =
                `${word.intervalDays}d interval`;

        }


        const failureCount = Math.max(0, Number(word.failCount) || 0);
        const failureDisplay = `${failureCount} ${failureCount === 1 ? "mistake" : "mistakes"}` +
            (isLeech(word) ? ` <span class="badge leech">Needs care</span>` : "");


        const row =
            document.createElement("tr");


        row.innerHTML = `

<td data-label="Word">
  <div class="vocabulary-word-form">
    <strong class="kanji-large" lang="ja">${escapeHtml(word.kanji)}</strong>
    <span lang="ja">${escapeHtml(word.hiragana)}</span>
  </div>
</td>

<td data-label="Meaning">
  <div class="vocabulary-meaning">
    <strong>${escapeHtml(word.english)}</strong>
    <span>${escapeHtml(word.pos || "Other")}</span>
  </div>
</td>

<td data-label="Details">
  <div class="vocabulary-details">
    <span class="badge">${escapeHtml(word.category)}</span>
    <span class="badge">${escapeHtml(word.jlpt)}</span>
  </div>
</td>

<td data-label="Learning">
  <div class="vocabulary-learning">
    <div>${progress}</div>
    <span>Next: ${escapeHtml(formatNextDue(word))}</span>
    <span>${failureDisplay}</span>
  </div>
</td>

<td data-label="Actions" class="vocabulary-actions">

<button onclick="editWord(${realIndex})">
Edit
</button>

<button onclick="deleteWord(${realIndex})">
Delete
</button>

</td>

`;


        tbody.appendChild(row);

    });

}


/* =========================================================
   CATEGORY FILTER
========================================================= */

function updateCategoryFilter() {

    const select =
        document.getElementById("categoryFilter");

    const current = select.value;

    const categories =
        [...new Set(words.map(word => word.category))]
        .sort();

    select.innerHTML =
        `<option value="">All Categories</option>`;


    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value = category;

        option.textContent = category;

        select.appendChild(option);

    });


    select.value = current;

}


/* =========================================================
   DASHBOARD FAILURES
========================================================= */

function getTopFailures() {

    // Only include words that have actually been failed.
    return [...words]
        .filter(word => Number(word.failCount) > 0)
        .sort((a,b) => Number(b.failCount) - Number(a.failCount))
        .slice(0,10);

}


function renderFailureList(elementId) {

    const container =
        document.getElementById(elementId);

    if (!container) return;

    const top =
        getTopFailures();

    container.innerHTML = "";


    top.forEach((word, index) => {

        const div =
            document.createElement("div");

        div.className = "history-row";

        div.innerHTML = `

<div>

<strong>${index + 1}. ${word.kanji}</strong>

<br>

${word.hiragana} — ${word.english}

</div>

<div>

${word.failCount} mistakes

</div>

`;

        container.appendChild(div);

    });


    if (container.innerHTML === "") {

        container.innerHTML =
            "No mistakes yet. A calm start.";

    }

}


/* =========================================================
   PROBLEM WORDS
========================================================= */

function renderLeeches() {

    const container =
        document.getElementById("leechList");

    const leeches =
        words.filter(word => isLeech(word));

    container.innerHTML = "";


    if (leeches.length === 0) {

        container.innerHTML =
            "No problem words need attention yet.";

        return;

    }


    leeches.forEach(word => {

        const div =
            document.createElement("div");

        div.className = "history-row";

        div.innerHTML = `

<div>

<strong>${word.kanji}</strong>

<br>

${word.hiragana} — ${word.english}

</div>

<div>

${word.failCount} mistakes

</div>

`;

        container.appendChild(div);

    });

}


/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {

    const container =
        document.getElementById("reviewHistory");

    const dates =
        Object.keys(stats.reviewHistory)
        .sort()
        .reverse()
        .slice(0,14);

    container.innerHTML = "";


    dates.forEach(date => {

        const div =
            document.createElement("div");

        div.className = "history-row";

        div.innerHTML = `

<span>${date}</span>

<strong>
${stats.reviewHistory[date]} reviews
</strong>

`;

        container.appendChild(div);

    });


    if (!dates.length) {

        container.innerHTML =
            "No review history yet.";

    }

}


function renderStudySettings() {

    const daily = document.getElementById("dailyGoalInput");
    const chunk = document.getElementById("chunkSizeInput");
    const strokeSpeed = document.getElementById("strokeSpeedInput");

    if (daily) daily.value = userSettings.dailyGoal;
    if (chunk) chunk.value = userSettings.chunkSize;
    if (strokeSpeed) strokeSpeed.value = userSettings.strokeSpeed;

}


function resetQuizScreen() {
    // Clear any completed-session screen when study pacing changes.
    quizWords = [];
    quizOriginalCount = 0;
    quizRelearningIndexes = new Set();
    quizIndex = 0;
    quizMode = "reviews";
    lessonPhase = "practice";
    lessonCompletedThisSession = 0;
    lessonPracticeQueue = [];
    lessonRecallQueue = [];
    lessonRetryWord = null;
    lastQuizState = null;

    const quizStart = document.getElementById("quizStart");
    const quizArea = document.getElementById("quizArea");
    const quizFinished = document.getElementById("quizFinished");

    if (quizStart) quizStart.style.display = "block";
    if (quizArea) quizArea.style.display = "none";
    if (quizFinished) quizFinished.style.display = "none";

    updateNextChunkButton(false);
    if (typeof resetAnswerReveal === "function") resetAnswerReveal();
}


function saveStudySettings() {

    const daily = Math.max(1, Math.min(500, parseInt(document.getElementById("dailyGoalInput").value, 10) || DEFAULT_SETTINGS.dailyGoal));
    const chunk = Math.max(1, Math.min(100, parseInt(document.getElementById("chunkSizeInput").value, 10) || DEFAULT_SETTINGS.chunkSize));
    const selectedStrokeSpeed = document.getElementById("strokeSpeedInput")?.value;
    const strokeSpeed = ["relaxed", "standard", "quick"].includes(selectedStrokeSpeed)
        ? selectedStrokeSpeed
        : DEFAULT_SETTINGS.strokeSpeed;

    const oldDailyGoal = userSettings.dailyGoal;

    userSettings.dailyGoal = daily;
    userSettings.chunkSize = chunk;
    userSettings.strokeSpeed = strokeSpeed;

    saveData();

    // If the lesson goal changes, clear the old completion screen so its
    // progress message cannot describe the previous target.
    if (daily !== oldDailyGoal) {
        resetQuizScreen();
    }

    renderStudySettings();
    updateAll();

    const saved = document.getElementById("settingsSaved");
    if (saved) {
        saved.textContent = "✓ Saved";
        setTimeout(() => saved.textContent = "", 1800);
    }

}


/* =========================================================
   UPDATE DASHBOARD
========================================================= */

function updateDashboard() {

    const due = getDueReviewWords().length;
    const newLessons = getNewLessonWords().length;

    const leeches =
        words.filter(isLeech).length;

    const todayReviews =
        stats.reviewHistory[today()] || 0;
    const todayLessons =
        stats.lessonHistory[today()] || 0;


    document.getElementById("totalWords")
        .textContent = words.length;

    document.getElementById("dueWords")
        .textContent = due;

    document.getElementById("newWords")
        .textContent = newLessons;

    document.getElementById("streak")
        .textContent = stats.streak;

    document.getElementById("todayLessons")
        .textContent = todayLessons;

    document.getElementById("homeReviewsCompleted")
        .textContent = todayReviews;

    document.getElementById("dailyGoalDisplay")
        .textContent = userSettings.dailyGoal;

    renderStudySettings();


    const percentage =
        Math.min(
            100,
            (todayLessons / userSettings.dailyGoal) * 100
        );


    document.getElementById("goalProgress")
        .style.width = percentage + "%";

    document.getElementById("homeGoalPercent")
        .textContent = Math.round(percentage) + "%";

    const remainingLessons = getRemainingDailyLessons();
    const title = document.getElementById("homeStudyTitle");
    const description = document.getElementById("homeStudyDescription");
    const kicker = document.getElementById("homeStudyKicker");
    const reviewCta = document.getElementById("homeReviewCta");
    const lessonCta = document.getElementById("homeLessonCta");
    const difficultSummary = document.getElementById("homeDifficultSummary");

    updateStudyLauncher();
    if (reviewCta) {
        reviewCta.disabled = due === 0;
        reviewCta.textContent = todayReviews > 0 ? "Continue reviews" : "Start reviews";
    }
    if (lessonCta) {
        lessonCta.disabled = newLessons === 0;
        lessonCta.textContent = "Learn new words";
    }
    if (difficultSummary) {
        difficultSummary.textContent = leeches
            ? `${leeches} ${leeches === 1 ? "word needs" : "words need"} another look.`
            : "Nothing needs special attention right now.";
    }

    if (due > 0) {
        if (kicker) kicker.textContent = "YOUR NEXT STEP";
        if (title) title.textContent = todayReviews > 0 ? "Keep your path going." : "Your words are ready.";
        if (description) description.textContent = due === 1
            ? "One word is waiting for your attention."
            : `${due} words are waiting for your attention.`;
    } else if (newLessons > 0 && remainingLessons > 0) {
        if (kicker) kicker.textContent = "READY FOR SOMETHING NEW";
        if (title) title.textContent = "No reviews are due.";
        if (description) description.textContent = `${remainingLessons} more ${remainingLessons === 1 ? "new word" : "new words"} will complete today’s lesson goal.`;
    } else if (newLessons > 0) {
        if (kicker) kicker.textContent = "TODAY'S LESSON GOAL IS COMPLETE";
        if (title) title.textContent = "Your new words are taking root.";
        if (description) description.textContent = "There are no reviews due. More lessons are available whenever you want them.";
    } else {
        if (kicker) kicker.textContent = "A QUIET MOMENT";
        if (title) title.textContent = "Nothing is due right now.";
        if (description) description.textContent = "Your reviewed words are resting until their next scheduled time.";
    }


    renderFailureList("dashboardFailures");

    renderHistoryDashboard();

}

function updateStudyLauncher() {
    const due = getDueReviewWords().length;
    const lessons = getNewLessonWords().length;
    const reviewCount = document.getElementById("reviewQueueCount");
    const lessonCount = document.getElementById("lessonQueueCount");
    const reviewButton = document.getElementById("startReviewsButton");
    const lessonButton = document.getElementById("startLessonsButton");

    if (reviewCount) reviewCount.textContent = `${due} ${due === 1 ? "review" : "reviews"} due`;
    if (lessonCount) lessonCount.textContent = `${lessons} new ${lessons === 1 ? "word" : "words"}`;
    if (reviewButton) {
        reviewButton.disabled = due === 0;
        reviewButton.textContent = due ? "Start reviews" : "No reviews due";
    }
    if (lessonButton) {
        lessonButton.disabled = lessons === 0;
        lessonButton.textContent = lessons ? "Start lessons" : "No new words";
    }
}


/* =========================================================
   DASHBOARD HISTORY
========================================================= */

function renderHistoryDashboard() {

    const container =
        document.getElementById("dashboardHistory");

    const dates =
        Object.keys(stats.reviewHistory)
        .sort()
        .reverse()
        .slice(0,5);

    container.innerHTML = "";


    dates.forEach(date => {

        const div =
            document.createElement("div");

        div.className = "history-row";

        div.innerHTML = `

<span>${date}</span>

<strong>
${stats.reviewHistory[date]} reviews
</strong>

`;

        container.appendChild(div);

    });


    if (!dates.length) {

        container.innerHTML =
            "No reviews yet.";

    }

}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics() {

    document.getElementById("statReviews")
        .textContent = stats.totalReviews;

    document.getElementById("statLessons")
        .textContent = stats.totalLessons;

    document.getElementById("statFailures")
        .textContent = stats.totalFailures;

    document.getElementById("statLongTerm")
        .textContent =
        words.filter(isLongTerm).length;


    let accuracy = 0;

    if (stats.totalReviews > 0) {

        accuracy =
            Math.round(
                stats.successfulReviews /
                stats.totalReviews *
                100
            );

    }


    document.getElementById("statAccuracy")
        .textContent = accuracy + "%";


    renderFailureList("topFailures");

    renderLeeches();

    renderHistory();

}


/* =========================================================
   EXPORT
========================================================= */

function exportData() {

    synchroniseGardenState();

    const backupSettings = normaliseSettings(userSettings);

    const backup = {

        version: SRS.version,

        words,

        stats,

        settings: {
            ...backupSettings,
            leechLimit: LEECH_LIMIT
        },

        exportedAt:
            new Date().toISOString()

    };


    const blob =
        new Blob(
            [JSON.stringify(backup, null, 2)],
            {
                type:"application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "kanji-srs-backup-" +
        today() +
        ".json";

    a.click();

    URL.revokeObjectURL(url);

}


/* =========================================================
   IMPORT
========================================================= */

function importData(event) {

    const file =
        event.target.files[0];

    if (!file) return;


    const reader =
        new FileReader();


    reader.onload = function(e) {

        try {

            const backup =
                JSON.parse(e.target.result);


            if (!backup.words || !backup.stats) {

                alert(
                    "This does not look like a valid Kanji SRS backup."
                );

                return;

            }


            if (!confirm(
                "Import this backup? Your current data will be replaced."
            )) {

                return;

            }


            // Restore through the same migration path used for local/cloud data.
            words = normaliseWords(backup.words);
            stats = normaliseStats(backup.stats);

            if (backup.settings) {
                userSettings = normaliseSettings(backup.settings);
                localStorage.setItem("kanjiSRSSettings", JSON.stringify(userSettings));
            } else {
                userSettings = normaliseSettings(null);
                localStorage.removeItem("kanjiSRSSettings");
            }

            // The current quiz belongs to the old data.
            quizWords = [];
            quizOriginalCount = 0;
            quizRelearningIndexes = new Set();
            quizIndex = 0;
            quizMode = "reviews";
            lastQuizState = null;
            document.getElementById("quizArea").style.display = "none";
            document.getElementById("quizFinished").style.display = "none";
            document.getElementById("quizStart").style.display = "block";
            updateNextChunkButton(false);
            if (typeof resetAnswerReveal === "function") resetAnswerReveal();

            saveData();

            updateAll();

            alert("Backup imported successfully!");

        }

        catch(error) {

            alert(
                "Could not read this backup file."
            );

        }

    };


    reader.readAsText(file);

}


/* =========================================================
   RESET
========================================================= */

function resetAll() {

    if (!confirm(
        "WARNING: This will delete ALL vocabulary and progress. Continue?"
    )) {

        return;

    }


    localStorage.removeItem("kanjiWords");

    localStorage.removeItem("kanjiStats");
    localStorage.removeItem("kanjiSRSSettings");
    localStorage.removeItem("tobukaba.landscape.nightStudy");
    localStorage.removeItem("tobukaba.landscape.homeVisit");


    words =
        defaultWords.map(word => ({ ...word, ...newSrsFields() }));


    userSettings = normaliseSettings(null);

    stats = {

        totalReviews: 0,

        successfulReviews: 0,

        totalFailures: 0,

        totalLessons: 0,

        xp: 0,

        reviewHistory: {},

        lessonHistory: {},

        lastStudyDate: null,

        streak: 0

    };

    // Clear any active/finished quiz so reset really returns the app to a clean state.
    quizWords = [];
    quizOriginalCount = 0;
    quizRelearningIndexes = new Set();
    quizIndex = 0;
    quizMode = "reviews";
    lessonPhase = "practice";
    lessonCompletedThisSession = 0;
    lessonPracticeQueue = [];
    lessonRecallQueue = [];
    lessonRetryWord = null;
    lastQuizState = null;
    document.getElementById("quizArea").style.display = "none";
    document.getElementById("quizFinished").style.display = "none";
    document.getElementById("quizStart").style.display = "block";
    updateNextChunkButton(false);
    if (typeof resetAnswerReveal === "function") resetAnswerReveal();

    saveData();
    localStorage.setItem("kanjiSRSSettings", JSON.stringify(userSettings));
    updateAll();

    alert("Everything has been reset. Your default words are available as new lessons.");

}


/* =========================================================
   UPDATE EVERYTHING
========================================================= */

function updateAll() {

    updateDashboard();

    updateStatistics();

    updateCategoryFilter();

    renderVocabulary();

    renderTravelSystem();

    const collectionsPanel = document.getElementById("wordCollectionsPanel");
    if (collectionsPanel && !collectionsPanel.hidden) renderWordCollections();

}


/* =========================================================
   INITIALISE
========================================================= */

const STROKE_ORDER_LIBRARY_VERSION = "3.7.3";
const STROKE_ORDER_DATA_VERSION = "0.0.2";
const STROKE_ORDER_DATA_COMMIT = "efbea0cb93ba0301475ae92f9d3e512b9e4cd2ca";
const STROKE_ORDER_DATA_BASE = `https://cdn.jsdelivr.net/gh/chanind/hanzi-writer-data-jp@${STROKE_ORDER_DATA_COMMIT}/data`;
const STROKE_ANIMATION_SPEEDS = Object.freeze({
  relaxed: Object.freeze({ strokeAnimationSpeed: 0.55, delayBetweenStrokes: 420 }),
  standard: Object.freeze({ strokeAnimationSpeed: 1, delayBetweenStrokes: 180 }),
  quick: Object.freeze({ strokeAnimationSpeed: 1.65, delayBetweenStrokes: 80 })
});
const strokeOrderDataCache = new Map();
let strokeOrderRequestToken = 0;
let activeStrokeWriters = [];
let answerRevealedForCard = false;
let strokeOrderAllowedForCard = false;
let strokeOrderRenderedForCard = false;
let strokeSpeedPreviewToken = 0;
let strokeSpeedPreviewWriter = null;

function getStrokeAnimationTiming(speed = userSettings?.strokeSpeed) {
  return STROKE_ANIMATION_SPEEDS[speed] || STROKE_ANIMATION_SPEEDS.standard;
}

function extractKanjiCharacters(value) {
  return Array.from(String(value || "")).filter(character => /\p{Unified_Ideograph}/u.test(character));
}

function loadJapaneseStrokeData(character) {
  if (strokeOrderDataCache.has(character)) return strokeOrderDataCache.get(character);

  const request = fetch(`${STROKE_ORDER_DATA_BASE}/${encodeURIComponent(character)}.json`, {
    method: "GET",
    credentials: "omit",
    referrerPolicy: "no-referrer"
  }).then(response => {
    if (!response.ok) throw new Error(`Stroke data request failed with ${response.status}`);
    return response.json();
  }).then(data => {
    if (!data || !Array.isArray(data.strokes) || data.strokes.length === 0) {
      throw new Error("Stroke data is incomplete");
    }
    return data;
  }).catch(error => {
    // A temporary network failure should be retryable later in the session.
    strokeOrderDataCache.delete(character);
    throw error;
  });

  strokeOrderDataCache.set(character, request);
  return request;
}

function stopStrokeOrderAnimations() {
  activeStrokeWriters.forEach(writer => {
    try {
      if (typeof writer.pauseAnimation === "function") writer.pauseAnimation();
      if (typeof writer.cancelQuiz === "function") writer.cancelQuiz();
    } catch (_) { /* A discarded animation must never interrupt study. */ }
  });
  activeStrokeWriters = [];
}

function resetStrokeOrderGuidance() {
  strokeOrderRequestToken++;
  answerRevealedForCard = false;
  strokeOrderAllowedForCard = false;
  strokeOrderRenderedForCard = false;
  stopStrokeOrderAnimations();

  const button = document.getElementById("strokeOrderButton");
  const section = document.getElementById("strokeOrderSection");
  const container = document.getElementById("strokeOrderCharacters");
  const status = document.getElementById("strokeOrderStatus");

  if (button) {
    button.hidden = true;
    button.textContent = "View stroke order";
    button.setAttribute("aria-expanded", "false");
  }
  if (section) section.hidden = true;
  if (container) container.replaceChildren();
  if (status) status.textContent = "";
}

function unlockStrokeOrderGuidance() {
  answerRevealedForCard = true;
  allowStrokeOrderGuidance();
}

function allowStrokeOrderGuidance() {
  strokeOrderAllowedForCard = true;
  const button = document.getElementById("strokeOrderButton");
  if (button) button.hidden = false;
}

function closeStrokeOrderGuidance({ returnFocus = false } = {}) {
  const button = document.getElementById("strokeOrderButton");
  const section = document.getElementById("strokeOrderSection");
  const container = document.getElementById("strokeOrderCharacters");
  const status = document.getElementById("strokeOrderStatus");
  if (section) section.hidden = true;
  if (button) {
    button.textContent = "View stroke order";
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }
  stopStrokeOrderAnimations();
  strokeOrderRenderedForCard = false;
  if (container) container.replaceChildren();
  if (status) status.textContent = "";
}

async function renderStrokeOrderCharacter(character, index, requestToken, { guided = false } = {}) {
  const container = document.getElementById("strokeOrderCharacters");
  if (!container || requestToken !== strokeOrderRequestToken) return null;

  const card = document.createElement("article");
  card.className = "stroke-character-card";

  const label = document.createElement("div");
  label.className = "stroke-character-label";
  label.innerHTML = `<strong>${escapeHtml(character)}</strong><span>Character ${index + 1}</span>`;

  const target = document.createElement("div");
  target.className = "stroke-character-canvas";
  target.id = `stroke-character-${requestToken}-${index}`;
  target.setAttribute("aria-hidden", "true");

  const characterMessage = document.createElement("p");
  characterMessage.className = "stroke-character-message";
  characterMessage.textContent = "Loading…";

  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "stroke-replay";
  replay.textContent = "Replay";
  replay.setAttribute("aria-label", `Replay stroke order for ${character}, character ${index + 1}`);
  replay.disabled = true;

  card.append(label, target, characterMessage, replay);
  container.appendChild(card);

  try {
    const data = await loadJapaneseStrokeData(character);
    if (requestToken !== strokeOrderRequestToken || !target.isConnected) return null;
    if (typeof window.HanziWriter === "undefined") throw new Error("Hanzi Writer is unavailable");

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const renderedWidth = Math.round(target.getBoundingClientRect().width) || 134;
    const timing = getStrokeAnimationTiming();
    const writer = window.HanziWriter.create(target, character, {
      width: renderedWidth,
      height: renderedWidth,
      padding: 8,
      showOutline: true,
      showCharacter: reducedMotion,
      strokeColor: "#35523e",
      outlineColor: "#d8ddcf",
      strokeAnimationSpeed: timing.strokeAnimationSpeed,
      delayBetweenStrokes: timing.delayBetweenStrokes,
      charDataLoader: () => data
    });

    activeStrokeWriters.push(writer);
    characterMessage.textContent = reducedMotion
      ? "Complete character shown."
      : "Stroke order ready.";
    replay.disabled = false;
    replay.addEventListener("click", () => {
      if (requestToken !== strokeOrderRequestToken) return;
      try {
        characterMessage.textContent = "Playing…";
        writer.hideCharacter({ duration: 0, onComplete: () => writer.animateCharacter({
          onComplete: () => { characterMessage.textContent = "Ready to practise again."; }
        }) });
      } catch (_) {
        characterMessage.textContent = "Stroke order isn’t available right now.";
      }
    });

    return { writer, characterMessage, reducedMotion };
  } catch (_) {
    if (requestToken !== strokeOrderRequestToken || !target.isConnected) return null;
    characterMessage.textContent = "Stroke order isn’t available for this character yet.";
    replay.disabled = true;
    return { writer: null, characterMessage, reducedMotion: true };
  }
}

function animateStrokeOrderCharacter(result, requestToken) {
  if (!result?.writer || result.reducedMotion || requestToken !== strokeOrderRequestToken) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (result.characterMessage) result.characterMessage.textContent = "Now practise writing this character.";
      resolve();
    };
    try {
      result.characterMessage.textContent = "Watch the stroke order…";
      result.writer.animateCharacter({ onComplete: finish });
    } catch (_) {
      finish();
    }
  });
}

async function renderStrokeOrderGuidance({ guided = false } = {}) {
  const word = getCurrentQuizWord();
  const section = document.getElementById("strokeOrderSection");
  const container = document.getElementById("strokeOrderCharacters");
  const status = document.getElementById("strokeOrderStatus");
  if (!strokeOrderAllowedForCard || !word || !section || !container || !status) return;

  const requestToken = strokeOrderRequestToken;
  const characters = extractKanjiCharacters(word.kanji);
  container.replaceChildren();
  strokeOrderRenderedForCard = true;

  if (characters.length === 0) {
    status.textContent = "Stroke order isn’t available for this word yet.";
    return [];
  }

  if (typeof window.HanziWriter === "undefined") {
    status.textContent = "Stroke order isn’t available right now. You can continue studying normally.";
    return [];
  }

  status.textContent = `Loading stroke order for ${characters.length} ${characters.length === 1 ? "character" : "characters"}…`;
  const results = await Promise.all(characters.map((character, index) =>
    renderStrokeOrderCharacter(character, index, requestToken, { guided })
  ));

  if (requestToken !== strokeOrderRequestToken) return [];
  const available = results.filter(result => result?.writer).length;
  for (const result of results) {
    if (requestToken !== strokeOrderRequestToken) return [];
    await animateStrokeOrderCharacter(result, requestToken);
  }
  if (requestToken !== strokeOrderRequestToken) return [];
  if (available === characters.length) {
    status.textContent = guided
      ? "Guided practice complete. Replay a character or continue to the recall check."
      : "Stroke order complete. Replay any character when you need it.";
  } else if (available > 0) {
    status.textContent = `${available} of ${characters.length} characters are available. You can continue studying normally.`;
  } else {
    status.textContent = "Stroke order isn’t available for this word yet. You can continue studying normally.";
  }
  return results;
}

async function beginLessonPractice() {
  if (quizMode !== "lessons" || !["practice", "retry-practice"].includes(lessonPhase) || !getCurrentQuizWord()) return;
  const section = document.getElementById("strokeOrderSection");
  const button = document.getElementById("strokeOrderButton");
  const continueButton = document.getElementById("lessonPracticeContinue");
  strokeOrderAllowedForCard = true;
  if (section) section.hidden = false;
  if (button) button.hidden = true;
  if (continueButton) continueButton.disabled = false;
  return renderStrokeOrderGuidance({ guided: true });
}

async function previewStrokeSpeedSetting() {
  const target = document.getElementById("strokeSpeedPreviewCanvas");
  const status = document.getElementById("strokeSpeedPreviewStatus");
  const selected = document.getElementById("strokeSpeedInput")?.value;
  if (!target || !status) return;

  const token = ++strokeSpeedPreviewToken;
  try {
    if (strokeSpeedPreviewWriter?.pauseAnimation) strokeSpeedPreviewWriter.pauseAnimation();
  } catch (_) { /* The old preview can be discarded safely. */ }
  strokeSpeedPreviewWriter = null;
  target.replaceChildren();
  status.textContent = "Loading preview…";

  try {
    const data = await loadJapaneseStrokeData("日");
    if (token !== strokeSpeedPreviewToken) return;
    if (typeof window.HanziWriter === "undefined") throw new Error("Hanzi Writer is unavailable");
    const timing = getStrokeAnimationTiming(selected);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    strokeSpeedPreviewWriter = window.HanziWriter.create(target, "日", {
      width: 80,
      height: 80,
      padding: 7,
      showOutline: true,
      showCharacter: reducedMotion,
      strokeColor: "#35523e",
      outlineColor: "#d8ddcf",
      strokeAnimationSpeed: timing.strokeAnimationSpeed,
      delayBetweenStrokes: timing.delayBetweenStrokes,
      charDataLoader: () => data
    });
    if (reducedMotion) {
      status.textContent = "Complete character shown because reduced motion is enabled.";
    } else {
      status.textContent = "Playing preview…";
      strokeSpeedPreviewWriter.animateCharacter({
        onComplete: () => {
          if (token === strokeSpeedPreviewToken) status.textContent = "Change the speed to replay the example.";
        }
      });
    }
  } catch (_) {
    if (token === strokeSpeedPreviewToken) status.textContent = "Preview unavailable. You can still save this speed.";
  }
}

function toggleStrokeOrderGuidance() {
  if (!strokeOrderAllowedForCard) return;
  const button = document.getElementById("strokeOrderButton");
  const section = document.getElementById("strokeOrderSection");
  if (!button || !section) return;

  if (!section.hidden) {
    closeStrokeOrderGuidance();
    return;
  }

  section.hidden = false;
  button.textContent = "Hide stroke order";
  button.setAttribute("aria-expanded", "true");
  if (!strokeOrderRenderedForCard) renderStrokeOrderGuidance({ guided: false });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character]);
}


(function(){
  const btn=()=>document.getElementById("showAnswerBtn"), target=()=>document.getElementById("kanjiAnswer"), undo=()=>document.getElementById("undoButton");
  function render(){const b=btn(),t=target();if(!b||!t)return;const w=typeof getCurrentQuizWord==="function"?getCurrentQuizWord():null;t.innerHTML='<span class="answer-kanji">'+escapeHtml(w&&w.kanji?w.kanji:"—")+'</span>';}
  window.resetAnswerReveal=function(){const b=btn();if(b){b.classList.remove("peek-active","keyboard-peek");b.setAttribute("aria-pressed","false");}resetStrokeOrderGuidance();render();if(undo())undo().disabled=!lastQuizState;};
  window.showKanjiAnswer=function(){const b=btn();if(b){b.classList.add("keyboard-peek");b.setAttribute("aria-pressed","true");unlockStrokeOrderGuidance();}};

  btn()?.addEventListener("pointerenter",unlockStrokeOrderGuidance);
  btn()?.addEventListener("focus",unlockStrokeOrderGuidance);
  document.addEventListener("pointerdown",e=>{const b=btn();if(b&&e.target.closest("#showAnswerBtn")===b&&(e.pointerType==="touch"||e.pointerType==="pen")){b.classList.add("peek-active");unlockStrokeOrderGuidance();}});
  document.addEventListener("pointerup",e=>{const b=btn();if(b&&(e.pointerType==="touch"||e.pointerType==="pen"))b.classList.remove("peek-active");});
  document.addEventListener("pointercancel",()=>{const b=btn();if(b)b.classList.remove("peek-active");});

  btn()?.addEventListener("click",()=>{const b=btn();if(!b)return;const reveal=!b.classList.contains("keyboard-peek");b.classList.toggle("keyboard-peek",reveal);b.setAttribute("aria-pressed",String(reveal));if(reveal)unlockStrokeOrderGuidance();});
  document.getElementById("strokeOrderButton")?.addEventListener("click",toggleStrokeOrderGuidance);
  document.getElementById("strokeOrderClose")?.addEventListener("click",()=>closeStrokeOrderGuidance({returnFocus:true}));
  document.addEventListener("keydown",e=>{const q=document.getElementById("quizArea");if(!q||q.style.display==="none"||e.target.matches("input,textarea,select"))return;if(e.key===" "&&!e.target.matches("button")){e.preventDefault();const b=btn();if(b){const reveal=!b.classList.contains("keyboard-peek");b.classList.toggle("keyboard-peek",reveal);b.setAttribute("aria-pressed",String(reveal));if(reveal)unlockStrokeOrderGuidance();}}else if(e.key==="Escape"){const b=btn();if(b){b.classList.remove("keyboard-peek","peek-active");b.setAttribute("aria-pressed","false");}closeStrokeOrderGuidance();}});
  document.addEventListener("keydown",e=>{const q=document.getElementById("quizArea");if(!q||q.style.display==="none"||e.target.matches("input,textarea,select,button")||quizMode!=="reviews")return;if(e.key==="1")rateWord("again");else if(e.key==="2")rateWord("hard");else if(e.key==="3")rateWord("good");else if(e.key==="4")rateWord("easy");else if(e.key==="ArrowLeft")undoLastRating();});

  const originalRateWord=window.rateWord;
  if(typeof originalRateWord==="function")window.rateWord=function(rating){
    if(typeof quizWords==="undefined"||!quizWords[quizIndex])return;

    const currentWord=quizWords[quizIndex];
    const wordKey={kanji:currentWord.kanji,hiragana:currentWord.hiragana};
    const persistentWord=words.find(w=>w.kanji===wordKey.kanji&&w.hiragana===wordKey.hiragana);
    const previousPersistentWord=persistentWord?JSON.parse(JSON.stringify(persistentWord)):null;
    const previousQuizWord=JSON.parse(JSON.stringify(currentWord));
    const previousStats=JSON.parse(JSON.stringify(stats));
    const previousGardenState=JSON.parse(JSON.stringify(normaliseGardenState(userSettings.gardenState)));
    const previousIndex=quizIndex;
    const previousTotalReviews=stats.totalReviews;
    const previousTotalLessons=stats.totalLessons;
    const previousQueue=quizWords.map(w=>JSON.parse(JSON.stringify(w)));
    const previousRelearningIndexes=Array.from(quizRelearningIndexes);
    const previousMode=quizMode;

    originalRateWord(rating);

    // Only enable Undo when a review was actually recorded.
    if(stats.totalReviews>previousTotalReviews){
      lastQuizState={index:previousIndex,wordKey,wordSnapshot:previousQuizWord,persistentWordSnapshot:previousPersistentWord,statsSnapshot:previousStats,gardenSnapshot:previousGardenState,queueSnapshot:previousQueue,relearningSnapshot:previousRelearningIndexes,mode:previousMode};
      if(undo())undo().disabled=false;
    }else{
      lastQuizState=null;
      if(undo())undo().disabled=true;
    }
  };

  window.undoLastRating=function(){
    if(!lastQuizState)return;
    const st=lastQuizState;

    // Restore the actual saved word as well as the temporary quiz copy.
    if(st.persistentWordSnapshot){
      const i=words.findIndex(w=>w.kanji===st.wordKey.kanji&&w.hiragana===st.wordKey.hiragana);
      if(i!==-1)words[i]=JSON.parse(JSON.stringify(st.persistentWordSnapshot));
    }
    if(quizWords[st.index])Object.assign(quizWords[st.index],st.wordSnapshot);
    stats=JSON.parse(JSON.stringify(st.statsSnapshot));
    if(st.gardenSnapshot)userSettings.gardenState=normaliseGardenState(st.gardenSnapshot);
    quizMode=st.mode;
    if(st.queueSnapshot){
      quizWords=st.queueSnapshot.map(snapshot=>{
        const saved=words.find(w=>w.kanji===snapshot.kanji&&w.hiragana===snapshot.hiragana);
        return saved||JSON.parse(JSON.stringify(snapshot));
      });
      quizRelearningIndexes=new Set(st.relearningSnapshot||[]);
    }
    quizIndex=st.index;
    saveData();
    updateAll();
    document.getElementById("quizFinished").style.display="none";
    document.getElementById("quizArea").style.display="block";
    lastQuizState=null;
    showQuizWord();
    resetAnswerReveal();
  };
  window.restartQuiz=function(){startQuiz();};

  document.addEventListener("DOMContentLoaded",()=>{render();resetAnswerReveal();});
})();

/* =========================================================
   LIVING COUNTRYSIDE
   Season, local time, and learning state stay independent.
========================================================= */

const countrysideSeasons = [
  { key: "spring", name: "Spring" },
  { key: "summer", name: "Summer" },
  { key: "autumn", name: "Autumn" },
  { key: "winter", name: "Winter" }
];
const countrysideSeasonStorageKey = "tobukaba.landscape.season";
const nightStudyStorageKey = "tobukaba.landscape.nightStudy";
const homeVisitStorageKey = "tobukaba.landscape.homeVisit";
let landscapePreviewMinutes = null;
let selectedCountrysideSeason = Math.floor(((new Date().getMonth() + 10) % 12) / 3);
let homeVisitRecordedThisLoad = false;
let calmHomeForThisLoad = false;

try {
  const savedSeason = localStorage.getItem(countrysideSeasonStorageKey);
  const savedIndex = countrysideSeasons.findIndex(season => season.key === savedSeason);
  if (savedIndex !== -1) selectedCountrysideSeason = savedIndex;
} catch (_) { /* The scene remains usable when storage is unavailable. */ }

function getLandscapeMinutes(date = new Date()) {
  return landscapePreviewMinutes ?? (date.getHours() * 60 + date.getMinutes());
}

function getLandscapeTimeState(date = new Date()) {
  const minutes = getLandscapeMinutes(date);
  if (minutes >= 300 && minutes < 420) return "dawn";       // 05:00–06:59
  if (minutes >= 420 && minutes < 630) return "morning";    // 07:00–10:29
  if (minutes >= 630 && minutes < 930) return "day";        // 10:30–15:29
  if (minutes >= 930 && minutes < 1050) return "golden";    // 15:30–17:29
  if (minutes >= 1050 && minutes < 1140) return "sunset";   // 17:30–18:59
  if (minutes >= 1140 && minutes < 1290) return "evening";  // 19:00–21:29
  return "night";
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nightSessionDate(date = new Date()) {
  const sessionDate = new Date(date);
  if (date.getHours() < 5) sessionDate.setDate(sessionDate.getDate() - 1);
  return localDateKey(sessionDate);
}

function readNightStudyState() {
  try {
    const saved = JSON.parse(localStorage.getItem(nightStudyStorageKey) || "null");
    if (!saved || typeof saved.date !== "string") return null;
    return {
      date: saved.date,
      count: Math.max(0, Number(saved.count) || 0),
      acknowledged: Boolean(saved.acknowledged)
    };
  } catch (_) {
    return null;
  }
}

function writeNightStudyState(state) {
  try {
    localStorage.setItem(nightStudyStorageKey, JSON.stringify(state));
  } catch (_) { /* Presentation state must never interrupt a review. */ }
}

function recordNightStudyReview(date = new Date()) {
  // Preview mode is visual-only and must never create learning history.
  if (landscapePreviewMinutes !== null || getLandscapeTimeState(date) !== "night") return;

  const dateKey = nightSessionDate(date);
  const current = readNightStudyState();
  const next = current && current.date === dateKey
    ? { ...current, count: current.count + 1, acknowledged: false }
    : { date: dateKey, count: 1, acknowledged: false };
  writeNightStudyState(next);
}

function maybeShowMorningAcknowledgement(date = new Date()) {
  const message = document.getElementById("morningAcknowledgement");
  const text = document.getElementById("morningAcknowledgementText");
  if (!message || !text || landscapePreviewMinutes !== null) return;

  const stateName = getLandscapeTimeState(date);
  if (stateName !== "dawn" && stateName !== "morning") return;

  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const saved = readNightStudyState();
  if (!saved || saved.acknowledged || saved.count < 1 || saved.date !== localDateKey(previousDate)) return;

  text.textContent = saved.count === 1
    ? "One word moved forward while I slept."
    : `${saved.count} words moved forward while I slept.`;
  message.hidden = false;
  writeNightStudyState({ ...saved, acknowledged: true });
}

function updateCountrysideScene() {
  const hero = document.querySelector(".site-hero");
  if (!hero) return;

  const season = countrysideSeasons[selectedCountrysideSeason];
  const now = new Date();
  const timeState = getLandscapeTimeState(now);
  hero.dataset.season = season.key;
  hero.dataset.time = timeState;

  const seasonName = hero.querySelector(".season-name");
  if (seasonName) seasonName.textContent = season.name;

  const toggle = document.getElementById("seasonToggle");
  const nextSeason = countrysideSeasons[(selectedCountrysideSeason + 1) % countrysideSeasons.length];
  if (toggle) toggle.setAttribute("aria-label", `${season.name}. Change to ${nextSeason.name}`);

  prepareHeroMascotSwap();
  maybeShowMorningAcknowledgement(now);
  updateLearningGardenAtmosphere();
}

function prepareHeroMascotSwap() {
  const hero = document.querySelector(".site-hero");
  const sleeping = document.getElementById("heroSleepingTobuKaba");
  if (!hero || !sleeping) return;

  const showSleepingPose = () => hero.classList.add("hero-sleeping-mascot-ready");
  const keepAwakeFallback = () => hero.classList.remove("hero-sleeping-mascot-ready");
  if (sleeping.complete) {
    if (Number(sleeping.naturalWidth) > 0) showSleepingPose();
    else keepAwakeFallback();
    return;
  }
  if (sleeping.dataset.loadFallbackBound === "true") return;
  sleeping.dataset.loadFallbackBound = "true";
  sleeping.addEventListener("load", showSleepingPose, { once: true });
  sleeping.addEventListener("error", keepAwakeFallback, { once: true });
}

function updateHeaderMode(page) {
  const hero = document.querySelector(".site-hero");
  if (!hero) return;

  const isHome = page === "dashboard";
  hero.classList.toggle("is-compact", !isHome);

  if (!isHome) return;

  const todayKey = localDateKey(new Date());
  if (!homeVisitRecordedThisLoad) {
    try {
      calmHomeForThisLoad = localStorage.getItem(homeVisitStorageKey) === todayKey;
      localStorage.setItem(homeVisitStorageKey, todayKey);
    } catch (_) { /* Visit calmness is optional presentation state. */ }
    homeVisitRecordedThisLoad = true;
  }
  hero.classList.toggle("is-returning", calmHomeForThisLoad);
}

// Development helper: previewLocalTime(18, 30), then resetLocalTimePreview().
// It changes presentation only, never review or persistence timestamps.
window.previewLocalTime = function(hour, minute = 0) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  const safeMinute = Math.max(0, Math.min(59, Number(minute) || 0));
  landscapePreviewMinutes = safeHour * 60 + safeMinute;
  updateCountrysideScene();
  return `Previewing ${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")} (${getLandscapeTimeState()})`;
};

window.resetLocalTimePreview = function() {
  landscapePreviewMinutes = null;
  updateCountrysideScene();
  return "Local-time preview cleared.";
};

window.addEventListener("resize", updateCountrysideScene);
document.addEventListener("visibilitychange", () => {
  syncHomePondMotionState();
  if (!document.hidden) updateCountrysideScene();
});
document.addEventListener("DOMContentLoaded", () => {
  updateCountrysideScene();
  updateHeaderMode("dashboard");
});
setInterval(updateCountrysideScene, 60000);

document.getElementById("seasonToggle")?.addEventListener("click", () => {
  selectedCountrysideSeason = (selectedCountrysideSeason + 1) % countrysideSeasons.length;
  try {
    localStorage.setItem(countrysideSeasonStorageKey, countrysideSeasons[selectedCountrysideSeason].key);
  } catch (_) { /* Keep the in-memory selection when storage is unavailable. */ }
  updateCountrysideScene();
});

document.getElementById("dismissMorningAcknowledgement")?.addEventListener("click", () => {
  const message = document.getElementById("morningAcknowledgement");
  if (message) message.hidden = true;
});
