/**
 * e2ee.js — ported from Mari-v4's modules/commands/e2ee.js
 *
 * Purpose: interactive E2EE (Labyrinth encrypted chat) bridge test + an
 * "info" explainer for how the bot tells a normal inbox DM apart from an
 * E2EE inbox DM apart from an E2EE group.
 *
 * Detection logic (identical to Mari-v4's handleCommand.js / e2ee.js):
 *   - isE2EEThread : threadID is a JID string, i.e. it contains "@".
 *                    Normal (non-E2EE) threads are plain numeric IDs.
 *   - isE2EEDM     : isE2EEThread && !event.isGroup — by the time a
 *                    command runs, event.isGroup has already been
 *                    corrected against the DB (see shared.js buildContext,
 *                    "resolvedIsGroup"), so this is reliable even though
 *                    the raw MQTT guess for a brand-new E2EE JID can't
 *                    always tell a DM from a group on its own.
 *   - normal inbox : senderID === threadID (Messenger's own convention
 *                    for 1-to-1 threads — not a JID, no "@").
 *
 * Gating: this project already has a config-level inbox switch —
 * global.GoatBot.config.antiInbox (toggled via the `security` command,
 * {pn}security antiinbox on/off) — and includes/listen.js already blocks
 * *all* non-group traffic (normal DM + E2EE DM) at the event level when
 * antiInbox is true. That's the equivalent of Mari-v4's `allowInbox`
 * flag, just inverted (antiInbox: true == allowInbox: false) and
 * enforced earlier in the pipeline. So this command does NOT introduce a
 * second config key — it reads the same global.GoatBot.config.antiInbox
 * that security.js already writes, and adds a silent isE2EEDM-specific
 * check as defense-in-depth for anyone who calls the command directly.
 */

module.exports = {
	config: {
		name: "e2ee",
		version: "1.0.0",
		author: "rX",
		countDown: 5,
		role: 0,
		description: {
			vi: "Kiểm tra cầu nối E2EE (mã hóa đầu cuối) và xem cách bot phân biệt inbox thường / inbox E2EE.",
			en: "Test the E2EE (end-to-end encrypted) bridge and see how the bot tells normal inbox apart from E2EE inbox."
		},
		category: "system",
		guide: {
			vi:
`   {pn}: chạy bài test tương tác (chỉ hoạt động trong đoạn chat E2EE)
   {pn} info: giải thích cách bot nhận diện inbox thường / E2EE
   {pn} status: xem trạng thái E2EE + Anti-Inbox hiện tại
   Dùng {pn}security e2ee/antiinbox on|off để bật/tắt (chỉ bot admin).`,
			en:
`   {pn}: run the interactive bridge test (only works inside E2EE chats)
   {pn} info: explain how the bot detects normal inbox vs E2EE inbox
   {pn} status: show current E2EE + Anti-Inbox state
   Use {pn}security e2ee/antiinbox on|off to toggle (bot admin only).`
		}
	},

	langs: {
		vi: {
			testMsg: "🔒 Thử nghiệm E2EE\n━━━━━━━━━━━━━━━━\nTin nhắn của bạn đã được mã hóa đầu cuối.\n\nPhản hồi bằng số:\n1️⃣  1 — Thử nghiệm Ping\n2️⃣  2 — Thông tin luồng chat",
			reply1: "✅ Pong! Cầu nối E2EE đang hoạt động hoàn hảo.",
			reply2: "📋 Thông tin luồng chat E2EE\n━━━━━━━━━━━━━━━━\n• Thread: %1\n• Mã hóa: ✅ Có\n• Giao thức: Labyrinth\n• Cầu nối: Hoạt động",
			replyOther: "❓ Tùy chọn không xác định. Vui lòng phản hồi bằng 1 hoặc 2.",
			e2eeDisabled: "⚠️ Tính năng E2EE hiện đang bị tắt trong config.json (e2ee.enable). Dùng {pn}security e2ee on để bật (cần khởi động lại bot).",
			notE2EE: "⚠️ Lệnh này chỉ hoạt động trong các cuộc trò chuyện mã hóa đầu cuối (E2EE).",
			statusText: "🔐 E2EE: %1\n📥 Anti-Inbox: %2",
			groupExplainer: "💡 Cách bot phân biệt các loại inbox:\n1️⃣ Inbox thường (DM): senderID == threadID (không có \"@\").\n2️⃣ E2EE inbox (DM): threadID là JID (chứa \"@\") và event.isGroup = false.\n3️⃣ E2EE nhóm: threadID là JID (chứa \"@\") nhưng event.isGroup = true — KHÔNG bị chặn bởi Anti-Inbox.\n\nKhi Anti-Inbox (antiInbox) đang BẬT, cả (1) và (2) đều bị bot bỏ qua hoàn toàn — chỉ (3) và các nhóm thường vẫn hoạt động."
		},
		en: {
			testMsg: "🔒 E2EE Test\n━━━━━━━━━━━━━━━━\nYour message is end-to-end encrypted.\n\nReply with a number:\n1️⃣  1 — Ping test\n2️⃣  2 — Thread info",
			reply1: "✅ Pong! E2EE bridge is working perfectly.",
			reply2: "📋 E2EE Thread Info\n━━━━━━━━━━━━━━━━\n• Thread: %1\n• Encrypted: ✅ Yes\n• Protocol: Labyrinth\n• Bridge: Active",
			replyOther: "❓ Unknown option. Reply with 1 or 2.",
			e2eeDisabled: "⚠️ E2EE is currently disabled in config.json (e2ee.enable). Use {pn}security e2ee on to enable it (bot restart required).",
			notE2EE: "⚠️ This command only works in E2EE (end-to-end encrypted) chats.",
			statusText: "🔐 E2EE: %1\n📥 Anti-Inbox: %2",
			groupExplainer: "💡 How the bot tells inbox types apart:\n1️⃣ Normal inbox (DM): senderID == threadID (no \"@\").\n2️⃣ E2EE inbox (DM): threadID is a JID (contains \"@\") and event.isGroup = false.\n3️⃣ E2EE group: threadID is a JID (contains \"@\") but event.isGroup = true — NEVER blocked by Anti-Inbox.\n\nWhen Anti-Inbox is ON, both (1) and (2) are silently ignored by the bot — only (3) and normal groups keep working."
		}
	},

	onStart: async function ({ api, args, event, message, getLang }) {
		const { threadID, messageID, senderID } = event;
		const sub = (args[0] || "").toLowerCase();

		if (sub === "info") {
			return message.reply(getLang("groupExplainer"));
		}

		if (sub === "status") {
			const config = global.GoatBot.config;
			const e2eeState = config.e2ee?.enable === true ? "ON ✅" : "OFF ❌";
			const antiInboxState = config.antiInbox === true ? "ON ✅ (inbox blocked)" : "OFF ❌ (inbox allowed)";
			return message.reply(getLang("statusText", e2eeState, antiInboxState));
		}

		// ── Interactive bridge test ──────────────────────────────────────────
		const e2eeEnabled = global.GoatBot.config.e2ee?.enable === true;
		if (!e2eeEnabled) return message.reply(getLang("e2eeDisabled"));

		// A JID threadID (contains "@") means an E2EE (Labyrinth) chat —
		// normal Facebook thread IDs are plain numeric strings.
		const isE2EEThread = typeof threadID === "string" && threadID.includes("@");
		if (!isE2EEThread) return message.reply(getLang("notE2EE"));

		// event.isGroup here is already the DB-resolved value (buildContext
		// in shared.js corrects it against threadData before any command
		// runs), so this reliably tells an E2EE 1-1 DM apart from an E2EE
		// group even though the raw MQTT guess alone can't.
		const isE2EEDM = isE2EEThread && !event.isGroup;
		if (isE2EEDM && global.GoatBot.config.antiInbox === true) {
			return; // Anti-Inbox is ON → silently ignore E2EE inbox, same as normal inbox
		}

		await api.setMessageReaction("🔒", messageID, () => {}, true).catch(() => {});

		try {
			await api.sendTypingIndicator(true, threadID, () => {}).catch(() => {});
			await new Promise(resolve => setTimeout(resolve, 5000));
			await api.sendTypingIndicator(false, threadID, () => {}).catch(() => {});
		} catch (_) {
			await new Promise(resolve => setTimeout(resolve, 5000));
		}

		return api.sendMessage(getLang("testMsg"), threadID, (err, info) => {
			if (info && info.messageID) {
				global.GoatBot.onReply.set(info.messageID, {
					commandName: "e2ee",
					messageID: info.messageID,
					author: senderID,
					threadID
				});
			}
		}, messageID);
	},

	onReply: async function ({ api, event, Reply, getLang }) {
		if (String(event.senderID) !== String(Reply.author)) return;
		Reply.delete && Reply.delete();

		const choice = (event.body || "").trim();
		const { threadID, messageID } = event;

		if (choice === "1") return api.sendMessage(getLang("reply1"), threadID, messageID);
		if (choice === "2") return api.sendMessage(getLang("reply2", threadID), threadID, messageID);
		return api.sendMessage(getLang("replyOther"), threadID, messageID);
	}
};
