"use strict";
/**
 * Tests for utils/atomicJson.js.
 * Run with: node diagnostics/atomic-json.test.js
 * Writes to a real temp directory and cleans up after itself.
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const atomicJson = require("../utils/atomicJson.js");

const tests = [];
let passed = 0;
function test(name, fn) {
    tests.push({ name, fn });
}

async function runAll() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atomicjson-test-"));
    console.log("atomicJson (scratch dir: " + tmpDir + ")");

    for (const { name, fn } of tests) {
        try {
            await fn(tmpDir);
            console.log("  ok - " + name);
            passed++;
        } catch (err) {
            console.error("  FAIL - " + name);
            console.error("    " + (err.stack || err.message));
            process.exitCode = 1;
        }
    }

    console.log(passed + " test(s) passed");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (process.exitCode) {
        console.error("SOME TESTS FAILED");
        process.exit(1);
    }
}

test("writeJsonAtomicSync + readJsonSafeSync round-trip", (tmpDir) => {
    const file = path.join(tmpDir, "a.json");
    atomicJson.writeJsonAtomicSync(file, { hello: "world", n: 42 });
    const read = atomicJson.readJsonSafeSync(file);
    assert.deepStrictEqual(read, { hello: "world", n: 42 });
});

test("no temp files are left behind after a successful write", (tmpDir) => {
    const file = path.join(tmpDir, "b.json");
    atomicJson.writeJsonAtomicSync(file, { x: 1 });
    const leftovers = fs.readdirSync(tmpDir).filter(f => f.includes(".tmp-"));
    assert.deepStrictEqual(leftovers, [], "no .tmp- files should remain: " + leftovers.join(", "));
});

test("a second write creates a .bak of the previous version", (tmpDir) => {
    const file = path.join(tmpDir, "c.json");
    atomicJson.writeJsonAtomicSync(file, { version: 1 });
    atomicJson.writeJsonAtomicSync(file, { version: 2 });
    assert.strictEqual(fs.existsSync(file + ".bak"), true);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file + ".bak", "utf8")), { version: 1 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, "utf8")), { version: 2 });
});

test("readJsonSafeSync recovers from a corrupted primary file via .bak", (tmpDir) => {
    const file = path.join(tmpDir, "d.json");
    atomicJson.writeJsonAtomicSync(file, { good: true });
    atomicJson.writeJsonAtomicSync(file, { good: true, again: true }); // now d.json.bak = {good:true}
    fs.writeFileSync(file, "{ this is not valid json"); // simulate corruption of the primary
    const recovered = atomicJson.readJsonSafeSync(file);
    assert.deepStrictEqual(recovered, { good: true });
});

test("readJsonSafeSync returns the provided default when both primary and backup are unusable", (tmpDir) => {
    const file = path.join(tmpDir, "missing.json");
    const value = atomicJson.readJsonSafeSync(file, { fallback: true });
    assert.deepStrictEqual(value, { fallback: true });
});

test("concurrent writes to the same file are serialized, not interleaved", async (tmpDir) => {
    const file = path.join(tmpDir, "e.json");
    const writes = [];
    for (let i = 0; i < 20; i++) {
        writes.push(atomicJson.writeJsonAtomic(file, { i }));
    }
    await Promise.all(writes);
    const final = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(typeof final.i === "number", "file should contain one complete, valid write, got: " + fs.readFileSync(file, "utf8"));
});

runAll();
