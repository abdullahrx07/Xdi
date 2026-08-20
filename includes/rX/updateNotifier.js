/**
 * Background update notifier.
 *
 * Runs on an interval AFTER the bot has already booted and logged in (never
 * blocks startup). Silently checks + stages new versions via autoUpdate.js,
 * then DMs every configured admin's own inbox once per new version with a
 * "new version available, react ✅ to update" message. Reacting ✅ (handled
 * in modules/cmds/update.js#onReaction) or running the `update` command
 * both apply the already-downloaded update.
 */

const log = require("../../utils/logger/log.js");
const { checkAndStageUpdate, markPendingNotified } = require("./autoUpdate.js");

const CONFIRM_EMOJIS = ["✅", "☑️", "👍", "💯"];

async function notifyAdmins(api, rootDir, marker) {
	const config = global.GoatBot?.config || {};
	const admins = config.adminBot || [];
	if (admins.length === 0) {
		log.warn("AUTO UPDATE", "New version staged but no admins configured in config.json > adminBot to notify.");
		return;
	}

	const text =
		`🚀 | New bot version available!\n` +
		`📦 | v${marker.localVersion} → v${marker.remoteVersion}\n` +
		`✅ | React with ✅ on this message to update now,\n` +
		`⌨️ | or send the "update" command anytime to apply it.`;

	for (const adminID of admins) {
		try {
			await new Promise((resolve) => {
				api.sendMessage(text, adminID, (err, info) => {
					if (err || !info?.messageID) {
						log.warn("AUTO UPDATE", `Failed to notify admin ${adminID} about new version: ${err?.message || "no messageID returned"}`);
						return resolve();
					}
					if (!global.GoatBot.onReaction) global.GoatBot.onReaction = new Map();
					global.GoatBot.onReaction.set(info.messageID, {
						commandName: "update",
						type: "confirmStagedUpdate",
						author: adminID,
						remoteVersion: marker.remoteVersion,
						timestamp: Date.now()
					});
					resolve();
				});
			});
		} catch (sendErr) {
			log.warn("AUTO UPDATE", `Failed to notify admin ${adminID} about new version: ${sendErr.message}`);
		}
	}

	markPendingNotified(rootDir);
}

async function runCheck(api, rootDir) {
	try {
		const result = await checkAndStageUpdate(rootDir);
		if (result.staged) {
			await notifyAdmins(api, rootDir, result.marker);
		} else if (result.alreadyStaged && result.marker && !result.marker.notified) {
			// Staged on a previous run but we haven't successfully notified yet
			await notifyAdmins(api, rootDir, result.marker);
		}
	} catch (err) {
		log.warn("AUTO UPDATE", `Background update check failed: ${err.message}`);
	}
}

/**
 * Starts the background interval. Safe to call multiple times (e.g. once
 * per command reload) — guarded so only one interval is ever active.
 */
function startBackgroundUpdateChecker({ api }) {
	const config = global.GoatBot?.config || {};
	const gitUpdate = config.gitUpdate;
	if (!gitUpdate || gitUpdate.autoUpdate !== true) {
		log.info("AUTO UPDATE", "Background auto update is disabled (set config.json > gitUpdate.autoUpdate to true to enable).");
		return;
	}

	if (global.GoatBot._updateCheckerStarted) return;
	global.GoatBot._updateCheckerStarted = true;

	const rootDir = process.cwd();
	const intervalMinutes = Math.max(5, Number(gitUpdate.checkIntervalMinutes) || 60);

	// First check shortly after boot (bot is already listening by then —
	// this never delays login/port-bind), then repeat on the interval.
	setTimeout(() => runCheck(api, rootDir), 15 * 1000);
	global.GoatBot._updateCheckerInterval = setInterval(() => runCheck(api, rootDir), intervalMinutes * 60 * 1000);

	log.info("AUTO UPDATE", `Background update checker started (checking every ${intervalMinutes} minute(s)).`);
}

module.exports = { startBackgroundUpdateChecker, CONFIRM_EMOJIS };
