/**
 *  GOATBOT V3
 *  CONTACT : rxabdullah617@gmail.com
 *  NOTES : THIS CODE MADE BY RX @RX_ABDULLAH007
 *  (GIVE CREDIT OTHERWISE EVERYONE FUCK YOU AT 300 KM SPEED)
 **/

const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handler/CheckData.js");

const getOnStartHandler = require(
	process.env.NODE_ENV === "development"
		? "./handler/onStart.dev.js"
		: "./handler/onStart.js"
);
const getOnReactionHandler = require(
	process.env.NODE_ENV === "development"
		? "./handler/onReaction.dev.js"
		: "./handler/onReaction.js"
);
const getOnReplyHandler = require(
	process.env.NODE_ENV === "development"
		? "./handler/onReply.dev.js"
		: "./handler/onReply.js"
);
const getOnEventHandler = require(
	process.env.NODE_ENV === "development"
		? "./handler/onEvent.dev.js"
		: "./handler/onEvent.js"
);

module.exports = (
	api,
	threadModel,
	userModel,
	dashBoardModel,
	globalModel,
	usersData,
	threadsData,
	dashBoardData,
	globalData
) => {
	const onStart = getOnStartHandler(
		api,
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		usersData,
		threadsData,
		dashBoardData,
		globalData
	);
	const onReaction = getOnReactionHandler(
		api,
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		usersData,
		threadsData,
		dashBoardData,
		globalData
	);
	const onReply = getOnReplyHandler(
		api,
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		usersData,
		threadsData,
		dashBoardData,
		globalData
	);
	const onEvent = getOnEventHandler(
		api,
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		usersData,
		threadsData,
		dashBoardData,
		globalData
	);

	return async function listener(event) {
		// Populate E2EE message map to robustly support unsend and reaction events
		if (event.isE2EE && event.messageID && event.threadID) {
			global._e2eeMessageMap = global._e2eeMessageMap || new Map();
			if (!global._e2eeMessageMap.has(String(event.messageID))) {
				global._e2eeMessageMap.set(String(event.messageID), String(event.threadID));
			}
		}

		// ── E2EE system status messages ──────────────────────────────────────
		if (event.isE2EE) {
			const tag = "\x1b[1m\x1b[45m\x1b[37m 🔐 E2EE \x1b[0m ";
			if (event.type === "e2ee_fully_ready") {
				console.log(tag + "\x1b[32m✅  E2EE connected and ready\x1b[0m");
				return;
			}
			if (event.type === "e2ee_ready" || event.type === "e2ee_connected") {
				return; // silently skip — e2ee_fully_ready is the final signal
			}
			if (event.type === "e2ee_disconnected") {
				console.log(tag + "\x1b[33m⚠️   E2EE disconnected — attempting reconnect...\x1b[0m");
				return;
			}
		}
		// ── end E2EE status ───────────────────────────────────────────────────

		// Anti Inbox
		// event.isGroup here is only the E2EE bridge's best-effort JID-suffix guess
		// (see e2ee.js _mapMsg) — for @msgr JIDs that guess can't tell a DM from a
		// group, so it defaults to "not group". Checking it directly here — before
		// buildContext() resolves the real thread_type — could wrongly let an E2EE
		// group through antiInbox, or wrongly block one. threadsData already knows
		// the true isGroup (set from getThreadInfo when the thread was created), so
		// prefer that when we already have it; only fall back to the guess for a
		// thread we've genuinely never seen before.
		if (global.GoatBot.config?.antiInbox) {
			const knownThreadData = event.threadID
				? global.db.allThreadData.find(t => t.threadID == event.threadID)
				: null;
			const resolvedIsGroupForAntiInbox = knownThreadData && typeof knownThreadData.isGroup === "boolean"
				? knownThreadData.isGroup
				: event.isGroup;
			if (!resolvedIsGroupForAntiInbox) return;
		}

		// Only these event types ever need onStart/onReply/onReaction/onEvent's
		// message-based context (thread/user DB lookups via buildContext).
		// typ / presence / read_receipt / message_unsend used to run all 4
		// heavy handlers unconditionally on every single keystroke-typing or
		// presence ping — wasted DB hits on high-traffic threads for event
		// types that were never going to trigger a command anyway. Skip that
		// work entirely here; nothing in this codebase currently implements
		// typ/presence/read_receipt, and message_unsend must never re-run a
		// command handler.
		const needsMessageHandlers = [
			"message", "message_reply", "e2ee_message",
			"event", "message_reaction", "e2ee_message_reaction"
		].includes(event.type);

		if (!needsMessageHandlers) return;

		const message = createFuncMessage(api, event);

		await handlerCheckDB(usersData, threadsData, event);

		const onStartObj = await onStart(event, message);
		const onReactionObj = await onReaction(event, message);
		const onReplyObj = await onReply(event, message);
		const onEventObj = await onEvent(event, message);

		const onStartFunc = onStartObj?.onStart;
		const onReactionFunc = onReactionObj?.onReaction;
		const onReplyFunc = onReplyObj?.onReply;

		const {
			onAnyEvent,
			onFirstChat,
			onChat,
			onEvent: onEventFunc,
			handlerEvent
		} = onEventObj || {};

		// Approval system
		if (global.GoatBot.config?.approval) {
			const approvedtid = await globalData.get("approved", "data", {});
			if (!Array.isArray(approvedtid.approved)) {
				approvedtid.approved = [];
				await globalData.set("approved", approvedtid, "data");
			}
			if (!approvedtid.approved.includes(event.threadID)) return;
		}

		onAnyEvent && onAnyEvent();

		switch (event.type) {
			case "message":
			case "message_reply":
			// ── E2EE (Facebook "Labyrinth" encrypted chats) ─────────────────────
			// The FCA e2ee bridge (includes/Fca/e2ee.js) normalizes incoming
			// encrypted-chat messages to the same shape as a normal "message"
			// event, but keeps a distinct `type` so callers can tell them apart:
			// "e2ee_message" for a fresh message, "message_reply" (shared with
			// the case above) when it's a reply. Since many/most 1-1 inbox
			// threads on Messenger are now E2EE by default, without this case
			// those DMs (and any E2EE group thread) never reached onChat/onStart/
			// onReply at all — commands and the inbox silently stopped working.
			case "e2ee_message":
				onFirstChat && onFirstChat();
				onChat && onChat();
				onStartFunc && onStartFunc();
				onReplyFunc && onReplyFunc();
				break;

			case "event":
				handlerEvent && handlerEvent();
				onEventFunc && onEventFunc();
				break;

			case "message_reaction":
			case "e2ee_message_reaction": {
				onReactionFunc && onReactionFunc();

				const botID = api.getCurrentUserID();
				const senderID = event.messageSenderID || event.senderID;
				const deleteEmojis = global.GoatBot.config?.reactBy?.delete || [];

				// Normalize emojis by stripping variation selectors to ensure robust matching across all devices/OS
				const cleanReaction = event.reaction ? event.reaction.replace(/\uFE0F/g, "") : "";
				const cleanDeleteEmojis = deleteEmojis.map(emoji => typeof emoji === "string" ? emoji.replace(/\uFE0F/g, "") : emoji);

				// ✅ ONLY: React → Unsend BOT message
				// Check if either the resolved senderID matches botID, or if under E2EE, the message is in _e2eeBotSentMsgIds.
				// Comparing via String conversions prevents type mismatches.
				const isBotMessage = String(senderID) === String(botID) || !!(
					event.isE2EE && global._e2eeBotSentMsgIds && global._e2eeBotSentMsgIds.has(String(event.messageID))
				);

				if (cleanDeleteEmojis.includes(cleanReaction) && isBotMessage) {
					console.log(
						"🗑️ Unsend bot message triggered:",
						event.messageID
					);
					api.unsendMessage(event.messageID).catch(err => {
						console.error("Failed to unsend message on reaction:", err);
					});
				}
				break;
			}

			default:
				break;
		}
	};
};
