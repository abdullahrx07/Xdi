const fs = require("fs-extra");

function saveConfig(config) {
    fs.writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
    global.GoatBot.config = config;
}

module.exports = {
    config: {
        name: "security",
        aliases: ["sec"],
        version: "1.0",
        author: "Rx",
        countDown: 5,
        role: 2,
        description: {
            en: "Toggle E2EE (Labyrinth encrypted chat) and Anti-Inbox from config.json"
        },
        category: "owner",
        guide: {
            en:
`   {pn} e2ee on: turn Facebook E2EE support ON (needs bot restart)
   {pn} e2ee off: turn Facebook E2EE support OFF (needs bot restart)
   {pn} e2ee status: show current E2EE state
   {pn} antiinbox on: bot ignores inbox/DM, only replies in groups
   {pn} antiinbox off: bot replies in inbox/DM again
   {pn} antiinbox status: show current Anti-Inbox state`
        }
    },

    langs: {
        en: {
            e2eeOn: "✅ E2EE turned ON in config.json.\n⚠️ Restart the bot for this to take effect — the E2EE bridge only connects once at startup.\n💡 Keep \"saveType\": \"path\" in the e2ee config block so the same device key is reused on restart — registering a brand-new E2EE device every restart is what tends to get an ID flagged.",
            e2eeOff: "✅ E2EE turned OFF in config.json.\n⚠️ Restart the bot for this to take effect.",
            e2eeStatus: "🔐 E2EE is currently: %1",
            antiInboxOn: "✅ Anti-Inbox turned ON — the bot will now ignore inbox/DM messages and only respond in group threads.",
            antiInboxOff: "✅ Anti-Inbox turned OFF — the bot will respond in inbox/DM again, same as groups.",
            antiInboxStatus: "📥 Anti-Inbox is currently: %1",
            invalidArg: "❌ Use: on | off | status",
            unknownSub: "❌ Unknown option.\nUse: {pn} e2ee [on|off|status]\nor: {pn} antiinbox [on|off|status]"
        }
    },

    onStart: async function ({ message, args, getLang }) {
        const sub = (args[0] || "").toLowerCase();
        const action = (args[1] || "").toLowerCase();

        if (sub !== "e2ee" && sub !== "antiinbox") {
            return message.reply(getLang("unknownSub"));
        }
        if (!["on", "off", "status"].includes(action)) {
            return message.reply(getLang("invalidArg"));
        }

        const config = fs.readJsonSync(global.client.dirConfig);

        if (sub === "e2ee") {
            config.e2ee = config.e2ee || {};
            if (action === "status") {
                return message.reply(getLang("e2eeStatus", config.e2ee.enable === true ? "ON ✅" : "OFF ❌"));
            }
            config.e2ee.enable = (action === "on");
            saveConfig(config);
            return message.reply(getLang(action === "on" ? "e2eeOn" : "e2eeOff"));
        }

        if (sub === "antiinbox") {
            if (action === "status") {
                return message.reply(getLang("antiInboxStatus", config.antiInbox === true ? "ON ✅ (inbox blocked)" : "OFF ❌ (inbox allowed)"));
            }
            config.antiInbox = (action === "on");
            saveConfig(config);
            return message.reply(getLang(action === "on" ? "antiInboxOn" : "antiInboxOff"));
        }
    }
};
