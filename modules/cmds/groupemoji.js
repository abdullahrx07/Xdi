module.exports = {
  config: {
    name: "groupemoji",
    version: "1.0.0",
    author: "RS.RIFAT",
    countDown: 5,
    role: 0,
    category: "box",
    guide: {
      en: "{p}groupemoji [emoji]"
    }
  },

  onStart: async function ({ api, event, args }) {
    const emoji = args.join(" ");
    if (!emoji) {
      return api.sendMessage("You have not entered Emoji 💩💩", event.threadID, event.messageID);
    }

    api.changeThreadEmoji(emoji, event.threadID, (err) => {
      if (err) {
        return api.sendMessage("Something went wrong! ❌", event.threadID, event.messageID);
      }
      api.sendMessage(`🔨 The bot successfully changed Emoji to: ${emoji}`, event.threadID, event.messageID);
    });
  }
};
