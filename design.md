# TobuKaba — Design System & Philosophy

> **Make the impossible feel achievable.**  
> One review at a time. One word at a time.  
> **Even a hippo can fly.**

This document is the design source of truth for TobuKaba, a kanji-writing spaced-repetition system (SRS). It defines the product's identity, intended experience, environmental system, mascot, and UI principles. Read it before making visual or interaction changes. New patterns must fit these principles; if a conflict is necessary, document the reason.

## 1. Product identity

TobuKaba helps learners steadily build Japanese vocabulary and kanji knowledge through consistent, writing-led review. It is a purpose-built Japanese-learning world—not a generic flashcard app, productivity dashboard, textbook, SaaS product, or Anki clone.

The application and its flying-hippo mascot are named **TobuKaba**. Always use the exact capitalization “TobuKaba.” Never shorten the mascot’s name to “Tobuka” or introduce another variation in interface copy, accessibility text, documentation, or new identifiers.

Its essential loop is:

**See → Recall → Write → Check → Rate → Continue**

The learner concentrates on the next review. The SRS handles scheduling and progression quietly in the background. Design should support effective recall, writing, clarity, confidence, consistency, and believable long-term progress rather than maximize cards completed.

## 2. Philosophy and emotional experience

Japanese can look impossibly large: thousands of kanji, vocabulary, grammar, and years of work. TobuKaba must not ask learners to confront that whole mountain. It makes the next action manageable: show up, recall, write, check, honestly rate, continue.

The intended journey is:

- Before studying: “This looks impossible.”
- During studying: “Okay. One word at a time.”
- After a difficult review: “That one was tough, but I'll get it next time.”
- After a successful session: “I actually did it.”
- After months of practice: “Wait… I'm actually learning Japanese.”

Encourage persistence without becoming loud, childish, or relentlessly motivational. The product proves progress through use; it does not continually announce that the learner is amazing.

## 3. Visual identity

TobuKaba combines a warm Japanese-countryside atmosphere with clean, modern interface design, a playful but restrained personality, a distinctive flying hippo, and a strong emphasis on kanji and handwriting. It should feel **warm, calm, playful, polished, and slightly whimsical**—game-like, but not childish; Japanese in atmosphere, but never a collection of clichés; modern, but not generic SaaS.

Use rounded, friendly components; generous whitespace; strong hierarchy; restrained decoration; subtle environmental detail; and coherent styling. Do not make every screen a grid of cards. A container is useful only when it clarifies grouping or focus.

## 4. Colour, type, and layout

### Colour

The palette is warm, natural, welcoming, readable, and cohesive with the countryside world. It should provide consistent roles for primary and secondary actions, accents, backgrounds, surfaces, primary and secondary text, borders, success, warning, error, and seasonal environmental variation. Do not add colours merely to make a screen more exciting.

Seasonal colours are variations of one TobuKaba identity, never four unrelated themes. Exact tokens may evolve when they preserve the established moss, rice-paper, earth, sky, and natural-light character and meet accessibility requirements.

### Typography

Type is friendly, modern, highly legible, and suitable for English and Japanese over long daily sessions. Japanese glyphs—especially review kanji—must be exceptionally clear. Establish a stable hierarchy for page titles, headings, vocabulary, kanji, readings, definitions, support text, controls, and statistics. Avoid decorative type that harms reading; selected fonts must reliably support Japanese.

### Spacing and hierarchy

The interface should feel spacious, purposeful, and aligned. Use a consistent spacing rhythm, padding, radii, control sizes, content widths, and grouping. Do not fill empty space for its own sake. The primary task owns the strongest hierarchy; on Study, that is the review and writing task, while supporting information recedes.

## 5. Components and navigation

Buttons, cards, navigation, progress indicators, review controls, vocabulary cards, writing areas, dialogs, notifications, empty states, success states, statistics, mascot art, and environmental elements are one system. Equivalent components must share typography, spacing, radius, borders or shadows, hover, focus, active, disabled, and transition behavior. Do not introduce a second visual language for an existing component type without a clear product reason.

Navigation is simple and predictable. A learner should always know where they are, where to study, what is due, where vocabulary lives, where progress is shown, and where data is managed. Study/Review is the primary destination. Navigation supports learning; it must not compete with it.

## 6. Review and SRS experience

Lessons and Reviews are separate activities. Lessons contain only untouched vocabulary and count toward a configurable daily new-word goal. Reviews contain only learned words whose scheduled time has arrived and are never limited by an arbitrary daily goal: every word currently due from the SRS remains available. Completing a lesson moves the word into the adaptive SRS, while difficulty on first exposure is never treated as a mature-word lapse or problem-word failure.

The review screen is TobuKaba's highest visual priority. It must immediately communicate what is being reviewed, what to recall, what to write, how to reveal/check, how to rate, and what follows. The writing area is the central object. Reviews are focused, fast, satisfying, uncluttered, responsive, and predictable.

Favor active recall over passive recognition. Avoid popups, decorative animation, surplus statistics, or secondary information during review. The user should never need to fight the interface to finish a card.

TobuKaba is review-first: it supports remembering, not merely exposing learners to more content. Encourage recall before reveal, physically writing kanji, honest ratings, attention to difficult words, regular return, and trust in the scheduling system. The algorithm remains mostly invisible.

Clearly distinguish:

- **Reviews completed** from **retry attempts**
- **Words due now** from **new words**
- **Total vocabulary** from **long-term progress**

A retry is not another completed review. If five unique words are reviewed and some are retried, the completed-review count remains five. UI work must never alter this behavior or SRS scheduling. The daily goal describes new Lessons only; it must never hide, cap, or disable reviews that are due.

Scheduling adapts per word using its current interval, ease, successful reviews, and lapses. **Again** shortens the interval without erasing all prior learning; **Hard** is a successful but effortful recall; **Good** is normal successful recall; and **Easy** is immediate, confident recall. Same-session retries confirm recall but do not create a second SRS update or review-history entry. Words become **Long-term** at an interval of 60 days or more, continue returning for review, and are never permanently retired. The maximum interval is 365 days.

## 7. Vocabulary, progress, and feedback

Vocabulary views clearly explain four states: **New** (never studied), **Due Now** (scheduled now), **Learning** (in progress), and **Long-term** (established through successful review). Learners must be able to distinguish what they can study now from everything in their vocabulary.

Progress reinforces learning without creating pressure. Daily new words, completed reviews, streaks, vocabulary growth, consistency, difficult-word improvement, and meaningful milestones are useful. Do not turn every action into XP, badges, achievements, alerts, or points. Celebrate genuine milestones, not arbitrary activity.

Mistakes are normal. Feedback is clear, calm, and truthful: “Not quite.” “That one needs another try.” “Keep this one in rotation.” Avoid harsh failures, red warning screens, dramatic error motion, and childish praise. Success is usually understated; larger feedback belongs to meaningful milestones.

## 8. The Flying Hippo

The flying hippo is TobuKaba's central metaphor: a hippo should not fly, but it does—just as Japanese can become possible through steady practice. Its journey from grounded to airborne can appear in home scenes, review completion, goals, streaks, milestones, empty states, and long-term progress.

The hippo is a recognizable character of the TobuKaba world, not the product itself. Never let it obscure kanji, writing, or the primary action. Do not remove or replace the established mascot during redesigns unless explicitly instructed.

TobuKaba may offer brief, quiet encouragement before a study session, including the refrain “If I can learn to fly, you can learn kanji.” Motivational mascot moments belong around preparation and completion, not inside active recall where they would compete with writing.

## 9. Seasonal, time-of-day, and living-world environment

TobuKaba is a living Japanese countryside that changes through **Spring, Summer, Autumn, and Winter**. Users must have a visible manual season control. It changes atmosphere—colours, vegetation, scenery, weather, environmental details, subtle motion, and lighting—without changing core functionality.

Season is independent from time of day. The environment responds to the user's actual local time with morning, daytime, evening, and night lighting; the sun may rise, move, and set. Summer evening and winter evening should feel like different conditions in the same world.

- **Spring:** fresh growth, restrained cherry blossoms, gentle petals.
- **Summer:** lush greenery, warm brightness, optional rain or subtle summer detail.
- **Autumn:** changing foliage, fallen leaves, warm natural earth tones.
- **Winter:** snow, bare trees, cool quiet scenery.

These are atmospheric details, not decoration that competes with learning. Draw Japanese character from countryside mood—not tourist shorthand. Avoid excessive Mount Fuji, torii gates, temples, anime imagery, or sakura.

Over the long term, the environment may gently develop with learning: more vegetation, small landscape changes, richer seasonal detail, and a hippo increasingly at ease or beginning to fly. This reflects that learner and world change together. It is never a mandatory game mechanic.

The Learning Garden begins as an attractive, cared-for countryside resting place rather than a barren reward canvas. Its pond, stones, moss, grasses, ground cover, distant landscape, and time-dependent light form a permanent environmental baseline. Earned planting plots enrich that setting but are never responsible for making it pleasant.

For an established learner, historical vocabulary may prepare at most one welcoming starter plot. Later plots are filled by Lessons completed after the garden is introduced. A selected plant grows only from qualifying reviews completed after it was planted, using the associated words’ real SRS intervals. The highest legitimately earned stage never regresses. Garden presentation state must remain separate from word scheduling.

## 10. Motion and responsive behavior

Motion makes TobuKaba feel alive and gives useful feedback. Use it for review completion, transitions, progress, milestones, mascot movement, and quiet environmental effects such as clouds, leaves, snow, light, or vegetation. It is short, smooth, purposeful, subtle, and satisfying.

Continuous environmental motion stays low-key and never interferes with reading, recall, writing, or navigation. Respect `prefers-reduced-motion` throughout.

Mobile is a considered experience, not compressed desktop. Prioritize legible kanji, comfortable writing space, large touch targets, minimal needless scrolling, simple navigation, clear review controls, and quick transitions. Desktop may show more supporting context, but the review remains focused. Environmental details scale down or simplify rather than cover content.

## 11. Accessibility and voice

Accessibility is intrinsic to the system: readable type, sufficient contrast in every seasonal state, visible interaction states, usable touch targets, keyboard access where appropriate, meaningful labels, reduced-motion support, and information not conveyed by colour alone. An attractive seasonal palette never overrides legibility.

Alternate mascot poses must fail gracefully. Never hide a working primary pose until its replacement asset has loaded successfully; missing seasonal or time-specific artwork must leave a coherent fallback rather than an empty scene.

Microcopy is friendly, concise, calm, encouraging, and slightly playful—never patronizing or corporate-coach-like. Prefer “Nice. Keep going.”, “One more.”, “That one was tough.”, “Keep this one in rotation.”, and “You're getting there.” over exaggerated hype. “Even hippos can fly.” is a sparing, meaningful refrain. Let the interface be quiet when words are unnecessary.

## 12. Explicit design don'ts

Do not turn TobuKaba into a generic SaaS dashboard, sterile productivity app, Anki clone, traditional textbook, overly kawaii product, anime-heavy app, cluttered Japanese-themed site, or a statistics dashboard disguised as learning.

Avoid excess gradients, decorative elements, badges, popups, notifications, cards, buttons, accent colours, animation, and gamification. Do not add UI merely because there is room. Do not use Japanese imagery only to signal “Japan.” Never let the mascot, environment, or progress mechanics overpower the review, and never sacrifice usability for novelty.

Do not use platform emoji as interface icons or decorative markers. TobuKaba’s personality comes from typography, restrained environmental details, coherent CSS shapes, and the mascot rather than generic emoji. Japanese characters and functional typographic symbols are not affected by this rule.

## 13. Rules for future changes

1. Read this file before visual or UI changes; keep existing functionality and user data intact.
2. Preserve the hippo, countryside identity, and review-first character. Reuse existing assets where practical.
3. Give review and writing priority over decoration, gamification, and navigation.
4. Do not change SRS scheduling, completed-review counting, retry behavior, or new-word availability during a visual redesign unless explicitly asked.
5. Keep new, due, learning, long-term, and retry states clear.
6. Keep seasons manually selectable; keep time-of-day dynamic and independent; maintain accessibility in every environmental state.
7. Use coherent improvements, not novelty for novelty's sake. New features should feel designed with TobuKaba from the start.
8. When exact implementation values are unspecified, choose the clearest, simplest, most accessible, warm, slightly playful, learning-focused option consistent with this document.

Exact colour values, fonts, sizes, spacing, radii, shadows, durations, breakpoints, and component dimensions may be determined during implementation when they uphold these principles.

## 14. The TobuKaba test

Before a significant design decision, ask: **Does this make learning Japanese feel more achievable?**

It likely belongs when it improves clarity, makes reviews easier, encourages consistency, makes progress believable, strengthens TobuKaba's identity, or makes the world more alive without distraction. Reconsider it when it adds complexity or noise, competes with review, exists only to look impressive, or makes the product feel like a generic dashboard.

TobuKaba ultimately makes a difficult, long-term goal manageable. Learners do not have to conquer Japanese today. They only need to do the next review—one review at a time, one word at a time—and gradually, even a hippo can fly.
