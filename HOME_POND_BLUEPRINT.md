# Home Pond blueprint

## Purpose

The Home Pond is TobuKaba's permanent environment. Study implies a wider journey, but the product does not render separate travel scenes. The pond remains spatially stable and becomes livelier only through companions the learner discovers and chooses to display.

## Master composition

- Canvas: `1672 × 941`.
- Pond: broad oval occupying approximately `left 22%–79%`, `top 49%–88%`.
- TobuKaba: fixed on the near inner bank, facing slightly toward the pond.
- Kotaro's sunny stone: upper-right bank. This is his stable position when selected.
- Tree, dock, reeds, meadow, and distant landscape are permanent parts of the established environment, not unlockable decorations.

## Production layers

All live layers use the complete `1672 × 941` canvas.

1. `sky-v1.png`
2. `distant-island-v1.png`
3. `far-bank-v1.png`
4. `pond-water-v1.png`
5. `main-bank-v1.png`
6. `tree-and-dock-v1.png`
7. `habitat-details-v1.png`
8. `foreground-plants-v1.png`

The cloud, water-reflection, foliage, lily-pad, and butterfly assets provide the pond's existing quiet ambient motion. They are unrelated to the retired flying/travel system and remain active.

## Companion placement

Each companion entry in `travel-content.js` owns its pond image and one stable `pondPosition` (`left`, `top`, and `width` percentages). TobuKaba is always present. Locked companions are never selectable; unlocked companions appear only when their ID is in `visibleCompanionIds`.

Kotaro uses `left 76.5%`, `top 35.5%`, `width 13%`, aligning him with the sunny stone in the existing artwork.

## Motion and interaction

- No parallax route, flying character, or travel-background movement.
- Water, clouds, foliage, and wildlife remain subtle Home Pond ambience.
- TobuKaba may blink or sleep without changing position.
- A selected companion may use a subtle, local idle motion without moving to another habitat.
- Reduced-motion mode shows the same complete composition as a still scene.

## Responsive rules

- Desktop uses the full composition.
- Tablet keeps the whole pond and may crop only decorative edge foliage.
- Mobile keeps TobuKaba, the pond, and selected companion positions visible without horizontal overflow.
- Companion controls become a single column with full-width touch targets.

## Adding a future companion

Add one entry to `companions` in `travel-content.js` with a stable ID, name, description, image, portrait, `milestoneUnits`, and `pondPosition`. No route, scene, journal, item, decoration, wardrobe, or shop configuration is required.

## Acceptance criteria

- The pond feels complete before anything is unlocked.
- TobuKaba remains present.
- Study advances the fixed Journey Progress Bar.
- A milestone unlock produces one persisted discovery notification.
- The learner can independently show or hide each unlocked companion.
- Companion visibility survives refresh and cloud merge.
- No decoration, furniture, memento, wardrobe, shop, destination picker, or alternative-route controls appear.
