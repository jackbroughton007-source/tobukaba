const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const assetPath = path.join(root, "assets", "tobukaba-backup-mascot.png");

assert(fs.existsSync(assetPath), "The front-facing backup mascot asset should exist");
assert(fs.statSync(assetPath).size > 50_000, "The mascot asset should not be an empty placeholder");
assert.equal(fs.readFileSync(assetPath).subarray(1, 4).toString("ascii"), "PNG");
assert(html.includes('src="assets/tobukaba-backup-mascot.png"'));
assert(html.includes('class="data-mascot-message" lang="ja">念のため！</span>'));
assert(html.includes('id="dataPageTitle">Backup &amp; Data</h2>'));
assert(css.includes(".data-backup-mascot"));
assert(css.includes(".data-mascot-message"));

console.log("Backup mascot presentation scenarios passed.");
