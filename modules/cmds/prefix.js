const fs = require("fs");
const path = require("path");

const userPrefixPath = path.join(__dirname, "noprefix", "userPrefix.json");

function loadUserPrefix() {
  try {
    if (!fs.existsSync(userPrefixPath)) {
      fs.mkdirSync(path.dirname(userPrefixPath), { recursive: true });
      fs.writeFileSync(userPrefixPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(userPrefixPath, "utf-8"));
  } catch (err) {
    console.error("[prefix.js - loadUserPrefix]", err);
    return {};
  }
}

const TRIGGER_WORDS = ["prefix", "prefix bot là gì", "quên prefix r", "dùng sao"];
const GIFS = ["mari1.gif"];

async function showPrefixStatus({ event, message, threadsData }) {
  const { threadID, senderID } = event;
  let statusText = "";
  try {
    // System + group prefix (GoatBot's own thread-data store, E2EE-safe)
    const systemPrefix = global.GoatBot.config.prefix;
    let groupPrefix = systemPrefix;
    try {
      groupPrefix = (await threadsData.get(threadID, "data.prefix")) || systemPrefix;
    } catch (err) {
      console.error("[prefix.js - get thread prefix]", err);
    }

    // Own (personal) prefix, if this user has one set
    const userPrefixData = loadUserPrefix();
    const ownPrefix = userPrefixData[String(senderID)];

    statusText = `╭─‣ вσт ѕтαтυѕ
├‣ ѕуѕтєм : ${systemPrefix}
├‣ ɢʀᴏᴜᴘ : ${groupPrefix}`;

    if (ownPrefix) {
      statusText += `\n├‣ уσυʀ σwɴ : ${ownPrefix}`;
    }

    statusText += `
├‣ ғʙ : ʀxαвᴅυℓℓαн007
╰────────────◊`;

    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];
    const gifPath = path.join(__dirname, "noprefix", randomGif);

    if (fs.existsSync(gifPath)) {
      return message.reply({
        body: statusText,
        attachment: fs.createReadStream(gifPath)
      });
    } else {
      return message.reply(statusText);
    }
  } catch (err) {
    console.error("[prefix.js]", err);
    return message.reply(statusText || "❌ Error showing prefix status.");
  }
}

module.exports = {
  config: {
    name: "prefix",
    version: "3.0.0",
    author: "rX",
    countDown: 5,
    role: 0,
    description: "Show bot prefix with random gif",
    category: "system",
    guide: {
      en: "   {p}prefix: show system/group/your own prefix"
    }
  },

  // Invoked via "{p}prefix" — already gated by GoatBot's command dispatch,
  // no need to re-check trigger words here.
  onStart: async function (ctx) {
    return showPrefixStatus(ctx);
  },

  // Invoked on bare trigger words typed without the command prefix
  // (e.g. just "prefix", or the Vietnamese casual phrases below).
  onChat: async function (ctx) {
    const { event } = ctx;
    if (!event.body) return;

    const lowerBody = event.body.trim().toLowerCase();
    if (!TRIGGER_WORDS.includes(lowerBody)) return;

    return showPrefixStatus(ctx);
  }
};
