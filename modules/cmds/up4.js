const fs = require("fs");
const pidusage = require("pidusage");
const si = require("systeminformation");

module.exports = {
  config: {
    name: "up4",
    aliases: ["4", "upt4"],
    version: "1.1",
    author: "Azadx69x",
    countDown: 5,
    role: 0,
    shortDescription: "system uptime",
    longDescription: "Fast boot → dashboard with CPU, owner, and GC count",
    category: "system"
  },

  onStart: async function ({ api, event }) {
    const delay = ms => new Promise(res => setTimeout(res, ms));

    const loadStages = [
      "[ █🗂️░░░░░░░░░░░░░░ ] 10%",
      "[ █████🗂️░░░░░░░░░ ] 30%",
      "[ █████████🗂️░░░░ ] 60%",
      "[ █████████████✅ ] 80%",
      "[ ███████████████ ] 100%"
    ];

    const loading = await api.sendMessage(
      "X69X BOT System...⏳\n" + loadStages[0],
      event.threadID
    );
    const msgID = loading.messageID;

    for (let i = 1; i < loadStages.length; i++) {
      await delay(120);
      try {
        await api.editMessage(
          "RS• BOT System ✅\n" + loadStages[i],
          msgID,
          event.threadID
        );
      } catch {}
    }

    const buildPanel = async () => {
      const uptime = process.uptime();
      const d = Math.floor(uptime / 86400);
      const h = Math.floor((uptime % 86400) / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);

      const mem = await si.mem();
      const load = await pidusage(process.pid);
      const cpu = await si.cpu();

      let gcCount = 0;
      try {
        const threads = await api.getThreadList(100, null, ["INBOX"]);
        gcCount = threads.filter(t => t.isGroup).length;
      } catch {}

      const now = new Date();
      const date = now.toLocaleDateString("en-US");
      const time = now.toLocaleTimeString("en-US", { hour12: false });

      return `
╔═════════════════════╗
║        ⚡ RS. BOT SYSTEM ⚡
╠═════════════════════╣
║ ⏳ Uptime   : ${d}d ${h}h ${m}m ${s}s
║ 📅 Date     : ${date}
║ 🕒 Time     : ${time}
║
║ 🔥 CPU Load : ${load.cpu.toFixed(1)}%
║ 🧩 CPU Cores: ${cpu.cores}
║ 🧵 Threads  : ${cpu.processors}
║ 💾 RAM Used : ${(mem.used / 1024 ** 3).toFixed(2)} GB
║ 💾 RAM Total: ${(mem.total / 1024 ** 3).toFixed(2)} GB
║ 👥 Group Chats : ${gcCount}
║
║ ⚙️ PID      : ${process.pid}
║ 🛠 Node.js  : ${process.version}
║ 🧘‍♂️ Owner   : EWR RIFAT
╠═════════════════════╣
║        ✅ SYSTEM RUNNING
╚═════════════════════╝
`;
    };

    const panel = await buildPanel();
    await api.editMessage(panel, msgID, event.threadID);

    setInterval(async () => {
      try {
        const update = await buildPanel();
        await api.editMessage(update, msgID, event.threadID);
      } catch {}
    }, 5000);
  }
} 
