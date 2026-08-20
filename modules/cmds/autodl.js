const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const API_BASE_URL = "https://noobs-api-sable.vercel.app/";

async function alldown(url) {
	try {
		const response = await axios.get(`${API_BASE_URL}alldown`, { params: { url } });
		return response.data;
	} catch (e) {
		console.error("[autodl] Alldown API error:", e);
		return { status: false, msg: "Alldown API error" };
	}
}

module.exports = {
	config: {
		name: "autodl",
		version: "2.1.2",
		author: "rX Abdullah",
		countDown: 2,
		role: 0,
		shortDescription: "Auto detect any link and download directly",
		category: "utility",
		guide: ""
	},

	onStart: async function () {},

	// -------------------------
	// 🔥 Auto Detect Link and Download Directly
	// -------------------------
	onChat: async function ({ api, event }) {
		let filePath = null;
		let loadingInfo = null;
		try {
			const body = event.body ? event.body.trim() : "";
			if (!body) return;

			// Robust regex supporting any subdomain prefix
			const linkMatch = body.match(
				/(https?:\/\/(?:[a-zA-Z0-9_-]+\.)*(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch)[^\s]*)/i
			);
			if (!linkMatch) return;

			const content = linkMatch[1];
			console.log("[autodl] link detected:", content);

			// Detect Platform
			let site = "Unknown";
			if (content.includes("youtube.com") || content.includes("youtu.be")) site = "YouTube";
			else if (content.includes("tiktok.com")) site = "TikTok";
			else if (content.includes("instagram.com")) site = "Instagram";
			else if (content.includes("facebook.com") || content.includes("fb.watch")) site = "Facebook";

			// Show downloading state immediately
			loadingInfo = await api.sendMessage(`⬇️ Auto downloading from ${site}...`, event.threadID);

			// Download using direct API call
			const data = await alldown(content);
			if (!data || data.status === false || !data.url) {
				if (loadingInfo && loadingInfo.messageID) {
					api.unsendMessage(loadingInfo.messageID);
				}
				return api.sendMessage(`❌ Failed to fetch download link for ${site}!`, event.threadID);
			}

			// Support data.t and data.title
			const title = data.t || data.title || "video";
			const dlUrl = data.url;

			// Download buffer
			const bufferResponse = await axios.get(dlUrl, { responseType: "arraybuffer" });
			const buffer = bufferResponse.data;
			const safeTitle = title.replace(/[^\w\s]/gi, "_");

			const cacheDir = path.join(__dirname, "cache");
			fs.ensureDirSync(cacheDir);
			filePath = path.join(cacheDir, `${safeTitle}_${Date.now()}.mp4`);
			fs.writeFileSync(filePath, buffer);

			// Send downloaded file
			api.sendMessage(
				{
					body: `🎀 Download Complete!\n📍 Platform: ${site}\n🎬 Title: ${title}`,
					attachment: fs.createReadStream(filePath)
				},
				event.threadID,
				(err) => {
					// Always cleanup file when done sending
					try {
						if (filePath && fs.existsSync(filePath)) {
							fs.unlinkSync(filePath);
						}
					} catch (cleanupErr) {
						console.error("[autodl] Cleanup error in callback:", cleanupErr);
					}
					// Remove the "Downloading" message
					if (loadingInfo && loadingInfo.messageID) {
						api.unsendMessage(loadingInfo.messageID);
					}
				}
			);

		} catch (e) {
			console.log("[autodl] direct download error:", e);
			try {
				if (filePath && fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			} catch (cleanupErr) {
				console.error("[autodl] Cleanup error in catch:", cleanupErr);
			}
			if (loadingInfo && loadingInfo.messageID) {
				api.unsendMessage(loadingInfo.messageID);
			}
			api.sendMessage("❌ Download failed!", event.threadID);
		}
	}
};
