const { getTime } = global.utils;

module.exports = {
	config: {
		name: "logsbot",
		isBot: true,
		version: "2.0",
		author: "NTKhang | rX",
		envConfig: { allow: true },
		category: "events"
	},

	langs: {
		en: {
			title: "====== Bot logs ======",
			added: "\n✅\nEvent: bot has been added to a new group\n- Added by: %1",
			kicked: "\n❌\nEvent: bot has been kicked\n- Kicked by: %1",
			footer: "\n- User ID: %1\n- Group: %2\n- Group ID: %3\n- Time: %4"
		}
	},

	onStart: async ({ usersData, threadsData, event, api, getLang }) => {
		// ── E2EE note ────────────────────────────────────────────────────
		// The native E2EE bridge does not currently emit any group
		// membership event (add/kick) — only message/reaction/typing/
		// receipt events exist (see includes/Fca/lib/index.mjs). So
		// event.logMessageType will simply never be set for E2EE threads
		// and this handler is a safe no-op for them; nothing to fix here
		// until the bridge itself exposes that event.
		if (event.isE2EE) return;
		if (!event.logMessageType) return;

		const botID = api.getCurrentUserID();

		// Only run if bot is added or removed
		const isBotAdded =
			event.logMessageType === "log:subscribe" &&
			Array.isArray(event.logMessageData?.addedParticipants) &&
			event.logMessageData.addedParticipants.some((p) => p.userFbId === botID);

		const isBotKicked =
			event.logMessageType === "log:unsubscribe" &&
			event.logMessageData?.leftParticipantFbId === botID;

		if (!isBotAdded && !isBotKicked) return;

		try {
			const { author, threadID } = event;
			if (author === botID) return;

			const { config } = global.GoatBot;
			const authorName = await usersData.getName(author);
			let threadName = "";
			let msg = getLang("title");

			if (isBotAdded) {
				try {
					const info = await api.getThreadInfo(threadID);
					threadName = info?.threadName || "";
				} catch (e) {
					console.error("logsbot.js getThreadInfo error:", e);
				}
				msg += getLang("added", authorName);
			} else {
				try {
					const threadData = await threadsData.get(threadID);
					threadName = threadData?.threadName || "";
				} catch (e) {
					console.error("logsbot.js threadsData.get error:", e);
				}
				msg += getLang("kicked", authorName);
			}

			const time = getTime("DD/MM/YYYY HH:mm:ss");
			msg += getLang("footer", author, threadName, threadID, time);

			for (const adminID of config.adminBot || []) {
				try {
					await api.sendMessage(msg, `${adminID}@msgr`);
				} catch (e) {
					// E2EE send failed — fall back to normal (non-E2EE) send.
					try {
						await api.sendMessage(msg, adminID);
					} catch (e2) {
						console.error(`logsbot.js sendMessage to ${adminID} failed (both E2EE and normal):`, e, e2);
					}
				}
			}
		} catch (err) {
			console.error("logsbot.js error:", err);
		}
	}
};
