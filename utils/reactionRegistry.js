"use strict";

/**
 * ReactionRegistry
 * -----------------
 * Drop-in replacement for the plain `Map` previously used as
 * `global.GoatBot.onReaction`.
 *
 * Why this exists:
 *   Every command that waits for a reaction (games, confirmations, store
 *   browsing, etc.) does `GoatBot.onReaction.set(messageID, {...})` and,
 *   later, `GoatBot.onReaction.get(messageID)` / `.delete(messageID)`.
 *   With a plain Map, any handler that forgets to delete its own entry
 *   (or errors out before reaching the delete call) leaks forever — the
 *   Map only ever grows for the lifetime of the process. Left unbounded
 *   for weeks this is a slow memory leak, and large Maps make every
 *   lookup marginally slower under GC pressure.
 *
 * What this class changes, and what it deliberately does NOT change:
 *   - `set(key, value)` is unchanged in every observable way for callers:
 *     same signature, same return value, no new required fields. It just
 *     also stamps an internal, non-enumerable-by-convention `__createdAt`
 *     timestamp onto the stored value object (if the value is an object;
 *     primitives are left alone and simply never get swept).
 *   - `get`/`delete`/`has`/`size`/iteration all behave exactly like Map.
 *   - Nothing is deleted eagerly or on a short timer. Cleanup only removes
 *     entries older than `ttlMs` (default: 24 hours), and only during a
 *     periodic sweep — never synchronously inside get/set. A handler that
 *     is still valid because a user reacted 20 hours after the bot sent a
 *     message will NOT be broken by this.
 *   - Set `value.persistent = true` on any entry that must never expire
 *     (e.g. a permanent per-thread reaction shortcut) and the sweep will
 *     skip it forever.
 */
class ReactionRegistry extends Map {
    constructor(options) {
        super();
        this.ttlMs = (options && options.ttlMs) || 24 * 60 * 60 * 1000; // 24h default
        this._sweepTimer = null;
    }

    set(key, value) {
        if (value && typeof value === "object" && !value.__createdAt) {
            value.__createdAt = Date.now();
        }
        return super.set(key, value);
    }

    /**
     * Remove entries older than this.ttlMs, skipping anything marked
     * `persistent: true`. Returns the number of entries removed.
     */
    sweep() {
        var now = Date.now();
        var removed = 0;
        for (var entry of this.entries()) {
            var key = entry[0];
            var value = entry[1];
            if (!value || typeof value !== "object") continue;
            if (value.persistent === true) continue;
            var createdAt = value.__createdAt || now; // unknown age: assume fresh
            if (now - createdAt > this.ttlMs) {
                this.delete(key);
                removed++;
            }
        }
        return removed;
    }

    /** Start periodic sweeping. Safe to call multiple times (idempotent). */
    startAutoSweep(intervalMs, log) {
        this.stopAutoSweep();
        var self = this;
        this._sweepTimer = setInterval(function () {
            try {
                var removed = self.sweep();
                if (removed > 0 && log) {
                    log.info("ReactionRegistry", "Swept " + removed + " expired reaction handler(s). Current size: " + self.size);
                }
            } catch (err) {
                if (log) log.error("ReactionRegistry", "Sweep failed", err);
            }
        }, intervalMs || 15 * 60 * 1000); // default: every 15 minutes
        if (this._sweepTimer.unref) this._sweepTimer.unref();
    }

    stopAutoSweep() {
        if (this._sweepTimer) {
            clearInterval(this._sweepTimer);
            this._sweepTimer = null;
        }
    }
}

module.exports = ReactionRegistry;
