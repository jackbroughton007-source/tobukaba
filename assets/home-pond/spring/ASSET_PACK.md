# Spring Home Pond asset pack

## Approved blueprint

The layout specification lives in `../../../../HOME_POND_BLUEPRINT.md`.

## Master composition

- `master-composition-v2.png` — preferred master
- `master-composition-v1.png` — retained first version for comparison
- Canvas: `1672 × 941`, opaque, 16:9
- Purpose: art-direction reference for all later environment layers
- Status: approved art-direction reference; production layers integrated into the Home Pond renderer

The master shows the post-Kotaro spring state so character scale and habitat relationships can be judged:

- TobuKaba soaks near the inner bank with only the head above water; version 2 removes the oversized visible shoulders and forelegs from version 1.
- Kotaro sleeps on his permanent sunny stone.
- The red cape rests on its existing mossy rock.
- The left tree, dock, meadow, reed cove, travel-shelf area, and open landmark area remain part of the environment.
- No speculative companions or journey mementos are present.

## Production environment layers

All production layers use the same `1672 × 941` coordinate system. Only the sky is opaque; every later layer has genuine alpha transparency.

| Order | File | Contents | Alpha |
| --- | --- | --- | --- |
| 1 | `sky-v1.png` | Spring-blue sky and cream clouds | No |
| 2 | `distant-island-v1.png` | Distant sea horizon and island silhouettes | Yes |
| 3 | `far-bank-v1.png` | Rear meadow and low vegetation | Yes |
| 4 | `pond-water-v1.png` | Pond surface, reflection base, and ripples | Yes |
| 5 | `main-bank-v1.png` | Permanent terrain and shoreline structure | Yes |
| 6 | `tree-and-dock-v1.png` | Old flowering tree and wooden dock | Yes |
| 7 | `habitat-details-v1.png` | Empty sunny stone, empty cape rock, reeds, lily pads, and fixed natural accents | Yes |
| 8 | `foreground-plants-v1.png` | Near-camera grass, leaves, and flowers | Yes |
| Retired | `light-effects-v1.png` | Earlier combined petal/glint pass; retained for provenance but no longer loaded because it crossed character faces | Yes |

`layer-stack-preview-v1.png` is the environment-only QA composite. `layer-preview.html` is a lightweight local stacking reference. Neither is loaded by the live scene.

Characters, wardrobe, companions, and future mementos remain separate from this stack. TobuKaba and Kotaro use their existing sprites. The live scene uses the environment-specific `cape-draped-v3.png`; the generic cape remains the inventory/wardrobe thumbnail.

## Scene-specific cape

- `cape-draped-v3.png` — accepted full-canvas transparent overlay, aligned to the lower-right mossy rock
- `cape-draped-v1.png` and `cape-draped-v2.png` — rejected alignment explorations retained as versioned source history

The accepted cape was generated from the approved master with the empty `habitat-details-v1.png` rock as the separation reference. The request preserved the master’s exact cape position, size, folds, texture, and warm painterly rendering while excluding the rock, scenery, glow, matte, characters, and UI. Only the cape and its small contact shadow remain.

## Living-scene overlays

These transparent full-canvas overlays retain the same `1672 × 941` alignment as the production environment:

| Status | File | Purpose |
| --- | --- | --- |
| Accepted | `clouds-motion-v1.png` | Two source-matched transparent cloud groups for a very slow loop behind the distant landscape |
| Accepted | `water-reflections-motion-v2.png` | Three disconnected reflection areas and partial painted waterline strokes for slow low-opacity drift and breathing ripples |
| Accepted | `lily-pad-motion-v2.png` | One source-matched lily pad on the aligned transparent canvas for a clipped slow pond drift |
| Accepted | `foliage-motion-v1.png` | Five isolated source-matched vegetation groups: one branch tip, two reed groups, and two foreground grass patches |
| Accepted | `butterfly-event-v1.png` | One tiny painted spring butterfly used for a rare short daytime pass |
| Rejected | `water-reflections-motion-v1.png` | First reflection extraction; retained for history but too much of the complete pond remained for believable motion |
| Rejected | `lily-pad-motion-v1.png` | First extraction; retained for history after the cleaner v2 pass replaced it |

The earlier CSS-drawn gradient shimmer, elliptical ripples, blades, leaf shape, and butterfly wings have been removed. The accepted overlays carry the source painting’s texture. Clouds make one calm 72-second back-and-forth pass behind the landscape. Water uses two low-opacity copies of the same disconnected reflection painting, moving out of phase by approximately 2.3 pixels with a tiny horizontal stretch. One isolated lily pad follows a separately clipped open-water path; foliage and character movement remain secondary.

The visibility-tuning pass makes the motion easier to read: cloud travel is `8.05%`; primary reflections use `0.24` opacity, a `2.3px` amplitude, `0.0069` horizontal scale variation, and an 11.8-second cycle; a second `0.10`-opacity copy crosses it over 8.6 seconds. The lily pad is rendered at `0.72` scale and travels between `-7%` and `5%` over 28 seconds per direction, shifted upward `11%` into open water with only a one-pixel bob and `0.4°` rotation. The branch and reeds use independent `1.4–1.6°` cycles; foreground grass uses independent `1.9–2°` cycles; and the butterfly’s 24-second cycle includes an approximately five-second visible window. Kotaro’s Home Pond width is `13%` at the fixed `76.5%, 35.5%` sunny-stone anchor so he reads as a background companion.

Kotaro’s ear and tail details reuse clipped duplicates of `assets/companions/kotaro/kotaro-home-pond.png`, so the rare twitches retain the exact approved painting and require no additional sprite. The built-in generator was asked for a dedicated Kotaro detail overlay, but that attempt reached the generator usage limit and produced no project asset.

## Generation prompt summary

The built-in image generator received the approved `master-composition-v2.png` as the alignment and art-direction reference for each layer. Each pass was directed to preserve the complete canvas, coordinate system, painterly Japanese storybook treatment, palette, perspective, and lighting while isolating only its named depth band. Transparent passes explicitly excluded mattes, checkerboards, rectangular backdrops, characters, wardrobe, text, UI, and speculative content.

The effects pass was regenerated after the first attempt introduced inappropriate dark-edged golden blobs. The retained version contains only pale petals and thin water highlights.

The living-scene work used the built-in image generator in background-extraction mode:

- Water v1: isolate sparse painterly reflections and waterline fragments from the aligned water layer; the result was rejected because it retained too much contiguous water.
- Water v2: remove at least 85% of v1 and retain only three disconnected reflection groups plus partial curved waterline strokes; no shore, objects, characters, matte, or rectangular haze.
- Clouds v1: extract only two low-contrast cloud groups from the approved sky and master at the original `1672 × 941` coordinates; preserve genuine transparency and exclude sky fill, horizon, scenery, characters, mattes, and rectangular edges. Generated with the built-in image generator in background-extraction mode.
- Lily pad v2: isolate one small green lily pad from the approved master at its original aligned scale and perspective, then clean the transparent canvas so only the connected painted object remains. No flower, water patch, reflection, glow, scenery, or matte. Generated with the built-in image generator in background-extraction mode.
- Foliage v1: isolate five named plant groups from the tree, habitat, and foreground layers at their original coordinates; exclude all terrain and scenery.
- Butterfly v1: create one very small pale-yellow storybook butterfly at the specified aligned coordinate on a fully transparent canvas; exclude trails, glow, particles, and scenery.
- Kotaro detail attempt: isolate only one ear and the tail tip on the original sprite canvas. The request failed at the usage limit, so the live implementation instead clips the approved source sprite.

## QA status

- Every layer is `1672 × 941`.
- `sky-v1.png` is opaque.
- Layers 2–8 contain alpha transparency.
- The environment-only stack has been composited and visually checked for depth order, uncovered holes, and accidental rectangular backgrounds.
- The central pond remains open for a separate head-only TobuKaba sprite.
- Kotaro's sunny stone and the cape display rock are complete beneath their removable assets.

## Live integration

- Layer order and anchor coordinates live under `homePond` in `travel-content.js`.
- `app.js` builds the environment stack from that catalogue when the Home Pond view renders.
- TobuKaba is clipped at the waterline so only the head reads above the pond.
- Kotaro uses one fixed sunny-stone anchor after being befriended and never changes position on hover or focus.
- `cape-draped-v3.png` is a full-canvas transparent overlay that naturally follows the rock; it avoids brittle hand-positioning at different viewport sizes.
- The old `light-effects-v1.png` file remains in the asset pack but is deliberately absent from the live layer catalogue.
- Cloud drift, water shimmer, the clipped lily-pad path, pond ripples, reeds, grass tips, selected leaves, character breathing, and the rare butterfly are small CSS animations generated from the `homePond.motion` configuration. No complete ground, shore, or water layer moves.
- The current implementation uses raster artwork overlays for clouds, water, foliage, and the butterfly; CSS supplies only restrained transforms, opacity timing, clipping, and pause behavior.
- Motion elements below the character plane cannot cross TobuKaba, Kotaro, or the cape. Foreground grass is limited to the lower edge.
- `prefers-reduced-motion` disables all ambient motion and hides transient ripples and the butterfly.
- `work/home-pond-integration-preview.html` provides account-free desktop and mobile visual QA using the production assets and CSS.
