const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log, getText } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

module.exports = async function (usersData, threadsData, event) {
	const { threadID } = event;
	const senderID = event.senderID || event.author || event.userID;

	// E2EE JIDs contain "@" (e.g. "61568577897207:69@msgr").
	// Use the numeric prefix as the DB key so we stay compatible with the
	// existing MongoDB/SQLite schema (which expects numeric thread/user IDs).
	const isE2EEThread = typeof threadID === "string" && threadID.includes("@");
	const isE2EESender = typeof senderID === "string" && senderID.includes("@");
	const dbThreadID = isE2EEThread ? threadID.split("@")[0].split(":")[0] : threadID;
	const dbSenderID = isE2EESender ? senderID.split("@")[0].split(":")[0] : senderID;

	// Skip DB check for E2EE lifecycle-only events that carry no real threadID
	if (event.isE2EE && !event.senderID && !event.userID) return;

	// ⚠️ FIX (E2EE group "prefix only" / everything silently dead after 1st msg):
	// threadsData.create(id) with NO 2nd arg falls back to a real GraphQL
	// api.getThreadInfo(id) call. For E2EE DMs the numeric JID prefix happens to
	// equal the other person's real Facebook UID, so getThreadInfo() "accidentally"
	// resolves fine — but an E2EE GROUP's numeric JID prefix is a Labyrinth-only
	// identifier that GraphQL has never heard of, so getThreadInfo() throws. That
	// throw gets caught below, the group's dbThreadID is permanently blacklisted
	// into global.temp.createThreadDataError, and EVERY message afterwards
	// (including bare-prefix ones) hits the early-return guard a few lines up on
	// all future calls — so the bot goes silent for that group until restart.
	// Fix: for E2EE threads, build a minimal local threadInfo ourselves so
	// create_() never touches the network/GraphQL at all.
	const e2eeThreadInfo = isE2EEThread ? {
		threadName: null, userInfo: [], adminIDs: [], nicknames: {},
		threadTheme: null, emoji: null, imageSrc: null, approvalMode: false,
		threadType: event.isGroup ? 2 : 1
	} : undefined;

	// ———————————— CHECK THREAD DATA ———————————— //
	if (dbThreadID) {
		try {
			if (global.temp.createThreadDataError.includes(dbThreadID)
				|| global.temp.createThreadDataError.includes(threadID))
				return;

			const findInCreatingThreadData = creatingThreadData.find(
				t => t.threadID == dbThreadID || t.threadID == threadID
			);
			if (!findInCreatingThreadData) {
				if (global.db.allThreadData.some(
					t => t.threadID == dbThreadID || t.threadID == threadID
				))
					return;

				const threadData = await threadsData.create(dbThreadID, e2eeThreadInfo);
				log.info("DATABASE", `New Thread: ${threadID} | ${threadData.threadName} | ${config.database.type}`);
			}
			else {
				await findInCreatingThreadData.promise;
			}
		}
		catch (err) {
			if (err.name != "DATA_ALREADY_EXISTS") {
				global.temp.createThreadDataError.push(dbThreadID);
				log.err("DATABASE", getText("handlerCheckData", "cantCreateThread", threadID), err);
			}
		}
	}


	// ————————————— CHECK USER DATA ————————————— //
	if (dbSenderID) {
		try {
			const findInCreatingUserData = creatingUserData.find(
				u => u.userID == dbSenderID || u.userID == senderID
			);
			if (!findInCreatingUserData) {
				if (db.allUserData.some(
					u => u.userID == dbSenderID || u.userID == senderID
				))
					return;

				const userData = await usersData.create(dbSenderID);
				log.info("DATABASE", `New User: ${senderID} | ${userData.name} | ${config.database.type}`);
			}
			else {
				await findInCreatingUserData.promise;
			}
		}
		catch (err) {
			if (err.name != "DATA_ALREADY_EXISTS")
				log.err("DATABASE", getText("handlerCheckData", "cantCreateUser", senderID), err);
		}
	}
};