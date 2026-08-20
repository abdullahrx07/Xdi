module.exports = {
	config: {
		name: "inbox",
		version: "1.1.0",
		author: "rX",
		countDown: 5,
		role: 0,
		description: {
			vi: "Gửi tin nhắn trực tiếp đến hộp thư (inbox) của bạn.",
			en: "Sends a direct message to your inbox/DM."
		},
		category: "utility",
		guide: {
			vi: "   {pn} <tin nhắn>: Gửi tin nhắn đến hộp thư riêng của bạn (hỗ trợ E2EE).",
			en: "   {pn} <message>: Sends a message to your private inbox/DM (supports E2EE)."
		}
	},

	langs: {
		vi: {
			success: "✅ | Bot đã gửi một tin nhắn trực tiếp đến hộp thư của bạn! Vui lòng kiểm tra inbox (bao gồm cả tin nhắn chờ nếu chưa kết bạn).",
			groupSuccess: "📬 | Xong rồi nè! Mình vừa gửi một tin nhắn riêng đến hộp thư của bạn, nhớ kiểm tra inbox nhé (kể cả mục tin nhắn chờ nếu chưa từng trò chuyện với mình)! 💌",
			error: "❌ | Không thể gửi tin nhắn trực tiếp đến bạn. Vui lòng đảm bảo rằng bạn đã cho phép nhận tin nhắn từ người lạ hoặc đã từng trò chuyện với bot.",
			noMessage: "Xin chào! Bạn vừa dùng lệnh inbox nhưng không nhập nội dung nào. Chúc bạn một ngày tốt lành!",
			incomingMessage: "📩 | Bạn có một tin nhắn từ group [ %1 ]:\n\n%2",
			directMessage: "📥 | Tôi đã đến hộp thư của bạn rồi nè!\n\n%1"
		},
		en: {
			success: "✅ | Bot has sent a direct message to your inbox! Please check your DMs (including message requests if we are not connected).",
			groupSuccess: "📬 | All done! I've just sent you a private message in your inbox — go check your DMs (including message requests if we haven't chatted before)! 💌",
			error: "❌ | Failed to send a direct message to you. Please ensure you have allowed messages from strangers or have conversed with the bot before.",
			noMessage: "Hello! You used the inbox command without specifying a message. Have a wonderful day!",
			incomingMessage: "📩 | You have a new message forwarded from group [ %1 ]:\n\n%2",
			directMessage: "📥 | I've arrived in your inbox!\n\n%1"
		}
	},

	onStart: async function ({ api, args, message, event, getLang, threadsData }) {
		const { senderID, threadID, isGroup } = event;
		const text = args.join(" ");

		// Get group name if applicable
		let groupName = "Unknown Group";
		if (isGroup) {
			try {
				const threadInfo = await threadsData.get(threadID);
				groupName = threadInfo.threadName || groupName;
			} catch (_) {}
		}

		let sendText = "";
		if (text) {
			sendText = isGroup ? getLang("incomingMessage", groupName, text) : getLang("directMessage", text);
		} else {
			sendText = getLang("noMessage");
		}

		// Try E2EE-style JID first (uid@msgr), fallback to normal UID if it fails
		const e2eeTarget = `${senderID}@msgr`;

		const replyText = isGroup ? getLang("groupSuccess") : getLang("success");

		try {
			await api.sendMessage(sendText, e2eeTarget);
			return message.reply(replyText);
		} catch (e2eeErr) {
			console.error("E2EE send failed, falling back to normal UID:", e2eeErr);

			try {
				await api.sendMessage(sendText, senderID);
				return message.reply(replyText);
			} catch (normalErr) {
				console.error("Error in inbox command (normal send):", normalErr);
				return message.reply(getLang("error"));
			}
		}
	}
};
