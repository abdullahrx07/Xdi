const { db, utils, GoatBot } = global;
const { config } = GoatBot;
const { log, getText } = utils;
const { creatingThreadData, creatingUserData } = global.client.database;

// How long (ms) to skip retrying a thread after a failed creation, so one
// bad group doesn't get hammered with API calls on every single message —
// but also isn't blacklisted forever like before.
const THREAD_CREATE_RETRY_COOLDOWN_MS = 60 * 1000;

module.exports = async function (usersData, threadsData, event) {
	const { threadID } = event;
	const senderID = event.senderID || event.author || event.userID;

	// ———————————— CHECK THREAD DATA ———————————— //
	if (threadID) {
		try {
			const lastFailedAt = global.temp.createThreadDataError.get(threadID);
			if (lastFailedAt && (Date.now() - lastFailedAt) < THREAD_CREATE_RETRY_COOLDOWN_MS)
				return;

			const findInCreatingThreadData = creatingThreadData.find(t => t.threadID == threadID);
			if (!findInCreatingThreadData) {
				if (global.db.allThreadData.some(t => t.threadID == threadID)) {
					global.temp.createThreadDataError.delete(threadID);
					return;
				}

				// E2EE (Labyrinth) threadIDs are JIDs — api.getThreadInfo() can't
				// resolve those, so build a minimal fallback record instead of
				// letting threadsData.create() call the FB API and throw.
				// event.isGroup here is the E2EE bridge's best-effort guess (it's
				// corrected against the DB later, once known) — good enough to
				// avoid marking a brand-new E2EE group as a DM or vice versa.
				const isJidThreadID = typeof threadID === 'string' && threadID.includes('@');
				const fallbackThreadInfo = isJidThreadID ? {
					threadName: null,
					userInfo: [],
					adminIDs: [],
					nicknames: {},
					emoji: null,
					imageSrc: null,
					approvalMode: null,
					threadTheme: null,
					threadType: event.isGroup === true ? 2 : 1
				} : undefined;

				const threadData = await threadsData.create(threadID, fallbackThreadInfo);
				global.temp.createThreadDataError.delete(threadID);
				log.info("DATABASE", `New Thread: ${threadID} | ${threadData.threadName} | ${config.database.type}`);
			}
			else {
				await findInCreatingThreadData.promise;
				global.temp.createThreadDataError.delete(threadID);
			}
		}
		catch (err) {
			if (err.name != "DATA_ALREADY_EXISTS") {
				global.temp.createThreadDataError.set(threadID, Date.now());
				log.err("DATABASE", getText("handlerCheckData", "cantCreateThread", threadID), err.message || err);
			}
		}
	}


	// ————————————— CHECK USER DATA ————————————— //
	if (senderID) {
		try {
			const findInCreatingUserData = creatingUserData.find(u => u.userID == senderID);
			if (!findInCreatingUserData) {
				if (db.allUserData.some(u => u.userID == senderID))
					return;

				const userData = await usersData.create(senderID);
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
