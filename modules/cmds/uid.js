module.exports = {
  config: {
    name: "uid",
    version: "1.0.0",
    author: "rX",
    description: "show users iD",
    category: "utility",
    cooldowns: 5
  },

  onStart: async function({ api, event, message }) {
    let uid;

    if (event.type === "message_reply" && event.messageReply) {
      uid = event.messageReply.senderID;
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
      uid = Object.keys(event.mentions)[0];
    } else {
      uid = event.senderID;
    }
    
    if (event.isE2EE || (typeof event.threadID === "string" && event.threadID.includes("@"))) {
      return message.reply(`UID: ${uid}`);
    }

    try {
      await api.shareContact(uid, uid, event.threadID, event.messageID);
    } catch (error) {
      console.error("Error in UID command:", error);
      message.reply(`UID: ${uid}`);
    }
  }
};
