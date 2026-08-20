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

				const threadData = await threadsData.create(threadID);
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
