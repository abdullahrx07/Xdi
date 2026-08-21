"use strict";
/**
 * Runs every diagnostic/unit test suite in this folder.
 * Usage: node diagnostics/run-all.js
 */
const { execFileSync } = require("child_process");
const path = require("path");

const suites = [
    "reaction-registry.test.js",
    "atomic-json.test.js"
];

let failures = 0;
for (const suite of suites) {
    console.log("\n=== " + suite + " ===");
    try {
        const out = execFileSync(process.execPath, [path.join(__dirname, suite)], { encoding: "utf8" });
        process.stdout.write(out);
    } catch (err) {
        failures++;
        process.stdout.write(err.stdout || "");
        process.stderr.write(err.stderr || String(err));
    }
}

console.log("\n" + (suites.length - failures) + "/" + suites.length + " suites passed");
if (failures > 0) process.exit(1);
