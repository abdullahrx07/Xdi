const axios = require("axios");

module.exports = {
  config: {
    name: "rbg",
    version: "1.3",
    author: "Azadx69x",
    countDown: 5,
    role: 0,
    shortDescription: "Remove background from image",
    longDescription: "Remove background by URL or replying to an image",
    category: "image",
    guide: {
      en: "{p}rbg <image_url>\nOR\nReply image + {p}rbg"
    }
  },

  onStart: async function ({ api, event, args }) {
    try {
      let imageUrl;
      
      if (
        event.messageReply?.attachments?.length > 0 &&
        event.messageReply.attachments[0].type === "photo"
      ) {
        imageUrl = event.messageReply.attachments[0].url;
      }
      
      if (!imageUrl && args[0]) {
        imageUrl = args[0];
      }

      if (!imageUrl) {
        return api.sendMessage(
          "❌ Reply to an image or give image URL",
          event.threadID,
          event.messageID
        );
      }
      
      const loadingMsg = await api.sendMessage(
        "⏳ Processing image, please wait...",
        event.threadID
      );

      const apiUrl =
        "https://azadx69x-all-apis-top.vercel.app/api/rbg?url=" +
        encodeURIComponent(imageUrl);
      
      const res = await axios.get(apiUrl, {
        responseType: "stream"
      });
      
      await api.sendMessage(
        {
          body: "✅ Background removed",
          attachment: res.data
        },
        event.threadID,
        event.messageID
      );
      
      api.unsendMessage(loadingMsg.messageID);

    } catch (err) {
      console.error(err);
      api.sendMessage(
        "❌ Image process failed!",
        event.threadID,
        event.messageID
      );
    }
  }
};
