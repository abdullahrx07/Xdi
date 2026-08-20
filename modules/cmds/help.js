const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "help",
  version: "4.5.0",
  author: "rX",
  countDown: 5,
  role: 0,
  category: "system",
  guide: {
    en: "{pn} [command name | page number]\nReply with a page number to jump to that page.",
  },
  description: "Paged help menu 2 pages + random GIF attached both pages, auto unsend 30s, reply-to-navigate",
};

const UNSEND_DELAY = 30000;

// ---------- Shared builder so onStart and onReply render identically ----------
async function buildHelpPage({ api, page }) {
  const commandDir = __dirname;
  const files = fs.readdirSync(commandDir).filter(f => f.endsWith(".js"));

  let commands = [];
  for (let file of files) {
    try {
      const raw = require(path.join(commandDir, file));
      if (!raw) continue;

      const cfg = raw.config || {};
      if (!cfg.name) continue;

      const type = typeof raw.onStart === "function"
        ? "GoatBot"
        : typeof raw.run === "function"
          ? "Mirai"
          : "Unknown";

      commands.push({
        name: cfg.name,
        aliases: cfg.aliases || [],
        category: cfg.category || cfg.commandCategory || "Other",
        description: (
          typeof cfg.description === "string"
            ? cfg.description
            : cfg.description?.en || cfg.description?.bn || "No description available."
        ),
        author: cfg.author || cfg.credits || "Unknown",
        version: cfg.version || "N/A",
        usages: (
          typeof cfg.guide === "string"
            ? cfg.guide
            : cfg.guide?.en || cfg.usages || "No usage info"
        ),
        cooldowns: cfg.countDown || cfg.cooldowns || "N/A",
        type,
      });
    } catch {}
  }

  const commandsPerPage = Math.ceil(commands.length / 2);
  const totalPages = 2;
  page = Math.min(Math.max(page, 1), totalPages);
  const start = (page - 1) * commandsPerPage;
  const end = start + commandsPerPage;
  const pageCommands = commands.slice(start, end);

  const categories = {};
  for (let cmd of pageCommands) {
    if (!categories[cmd.category]) categories[cmd.category] = [];
    categories[cmd.category].push({ name: cmd.name, type: cmd.type });
  }

  let msg = `╭──❏ 𝐀𝐮𝐭𝐨 𝐃𝐞𝐭𝐞𝐜𝐭 𝐇𝐞𝐥𝐩 - Page ${page} ❏──╮\n`;
  msg += `│ ✧ Total Commands: ${commands.length}\n`;
  msg += `│ ✧ Prefix: ${global.GoatBot.config.prefix}\n`;
  msg += `╰─────────────────────⭓\n\n`;

  for (let [cat, cmds] of Object.entries(categories)) {
    msg += `╭─‣ 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆 : ${cat}\n`;
    for (let i = 0; i < cmds.length; i += 2) {
      const a = cmds[i];
      const b = cmds[i + 1];
      const tagA = a.type === "GoatBot" ? "🐐" : "✨";
      const tagB = b ? (b.type === "GoatBot" ? "🐐" : "✨") : null;
      const row = [`${tagA}「${a.name}」`];
      if (b) row.push(`✘ ${tagB}「${b.name}」`);
      msg += `├‣ ${row.join(" ")}\n`;
    }
    msg += `╰────────────◊\n\n`;
  }

  msg += `🐐 GoatBot  ✨ Mirai\n`;
  msg += `⭔ Type ${global.GoatBot.config.prefix}help [command] to see details\n`;
  msg += `⭔ Reply with a page number (1-${totalPages}) to switch pages\n`;
  msg += `╭─[⋆˚𝐓𝐇𝐀𝐍𝐊𝐒 𝐅𝐎𝐑 𝐔𝐒𝐈𝐍𝐆⋆˚]\n`;
  msg += `╰‣ 𝐀𝐝𝐦𝐢𝐧 : 𝐫𝐗\n`;
  msg += `╰‣ 𝐑𝐢𝐩𝐨𝐫𝐭 : !callad (yourmsg)\n`;

  let attachment = null;
  try {
    const cache = path.join(__dirname, "noprefix");
    if (fs.existsSync(cache)) {
      const names = ["mari1"];
      const exts = [".gif", ".mp4", ".webp", ".png", ".jpg"];
      let found = [];
      fs.readdirSync(cache).forEach(file => {
        const lower = file.toLowerCase();
        if (names.some(n => lower.startsWith(n)) && exts.includes(path.extname(lower)))
          found.push(path.join(cache, file));
      });
      if (found.length > 0)
        attachment = fs.createReadStream(found[Math.floor(Math.random() * found.length)]);
    }
  } catch {
    attachment = null;
  }

  return { msg, attachment, page, totalPages };
}

module.exports.onStart = async function ({ api, event, args }) {
  try {
    const commandDir = __dirname;
    const files = fs.readdirSync(commandDir).filter(f => f.endsWith(".js"));
    let commands = [];
    for (let file of files) {
      try {
        const raw = require(path.join(commandDir, file));
        if (!raw) continue;
        const cfg = raw.config || {};
        if (!cfg.name) continue;
        commands.push(cfg.name);
      } catch {}
    }

    // ---------- Command detail ----------
    if (args[0] && isNaN(args[0])) {
      const find = args[0].toLowerCase();
      const commandDir2 = __dirname;
      const files2 = fs.readdirSync(commandDir2).filter(f => f.endsWith(".js"));
      let full = [];
      for (let file of files2) {
        try {
          const raw = require(path.join(commandDir2, file));
          if (!raw) continue;
          const cfg = raw.config || {};
          if (!cfg.name) continue;
          const type = typeof raw.onStart === "function" ? "GoatBot" : typeof raw.run === "function" ? "Mirai" : "Unknown";
          full.push({
            name: cfg.name,
            aliases: cfg.aliases || [],
            category: cfg.category || cfg.commandCategory || "Other",
            description: typeof cfg.description === "string" ? cfg.description : cfg.description?.en || cfg.description?.bn || "No description available.",
            author: cfg.author || cfg.credits || "Unknown",
            version: cfg.version || "N/A",
            usages: typeof cfg.guide === "string" ? cfg.guide : cfg.guide?.en || cfg.usages || "No usage info",
            cooldowns: cfg.countDown || cfg.cooldowns || "N/A",
            type,
          });
        } catch {}
      }
      const cmd = full.find(c => c.name.toLowerCase() === find || (c.aliases && c.aliases.map(a => a.toLowerCase()).includes(find)));
      if (!cmd)
        return api.sendMessage(`❌ Command "${find}" not found.`, event.threadID, event.messageID);

      let msg = `╭──❏ 𝐂𝐌𝐃 𝐈𝐍𝐅𝐎 ❏──╮\n`;
      msg += `│ ✧ Name: ${cmd.name}\n`;
      if (cmd.aliases.length > 0) msg += `│ ✧ Aliases: ${cmd.aliases.join(", ")}\n`;
      msg += `│ ✧ Type: ${cmd.type}\n`;
      msg += `│ ✧ Category: ${cmd.category}\n`;
      msg += `│ ✧ Version: ${cmd.version}\n`;
      msg += `│ ✧ Author: ${cmd.author}\n`;
      msg += `│ ✧ Cooldowns: ${cmd.cooldowns}s\n`;
      msg += `╰─────────────────────⭓\n`;
      msg += `📘 Description: ${cmd.description}\n`;
      msg += `📗 Usage: ${global.GoatBot.config.prefix}${cmd.name} ${cmd.usages}`;

      return api.sendMessage(msg, event.threadID, (err, info) => {
        if (!err) setTimeout(() => api.unsendMessage(info.messageID), UNSEND_DELAY);
      }, event.messageID);
    }

    // ---------- Paged view ----------
    const page = parseInt(args[0]) || 1;
    const { msg, attachment } = await buildHelpPage({ api, page });
    const payload = attachment ? { body: msg, attachment } : { body: msg };

    api.sendMessage(payload, event.threadID, (err, info) => {
      if (err) return;
      setTimeout(() => { try { api.unsendMessage(info.messageID); } catch {} }, UNSEND_DELAY);

      // register reply-to-navigate
      global.GoatBot.onReply.push({
        commandName: this.config.name,
        messageID: info.messageID,
        author: event.senderID,
      });
    }, event.messageID);

  } catch (err) {
    api.sendMessage("❌ Error: " + err.message, event.threadID, event.messageID);
  }
};

module.exports.onReply = async function ({ api, event, Reply }) {
  try {
    if (event.senderID !== Reply.author) return;

    const page = parseInt(event.body?.trim());
    if (isNaN(page)) return;

    const { msg, attachment } = await buildHelpPage({ api, page });
    const payload = attachment ? { body: msg, attachment } : { body: msg };

    api.sendMessage(payload, event.threadID, (err, info) => {
      if (err) return;
      setTimeout(() => { try { api.unsendMessage(info.messageID); } catch {} }, UNSEND_DELAY);

      // remove old reply hook, register the new page's message for further navigation
      global.GoatBot.onReply = global.GoatBot.onReply.filter(r => r.messageID !== Reply.messageID);
      global.GoatBot.onReply.push({
        commandName: this.config.name,
        messageID: info.messageID,
        author: event.senderID,
      });
    }, event.messageID);
  } catch (err) {
    api.sendMessage("❌ Error: " + err.message, event.threadID, event.messageID);
  }
};
