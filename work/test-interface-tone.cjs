const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const design = fs.readFileSync("design.md", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert(!/\bTobuka(?:'s|’s)?\b/.test(html + app), "User-visible mascot naming must use TobuKaba");
assert(!/\p{Extended_Pictographic}/u.test(html + app), "Interface source must not contain platform emoji");
assert(html.includes("If I can learn to fly, you can learn kanji."));
assert(html.includes('class="study-mascot-encouragement"'));
assert(html.includes('id="heroSleepingTobuKaba"'));
assert(fs.existsSync("assets/tobukaba-hero-sleeping.png"));
assert(app.includes("function prepareHeroMascotSwap()"));
assert(styles.includes('[data-time="night"].hero-sleeping-mascot-ready .flying-hippo-sleeping'));
assert(html.includes('id="gardenSleepingTobuKaba"'));
assert(app.includes('sleeping.addEventListener("error", keepAwakeFallback'));
assert(styles.includes('[data-time="night"].sleeping-mascot-ready .garden-tobukaba-awake'));

assert(html.includes('id="homePondEnvironment"'), "Home Pond environment mount is missing");
assert(html.includes('id="homePondMotion"'), "Home Pond motion mount is missing");
assert(html.includes('id="homePondCape"'), "Independent cape layer is missing");
for (const layer of [
  "sky-v1.png",
  "distant-island-v1.png",
  "far-bank-v1.png",
  "pond-water-v1.png",
  "main-bank-v1.png",
  "tree-and-dock-v1.png",
  "habitat-details-v1.png",
  "foreground-plants-v1.png"
]) assert(fs.readFileSync("travel-content.js", "utf8").includes(layer), `Home Pond catalogue is missing ${layer}`);
const travelContent = fs.readFileSync("travel-content.js", "utf8");
assert(!travelContent.includes('{ id: "light-effects"'), "Particle effects layer must be retired from the live stack");
assert(travelContent.includes("cape-draped-v3.png"), "Scene-specific draped cape is missing");
assert(travelContent.includes("clouds-motion-v1.png"), "Artwork-derived cloud motion must be content-configured");
assert(travelContent.includes("water-reflections-motion-v2.png"), "Artwork-derived water motion must be content-configured");
assert(travelContent.includes("lily-pad-motion-v2.png"), "Artwork-derived lily-pad motion must be content-configured");
assert(travelContent.includes("foliage-motion-v1.png"), "Artwork-derived foliage motion must be content-configured");
assert(travelContent.includes("butterfly-event-v1.png"), "Rare ambient event must be content-configured");
for (const asset of [
  "assets/home-pond/spring/clouds-motion-v1.png",
  "assets/home-pond/spring/water-reflections-motion-v2.png",
  "assets/home-pond/spring/lily-pad-motion-v2.png",
  "assets/home-pond/spring/foliage-motion-v1.png",
  "assets/home-pond/spring/butterfly-event-v1.png"
]) assert(fs.existsSync(asset), `Home Pond motion asset is missing: ${asset}`);
assert(app.includes("function renderHomePondEnvironment(content)"));
assert(app.includes("motionSignature"), "Motion renderer must preserve deterministic active loops across rerenders");
assert(app.includes("syncHomePondMotionState"), "Hidden Home Pond motion must pause");
assert(styles.includes(".home-pond-layer"));
assert(styles.includes("@keyframes home-pond-cloud-drift"));
assert(styles.includes("@keyframes home-pond-water-drift"));
assert(styles.includes("@keyframes home-pond-water-cross-drift"));
assert(styles.includes("@keyframes home-pond-lily-drift"));
assert(styles.includes("@keyframes home-pond-kotaro-breathe"));

for (const time of ["dawn", "morning", "day", "golden", "sunset", "evening", "night"])
  assert(styles.includes(`[data-time="${time}"]`), `Garden is missing ${time} atmosphere`);

assert(design.includes("Always use the exact capitalization “TobuKaba.”"));
assert(design.includes("Do not use platform emoji as interface icons"));
assert(design.includes("historical vocabulary may prepare at most one welcoming starter plot"));

console.log("Naming, interface tone, and garden-environment scenarios passed.");
