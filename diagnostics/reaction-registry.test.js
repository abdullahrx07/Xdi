"use strict";
/**
 * Unit tests for utils/reactionRegistry.js.
 * Run with: node diagnostics/reaction-registry.test.js
 */
const assert = require("assert");
const ReactionRegistry = require("../utils/reactionRegistry.js");

let passed = 0;
function test(name, fn) {
    try {
        fn();
        console.log("  ok - " + name);
        passed++;
    } catch (err) {
        console.error("  FAIL - " + name);
        console.error("    " + err.message);
        process.exitCode = 1;
    }
}

console.log("ReactionRegistry");

test("behaves like a Map for existing command call sites (set/get/delete/size)", () => {
    const reg = new ReactionRegistry();
    reg.set("mid1", { commandName: "guessnumber", author: "u1" });
    assert.strictEqual(reg.size, 1);
    assert.strictEqual(reg.get("mid1").commandName, "guessnumber");
    reg.delete("mid1");
    assert.strictEqual(reg.get("mid1"), undefined);
    assert.strictEqual(reg.size, 0);
});

test("set() stamps __createdAt without requiring any caller change", () => {
    const reg = new ReactionRegistry();
    const before = Date.now();
    reg.set("mid1", { commandName: "x" });
    const stored = reg.get("mid1");
    assert.ok(typeof stored.__createdAt === "number");
    assert.ok(stored.__createdAt >= before);
});

test("sweep() removes entries older than ttlMs", () => {
    const reg = new ReactionRegistry({ ttlMs: 1000 });
    const oldEntry = { commandName: "old" };
    oldEntry.__createdAt = Date.now() - 5000; // manually age it
    reg.set("old", oldEntry);
    reg.set("fresh", { commandName: "fresh" });
    const removed = reg.sweep();
    assert.strictEqual(removed, 1);
    assert.strictEqual(reg.has("old"), false, "stale entry should be removed");
    assert.strictEqual(reg.has("fresh"), true, "fresh entry must survive the sweep");
});

test("sweep() never removes a long-waiting but still-fresh entry (no premature TTL)", () => {
    // Simulates: bot sends a message expecting a reaction, user reacts 20h later.
    const reg = new ReactionRegistry({ ttlMs: 24 * 60 * 60 * 1000 }); // 24h
    const entry = { commandName: "game" };
    entry.__createdAt = Date.now() - 20 * 60 * 60 * 1000; // 20h ago
    reg.set("mid1", entry);
    reg.sweep();
    assert.strictEqual(reg.has("mid1"), true, "a 20h-old handler must not be swept under a 24h TTL");
});

test("entries marked persistent are never swept regardless of age", () => {
    const reg = new ReactionRegistry({ ttlMs: 1000 });
    const entry = { commandName: "permanentShortcut", persistent: true };
    entry.__createdAt = Date.now() - 1000 * 1000 * 1000; // absurdly old
    reg.set("mid1", entry);
    reg.sweep();
    assert.strictEqual(reg.has("mid1"), true, "persistent entries must survive sweeping forever");
});

test("startAutoSweep/stopAutoSweep do not throw and are idempotent", () => {
    const reg = new ReactionRegistry({ ttlMs: 1000 });
    reg.startAutoSweep(10000);
    reg.startAutoSweep(10000); // calling twice must not create two timers / throw
    reg.stopAutoSweep();
    reg.stopAutoSweep(); // calling twice must not throw
});

console.log(passed + " test(s) passed");
if (process.exitCode) {
    console.error("SOME TESTS FAILED");
    process.exit(1);
}
