const axios = require("axios");
const fs = require("fs");
const path = require("path");

const AMV_API = "https://azadx69x-all-apis-top.vercel.app/api/amv";
const DOWNLOAD_API = "https://azadx69x-ytb-api.vercel.app/download?url=";

const threadUsedVideos = new Map();

module.exports = {
  config: {
    name: "anisearch",
    aliases: ["amv"],
    version: "0.0.7",
    author: "Azadx69x",
    role: 0,
    category: "anime",
    usePrefix: false,
    shortDescription: "random anime",
    longDescription: "Fetch and random anime"
  },

  onStart: async function({ message, args, api, event }) {
    return this.run({ message, args, api, event });
  },

  onChat: async function({ message, event, api }) {
    const body = (event.body || "").toLowerCase().trim();
    const prefixes = ["amv"];
    
    const hasPrefix = prefixes.some(p => body.startsWith(p));
    if (!hasPrefix) return;

    let args = [];
    for (const prefix of prefixes) {
      if (body.startsWith(prefix)) {
        args = body.slice(prefix.length).trim().split(" ").filter(Boolean);
        break;
      }
    }
    
    return this.run({ message, args, api, event });
  },

  run: async function({ message, args, api, event }) {
    const threadID = event.threadID;
    const messageID = event.messageID;

    try {
      const searchQuery = args.join(" ").trim() || "anime amv short";
      
      api.setMessageReaction("🎌", messageID, threadID, () => {}, true);
      
      if (!threadUsedVideos.has(threadID)) {
        threadUsedVideos.set(threadID, new Set());
      }
      const usedVideos = threadUsedVideos.get(threadID);
      
      let videoData = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const apiUrl = `${AMV_API}?search=${encodeURIComponent(searchQuery)}`;
        const { data } = await axios.get(apiUrl, { timeout: 15000 });

        if (!data?.success || !data.videoId) {
          break;
        }

        if (!usedVideos.has(data.videoId)) {
          videoData = data;
          usedVideos.add(data.videoId);
          break;
        }

        attempts++;
        await new Promise(r => setTimeout(r, 500));
      }

      if (!videoData) {
        api.setMessageReaction("❌", messageID, threadID, () => {}, true);
        return message.reply("❌ No video found! Try again.");
      }
      
      if (usedVideos.size > 30) {
        const iterator = usedVideos.values();
        usedVideos.delete(iterator.next().value);
      }
      
      const youtubeUrl = videoData.youtube;
      const fileName = `amv_${videoData.videoId}_${Date.now()}.mp4`;
      const filePath = path.join(__dirname, fileName);

      try {
        const downloadResp = await axios({
          method: "GET",
          url: `${DOWNLOAD_API}${encodeURIComponent(youtubeUrl)}`,
          responseType: "stream",
          timeout: 60000
        });
        
        const writer = fs.createWriteStream(filePath);
        downloadResp.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
        
        const stats = fs.statSync(filePath);
        if (stats.size < 500 * 1024) {
          throw new Error("File too small");
        }
        
        await api.sendMessage(
          {
            attachment: fs.createReadStream(filePath)
          },
          threadID,
          () => {
            safeDelete(filePath);
          },
          messageID
        );
        
        api.setMessageReaction("✔️", messageID, threadID, () => {}, true);

      } catch (downloadErr) {
        console.error("Download failed:", downloadErr);
        
        await api.sendMessage(
          youtubeUrl,
          threadID,
          null,
          messageID
        );
        
        safeDelete(filePath);
        api.setMessageReaction("⚠️", messageID, threadID, () => {}, true);
      }

    } catch (err) {
      console.error("[anisearch] Error:", err);
      api.setMessageReaction("❌", messageID, threadID, () => {}, true);
      message.reply("❌ Failed to fetch Anime. API error.");
    }
  }
};

function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.log("Delete error:", e.message);
  }
}
