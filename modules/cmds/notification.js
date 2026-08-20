const { getStreamsFromAttachment } = global.utils;

module.exports = {
	config: {
		name: "notification",
		aliases: ["notify"],
		version: "2.3",
		author: "NTKhang | Azadx69x",
		countDown: 5,
		role: 2,
		description: {
			en: "📢 Send announcement to all groups (Admin Bot Only)"
		},
		category: "admin",
		guide: {
			en: "{pn} <message>"
		},
		envConfig: {
			delayPerGroup: 300
		},
		adminBot: [
			"61557500431580"
		]
	},

	langs: {
		en: {
			missingMessage: "⚠️ Please enter the message you want to broadcast",
			sendingNotification: "📤 Starting broadcast to %1 groups...",
			sentNotification: "✅ Successfully sent to %1 groups",
			errorSendingNotification: "❌ Failed to send to %1 groups:\n%2",
			confirmBroadcast: "⚠️ You are about to send announcement to %1 groups.\nReply \"yes\" to confirm or \"no\" to cancel.",
			cancelled: "❌ Broadcast cancelled",
			processing: "⏳ Processing... Please wait",
			attachmentError: "❌ Failed to process attachments",
			accessDenied: "⛔ Access Denied - Admin Bot only command",
			noGroups: "❌ No groups found to broadcast",
			notAdmin: "⛔ You must be an admin in this group to use this command",
			botNotAdmin: "⚠️ Bot must be an admin in the group to broadcast",
			notAdminBot: "⛔ This command is restricted to specified admin bots only"
		}
	},

	onStart: async function ({ message, api, event, args, commandName, envCommands, threadsData, getLang }) {
		try {
			if (!(this.config.adminBot || []).includes(event.senderID)) {
				return message.reply(getLang("notAdminBot"));
			}

			if (!args[0]) return message.reply(getLang("missingMessage"));

			const botID = api.getCurrentUserID();
		  
			let allThreads = (await threadsData.getAll()).filter(
				t => t.isGroup && t.members.find(m => m.userID == botID)?.inGroup
			);

			if (allThreads.length === 0) return message.reply(getLang("noGroups"));
		  
			if (allThreads.length > 10) {
				const confirmation = await message.reply(getLang("confirmBroadcast", allThreads.length));
				global.GoatBot.onReply.set(confirmation.messageID, {
					commandName,
					messageID: confirmation.messageID,
					author: event.senderID,
					allThreads,
					args,
					attachments: event.attachments || [],
					messageReply: event.messageReply
				});
				return;
			}

			await executeBroadcast(message, api, event, args, allThreads, envCommands[commandName]?.delayPerGroup || 300, getLang);

		} catch (error) {
			console.error("Broadcast Error:", error);
			await message.reply(`❌ Error: ${error.message || "Unknown error occurred"}`);
		}
	},

	onReply: async function ({ message, Reply, event, api, getLang }) {
		try {
			if (event.senderID !== Reply.author) return;

			const { allThreads, args, attachments, messageReply } = Reply;

			if (event.body.toLowerCase() === "yes") {
				await message.reply(getLang("processing"));
				await executeBroadcast(message, api, event, args, allThreads, 300, getLang);
				global.GoatBot.onReply.delete(Reply.messageID);
			} else if (event.body.toLowerCase() === "no") {
				await message.reply(getLang("cancelled"));
				global.GoatBot.onReply.delete(Reply.messageID);
			}
		} catch (error) {
			console.error("Reply handler error:", error);
		}
	}
};

async function executeBroadcast(message, api, event, args, allThreads, delayPerGroup, getLang) {
	try {
		await message.reply(getLang("sendingNotification", allThreads.length));
	  
		let attachmentsStream = [];
		try {
			const allAttachments = [
				...(event.attachments || []),
				...(event.messageReply?.attachments || [])
			].filter(item => item && ["photo", "png", "animated_image", "video", "audio"].includes(item.type));

			if (allAttachments.length > 0) {
				attachmentsStream = await getStreamsFromAttachment(allAttachments);
			}
		} catch (err) {
			console.error("Attachment processing error:", err);
			await message.reply(getLang("attachmentError"));
		}

		const messageBody = args.join(" ");
		let sendSuccess = 0;
		const sendError = [];

		for (const [index, thread] of allThreads.entries()) {
			const threadID = thread.threadID;
			const groupName = thread.threadName || "Unknown Group";

			try {
				await api.sendMessage({
					body: `╔════════════════════╗\n        📢 𝗔𝗻𝗻𝗼𝘂𝗻𝗰𝗲𝗺𝗲𝗻𝘁\n╚════════════════════╝\n\n📁 Group: ${groupName}\n━━━━━━━━━━━━━━━━━━━━━\n\n${messageBody}\n\n━━━━━━━━━━━━━━━━━━━━━\n👤 From: Admin Team\n📅 ${new Date().toLocaleString()}\n⚠️ This is an automated announcement`,
					attachment: attachmentsStream.length > 0 ? attachmentsStream : []
				}, threadID);

				console.log(`✅ Sent to: ${groupName} (${threadID})`);
				sendSuccess++;

				if (index < allThreads.length - 1) await new Promise(r => setTimeout(r, delayPerGroup));

			} catch (error) {
				console.error(`❌ Failed to send to ${groupName} (${threadID}):`, error);
				sendError.push({ threadID, error: error.errorDescription || error.message || "Unknown error" });
			}
		}
	  
		let resultMsg = `📊 **Broadcast Report**\n━━━━━━━━━━━━━━━━━━━━━\n📤 Total Groups: ${allThreads.length}\n✅ Success: ${sendSuccess}\n❌ Failed: ${sendError.length}\n\n`;
		if (sendError.length > 0) {
			sendError.slice(0, 5).forEach((err, i) => {
				const groupName = allThreads.find(t => t.threadID === err.threadID)?.threadName || err.threadID;
				resultMsg += `${i + 1}. ${groupName}\n   ↳ ${err.error}\n`;
			});
			if (sendError.length > 5) resultMsg += `\n... and ${sendError.length - 5} more groups`;
		} else resultMsg += `✅ All announcements delivered successfully!`;

		resultMsg += `\n━━━━━━━━━━━━━━━━━━━━━\n⏱️ Completed: ${new Date().toLocaleTimeString()}`;
		await message.reply(resultMsg);

	} catch (error) {
		console.error("Broadcast execution error:", error);
		await message.reply(`❌ Broadcast failed: ${error.message}`);
	}
}
