/**
 * ============================================================
 *  TWO-ID MODE (dual Facebook account failover)
 * ============================================================
 * What this does:
 *  - You keep TWO Facebook accounts' cookies: account.txt (primary)
 *    and account2.txt (secondary/backup).
 *  - If the primary account fails to log in, or gets logged out /
 *    "Not logged in" errors happen repeatedly in a row, the bot
 *    automatically swaps in the secondary account's cookies and
 *    keeps running instead of crash-looping forever on a dead
 *    account, or dying silently and staying offline.
 *  - State (which account is currently active, how many failures
 *    in a row) is stored in data/twoIdModeState.json so it survives
 *    restarts.
 *
 * Config (config.json -> "twoIdMode"):
 *   {
 *     "enable": false,
 *     "secondaryAccountPath": "account2.txt",
 *     "switchAfterFailedAttempts": 2,
 *     "notifyAdminOnSwitch": true
 *   }
 *
 * This file is intentionally kept separate from bot/login/login.js
 * (which is minified/obfuscated) so it stays easy to read and edit.
 * ============================================================
 */

const fs = require("fs-extra");
const path = require("path");

const stateFilePath = path.normalize(`${process.cwd()}/data/twoIdModeState.json`);

function defaultState() {
	return { activeAccount: "primary", failCount: 0, lastSwitchAt: 0 };
}

function readState() {
	try {
		return fs.readJsonSync(stateFilePath);
	}
	catch {
		return defaultState();
	}
}

function writeState(state) {
	try {
		fs.ensureFileSync(stateFilePath);
		fs.writeJsonSync(stateFilePath, state, { spaces: 2 });
	}
	catch (err) {
		// non-fatal: worst case we just lose the failure counter across a restart
		console.log("[TWO-ID MODE] Could not save state file:", err.message || err);
	}
}

/**
 * Swap the contents of the currently-active account file (account.txt,
 * whatever dirAccount points to) with the secondary account file.
 * Returns true if the swap happened, false if it couldn't (e.g. the
 * secondary file is missing or still has the placeholder text).
 */
function trySwapAccountFiles(secondaryPath) {
	try {
		const dirAccount = global.client?.dirAccount || path.normalize(`${process.cwd()}/account.txt`);
		const secondaryFull = path.isAbsolute(secondaryPath)
			? secondaryPath
			: path.normalize(`${process.cwd()}/${secondaryPath}`);

		if (!fs.existsSync(secondaryFull)) {
			console.log(`[TWO-ID MODE] Secondary account file not found at "${secondaryFull}", can't switch.`);
			return false;
		}

		const secondaryContent = fs.readFileSync(secondaryFull, "utf8").trim();
		if (!secondaryContent || secondaryContent.toLowerCase().includes("paste your fb json cookies")) {
			console.log("[TWO-ID MODE] Secondary account file is still empty/placeholder, can't switch.");
			return false;
		}

		const currentContent = fs.existsSync(dirAccount) ? fs.readFileSync(dirAccount, "utf8") : "";

		fs.writeFileSync(dirAccount, secondaryContent, "utf8");
		fs.writeFileSync(secondaryFull, currentContent, "utf8");
		return true;
	}
	catch (err) {
		console.log("[TWO-ID MODE] Error while swapping account files:", err.message || err);
		return false;
	}
}

/**
 * Call this whenever a login attempt / listen session fails.
 * Returns true if it just switched accounts (so the caller can choose
 * to restart the process right away instead of exiting for good).
 */
function recordLoginFailure(config) {
	const twoIdMode = config?.twoIdMode;
	if (!twoIdMode?.enable) return false;

	const state = readState();
	state.failCount = (state.failCount || 0) + 1;

	const threshold = Number(twoIdMode.switchAfterFailedAttempts) || 2;
	console.log(`[TWO-ID MODE] Login/listen failure #${state.failCount} on the ${state.activeAccount} account.`);

	let switched = false;
	if (state.failCount >= threshold) {
		switched = trySwapAccountFiles(twoIdMode.secondaryAccountPath || "account2.txt");
		if (switched) {
			state.activeAccount = state.activeAccount === "primary" ? "secondary" : "primary";
			state.failCount = 0;
			state.lastSwitchAt = Date.now();
			console.log(`[TWO-ID MODE] ⚠️  Switched over — the bot will now try logging in with the ${state.activeAccount} account.`);
		}
	}

	writeState(state);
	return switched;
}

/**
 * Call this whenever a login / listen session succeeds, to reset the
 * failure counter so old failures don't carry over.
 */
function recordLoginSuccess(config) {
	const twoIdMode = config?.twoIdMode;
	if (!twoIdMode?.enable) return;

	const state = readState();
	if (state.failCount !== 0) {
		state.failCount = 0;
		writeState(state);
	}
}

module.exports = { recordLoginFailure, recordLoginSuccess, trySwapAccountFiles, readState, writeState, defaultState };
