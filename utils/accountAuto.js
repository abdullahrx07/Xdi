/**
 * utils/accountAuto.js
 *
 * Shared persistence helper for the account-automation command cluster:
 * activestatus, autoseen, autoread, typing (storyreaction / fbcomment /
 * searchfriend / unfriend are one-shot actions and don't need a toggle).
 *
 * Storage: global.GoatBot.config.accountAuto, i.e. a new key inside the
 * bot's existing config.json — the SAME file and pattern already used by
 * scripts/cmds/setting.js for every other bot-wide switch (adminOnly,
 * reactUnsend, optionsFca, noPrefix, ...). This is intentional:
 *
 *   - These are bot-ACCOUNT-wide switches (not per-thread/per-user data),
 *     so database/controller/{threadsData,usersData}.js is the wrong
 *     place for them — globalData.js would also work, but config.json
 *     is already the established home for this exact kind of setting
 *     and is what scripts/cmds/setting.js already edits.
 *   - config.json is loaded into global.GoatBot.config at every boot
 *     (see Goat.js) and is file-watched + hot-reloaded on change, so a
 *     toggle saved here is automatically "restored" on every future
 *     restart with zero extra boot code — any command just has to read
 *     global.GoatBot.config.accountAuto at the moment it needs it.
 *   - No extra flat-file caches (the old scripts/cmds/cache/autoseen.json
 *     approach) and no extra database tables.
 *
 * IMPORTANT: Goat.js's file watcher *replaces* global.GoatBot.config
 * wholesale ~200ms after every config.json write. Never hold a cached
 * reference to global.GoatBot.config (or to the object this module
 * returns) across time — always call getConfig()/getSetting() fresh.
 */

"use strict";

const fs = require("fs-extra");
const path = require("path");

const DEFAULT_SETTINGS = {
	activeStatus: false,
	autoSeen: false,
	autoRead: false,
	typing: false,
	storyReactionDefaultEmoji: "❤️"
};

function configFilePath() {
	return (global.client && global.client.dirConfig) || path.join(process.cwd(), "config.json");
}

function readConfigFileFromDisk() {
	return JSON.parse(fs.readFileSync(configFilePath(), "utf8"));
}

/**
 * Returns the live accountAuto settings object, shaped with defaults for
 * any key that hasn't been saved yet. Always reflects the current
 * global.GoatBot.config (never a stale copy).
 */
function getConfig() {
	if (!global.GoatBot.config.accountAuto || typeof global.GoatBot.config.accountAuto !== "object")
		global.GoatBot.config.accountAuto = { ...DEFAULT_SETTINGS };
	else
		global.GoatBot.config.accountAuto = { ...DEFAULT_SETTINGS, ...global.GoatBot.config.accountAuto };
	return global.GoatBot.config.accountAuto;
}

function getSetting(key) {
	return getConfig()[key];
}

/**
 * Persists a single accountAuto key both in memory (instant effect) and
 * to disk (survives restart). Mirrors the read-fresh-patch-write pattern
 * already used by scripts/cmds/setting.js, so it never clobbers other
 * config.json fields that may have changed concurrently (e.g. via the
 * dashboard).
 */
function saveSetting(key, value) {
	// 1) update the in-memory config immediately
	const memConfig = getConfig();
	memConfig[key] = value;
	global.GoatBot.config.accountAuto = memConfig;

	// 2) persist to disk
	try {
		const diskConfig = readConfigFileFromDisk();
		diskConfig.accountAuto = {
			...DEFAULT_SETTINGS,
			...diskConfig.accountAuto,
			[key]: value
		};
		fs.writeFileSync(configFilePath(), JSON.stringify(diskConfig, null, 2), "utf8");
	}
	catch (err) {
		console.error("[accountAuto] Failed to persist config.json:", err.message || err);
	}

	return memConfig;
}

module.exports = {
	DEFAULT_SETTINGS,
	getConfig,
	getSetting,
	saveSetting
};
