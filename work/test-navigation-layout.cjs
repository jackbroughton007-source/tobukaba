const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const auth = fs.readFileSync(path.join(root, "auth.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

const header = html.slice(html.indexOf('<header class="site-hero">'), html.indexOf("</header>") + 9);
const navigation = header.slice(header.indexOf('<nav class="primary-navigation"'), header.indexOf("</nav>") + 6);
const destinations = [...navigation.matchAll(/data-page="([^"]+)"/g)].map(match => match[1]);

assert.deepStrictEqual(destinations, ["dashboard", "quiz", "vocabulary", "statistics", "backup"]);
assert(!/[🏠✍️📚📊➕💾]/u.test(navigation), "Primary navigation must remain text-only");
assert(header.includes('id="heroNavigation" hidden'), "Authenticated navigation should start hidden");
assert(header.includes('id="accountEmail"') && header.includes('id="syncStatus"'), "Account state remains available in the header");

assert(!html.includes('class="home-introduction"'), "Redundant Home introduction should be removed");
assert(html.indexOf('class="home-study-focus"') < html.indexOf('id="morningAcknowledgement"'), "Today's study action should be the first Home content");
assert(html.indexOf("showPage('add')") > html.indexOf('<section id="vocabulary"'), "Add Word remains accessible from Vocabulary");
assert(!navigation.includes('data-page="add"'), "Add Word should not compete in primary navigation");

assert(app.includes('page === "add" ? "vocabulary" : page'), "Add Word should preserve Vocabulary as the active navigation context");
assert(app.includes('setAttribute("aria-current", "page")'), "Active navigation should be announced accessibly");
assert(auth.includes('getElementById("heroNavigation").hidden = false'), "Navigation should appear after authentication");
assert(auth.includes('getElementById("heroNavigation").hidden = true'), "Navigation should hide on sign out");

assert(css.includes(".hero-navigation"), "Integrated navigation styles should exist");
assert(css.includes("min-height:44px"), "Interactive controls should preserve a 44px target");
assert(css.includes("#dashboard { position:relative; z-index:7; margin-top:-46px"), "Home study area should meet the environment above the fold");
assert(css.includes(".site-hero.is-compact"), "Interior pages should retain a compact environmental header");

console.log("Navigation and above-the-fold hierarchy scenarios passed.");
