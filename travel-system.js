(function (root) {
    "use strict";

    const TRAVEL_STATE_VERSION = 3;

    function uniqueStrings(value) {
        return [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))];
    }

    function validIso(value, fallback = null) {
        const time = new Date(value || "").getTime();
        return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
    }

    function normaliseTravelContent(rawContent) {
        const source = rawContent && typeof rawContent === "object" ? rawContent : {};
        const errors = [];
        const seen = new Set();
        const companions = (Array.isArray(source.companions) ? source.companions : []).filter(companion => {
            if (!companion?.id || seen.has(companion.id)) {
                errors.push(`companions: missing or duplicate id ${companion?.id || "(blank)"}`);
                return false;
            }
            seen.add(companion.id);
            return true;
        }).map(companion => ({
            ...companion,
            milestoneUnits: Math.max(0, Number(companion.milestoneUnits) || 0)
        })).sort((a, b) => a.milestoneUnits - b.milestoneUnits);
        const progression = {
            requiredUnits: Math.max(1, Number(source.progression?.requiredUnits) || 30),
            lessonUnits: Math.max(0, Number(source.progression?.lessonUnits) || 1),
            firstSuccessfulReviewUnits: Math.max(0, Number(source.progression?.firstSuccessfulReviewUnits) || 1),
            intervalMilestones: Array.isArray(source.progression?.intervalMilestones)
                ? source.progression.intervalMilestones.map(item => ({ ...item }))
                : []
        };
        companions.forEach(companion => {
            if (!companion.image) errors.push(`companion ${companion.id}: missing pond image`);
            if (companion.milestoneUnits > progression.requiredUnits) errors.push(`companion ${companion.id}: milestone exceeds journey length`);
        });
        return {
            ...source,
            companions,
            progression,
            validationErrors: errors,
            // Compatibility aliases allow older saved data to migrate without
            // retaining the old destination, item, or animated-scene catalogues.
            characters: [{ id: "tobukaba", name: "TobuKaba" }, ...companions.map(companion => ({
                ...companion,
                pondAsset: companion.image,
                availableAsCompanion: true,
                pondVisitPositions: [companion.pondPosition]
            }))],
            destinations: [], routes: [], items: [], outfitSlots: [], pondSlots: []
        };
    }

    function createDefaultTravelState(now = new Date().toISOString()) {
        return {
            version: TRAVEL_STATE_VERSION,
            journeyStartedAt: validIso(now, new Date().toISOString()),
            highestJourneyUnits: 0,
            unlockedCompanionIds: [],
            visibleCompanionIds: [],
            pendingCompanionIds: [],
            notifiedCompanionIds: [],
            legacyGardenState: null,
            legacyMigrationCompletedAt: null,
            preferencesUpdatedAt: validIso(now, new Date().toISOString()),
            updatedAt: validIso(now, new Date().toISOString())
        };
    }

    function normaliseTravelState(savedState, rawContent, now = new Date().toISOString()) {
        const content = normaliseTravelContent(rawContent);
        const source = savedState && typeof savedState === "object" ? savedState : {};
        const defaults = createDefaultTravelState(now);
        const companionIds = new Set(content.companions.map(companion => companion.id));
        const legacyUnlocked = uniqueStrings([
            ...(source.befriendedCharacterIds || []),
            ...(source.unlockedCharacterIds || []),
            ...(source.completedDestinationIds || []).includes("cedar-shrine") ? ["map-tanuki"] : []
        ]).filter(id => id !== "tobukaba" && companionIds.has(id));
        const unlockedCompanionIds = uniqueStrings([
            ...(source.unlockedCompanionIds || []),
            ...legacyUnlocked
        ]).filter(id => companionIds.has(id));
        const hasNewVisibilityState = Array.isArray(source.visibleCompanionIds);
        const visibleCompanionIds = uniqueStrings(hasNewVisibilityState
            ? source.visibleCompanionIds
            : [source.selectedCompanionId, ...legacyUnlocked]
        ).filter(id => unlockedCompanionIds.includes(id));
        const notifiedCompanionIds = uniqueStrings(source.notifiedCompanionIds || legacyUnlocked)
            .filter(id => unlockedCompanionIds.includes(id));
        const pendingCompanionIds = uniqueStrings(source.pendingCompanionIds)
            .filter(id => unlockedCompanionIds.includes(id) && !notifiedCompanionIds.includes(id));
        const legacyStart = source.activeJourney?.startedAt || source.journalEntries?.[0]?.completedAt;
        const highestJourneyUnits = Math.max(0, Math.min(
            content.progression.requiredUnits,
            Number(source.highestJourneyUnits) || (source.completedDestinationIds?.length ? content.progression.requiredUnits : 0)
        ));

        return {
            ...defaults,
            version: TRAVEL_STATE_VERSION,
            journeyStartedAt: validIso(source.journeyStartedAt || legacyStart, now),
            highestJourneyUnits,
            unlockedCompanionIds,
            visibleCompanionIds,
            pendingCompanionIds,
            notifiedCompanionIds,
            legacyGardenState: source.legacyGardenState && typeof source.legacyGardenState === "object" ? source.legacyGardenState : null,
            legacyMigrationCompletedAt: validIso(source.legacyMigrationCompletedAt),
            preferencesUpdatedAt: validIso(source.preferencesUpdatedAt, now),
            updatedAt: validIso(source.updatedAt, now)
        };
    }

    function migrateGardenStateToTravelState(gardenState, travelState, rawContent, now = new Date().toISOString()) {
        const existing = normaliseTravelState(travelState, rawContent, now);
        if (existing.legacyMigrationCompletedAt || !gardenState || typeof gardenState !== "object") return existing;
        return normaliseTravelState({
            ...existing,
            legacyGardenState: JSON.parse(JSON.stringify(gardenState)),
            legacyMigrationCompletedAt: now,
            updatedAt: now
        }, rawContent, now);
    }

    function wordIdentity(word) {
        return String(word?.id || `${word?.kanji || ""}\u241f${word?.hiragana || ""}`);
    }

    function calculateStudyUnits(state, words, content) {
        const startTime = new Date(state.journeyStartedAt).getTime();
        const events = new Map();
        let newWordsLearned = 0;
        let scheduledReviewsCompleted = 0;
        (Array.isArray(words) ? words : []).forEach(word => {
            const identity = wordIdentity(word);
            const logs = (Array.isArray(word.reviewLog) ? word.reviewLog : [])
                .filter(log => new Date(log?.reviewedAt || "").getTime() >= startTime)
                .sort((a, b) => new Date(a.reviewedAt) - new Date(b.reviewedAt));
            const lesson = logs.find(log => log.activity === "lesson" &&
                (log.confirmed === true || log.result === "ok" || log.rating === "good" || log.rating === "easy"));
            if (lesson) {
                events.set(`${identity}:lesson`, content.progression.lessonUnits);
                newWordsLearned += 1;
            }
            const reviews = logs.filter(log => log.activity === "review");
            if (reviews.some(log => log.rating !== "again")) {
                events.set(`${identity}:first-successful-review`, content.progression.firstSuccessfulReviewUnits);
            }
            scheduledReviewsCompleted += reviews.length;
            content.progression.intervalMilestones.forEach(milestone => {
                if (reviews.some(log => log.rating !== "again" && Number(log.nextInterval) >= Number(milestone.days))) {
                    events.set(`${identity}:${milestone.id || `interval-${milestone.days}`}`, Number(milestone.units) || 0);
                }
            });
        });
        return { eventIds: [...events.keys()], units: [...events.values()].reduce((sum, value) => sum + value, 0), newWordsLearned, scheduledReviewsCompleted };
    }

    function calculateJourneyProgress(rawState, words, rawContent) {
        const content = normaliseTravelContent(rawContent);
        const state = normaliseTravelState(rawState, content);
        const study = calculateStudyUnits(state, words, content);
        const requiredUnits = content.progression.requiredUnits;
        const units = Math.min(requiredUnits, Math.max(state.highestJourneyUnits, study.units));
        return { ...study, units, requiredUnits, ratio: Math.min(1, units / requiredUnits) };
    }

    function synchroniseProgress(rawState, words, rawContent, now = new Date().toISOString(), progressOverrideUnits = null) {
        const content = normaliseTravelContent(rawContent);
        const state = normaliseTravelState(rawState, content, now);
        const calculated = calculateJourneyProgress(state, words, content);
        const units = Number.isFinite(Number(progressOverrideUnits))
            ? Math.max(calculated.units, Math.min(calculated.requiredUnits, Number(progressOverrideUnits)))
            : calculated.units;
        const newlyUnlocked = content.companions
            .filter(companion => companion.milestoneUnits <= units && !state.unlockedCompanionIds.includes(companion.id))
            .map(companion => companion.id);
        const changed = units !== state.highestJourneyUnits || newlyUnlocked.length > 0;
        if (!changed) return state;
        return normaliseTravelState({
            ...state,
            highestJourneyUnits: units,
            unlockedCompanionIds: uniqueStrings([...state.unlockedCompanionIds, ...newlyUnlocked]),
            pendingCompanionIds: uniqueStrings([...state.pendingCompanionIds, ...newlyUnlocked]),
            updatedAt: now
        }, content, now);
    }

    function setCompanionVisible(rawState, companionId, visible, rawContent, now = new Date().toISOString()) {
        const state = normaliseTravelState(rawState, rawContent, now);
        if (!state.unlockedCompanionIds.includes(companionId)) return state;
        const visibleCompanionIds = visible
            ? uniqueStrings([...state.visibleCompanionIds, companionId])
            : state.visibleCompanionIds.filter(id => id !== companionId);
        return normaliseTravelState({ ...state, visibleCompanionIds, preferencesUpdatedAt: now, updatedAt: now }, rawContent, now);
    }

    function dismissCompanionNotification(rawState, companionId, rawContent, now = new Date().toISOString()) {
        const state = normaliseTravelState(rawState, rawContent, now);
        return normaliseTravelState({
            ...state,
            pendingCompanionIds: state.pendingCompanionIds.filter(id => id !== companionId),
            notifiedCompanionIds: uniqueStrings([...state.notifiedCompanionIds, companionId]),
            updatedAt: now
        }, rawContent, now);
    }

    function mergeTravelStates(localState, remoteState, rawContent, now = new Date().toISOString()) {
        const local = normaliseTravelState(localState, rawContent, now);
        const remote = normaliseTravelState(remoteState, rawContent, now);
        const preferences = new Date(local.preferencesUpdatedAt) >= new Date(remote.preferencesUpdatedAt) ? local : remote;
        const starts = [local.journeyStartedAt, remote.journeyStartedAt].filter(Boolean).sort();
        return normaliseTravelState({
            ...preferences,
            journeyStartedAt: starts[0] || now,
            highestJourneyUnits: Math.max(local.highestJourneyUnits, remote.highestJourneyUnits),
            unlockedCompanionIds: uniqueStrings([...local.unlockedCompanionIds, ...remote.unlockedCompanionIds]),
            pendingCompanionIds: uniqueStrings([...local.pendingCompanionIds, ...remote.pendingCompanionIds]),
            notifiedCompanionIds: uniqueStrings([...local.notifiedCompanionIds, ...remote.notifiedCompanionIds]),
            legacyGardenState: local.legacyGardenState || remote.legacyGardenState,
            legacyMigrationCompletedAt: local.legacyMigrationCompletedAt || remote.legacyMigrationCompletedAt,
            updatedAt: now
        }, rawContent, now);
    }

    const api = {
        TRAVEL_STATE_VERSION,
        normaliseTravelContent,
        createDefaultTravelState,
        normaliseTravelState,
        migrateGardenStateToTravelState,
        calculateJourneyProgress,
        synchroniseProgress,
        setCompanionVisible,
        dismissCompanionNotification,
        mergeTravelStates,
        wordIdentity,
        // Compatibility shims for clients saved during the retired travel build.
        applyJourneyEncounters: synchroniseProgress,
        completeJourney: state => state
    };

    root.TobuKabaTravel = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
