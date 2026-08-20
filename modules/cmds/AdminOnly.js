const { writeFileSync } = require("fs-extra");

module.exports = {
    config: {
        name: "adminonly",
        aliases: ["ao"],
        version: "1.0",
        author: "rX Abdullah",
        countDown: 3,
        role: 1, // botAdmin only (new system: 0=all, 1=botAdmin, 2=botAdmin+groupAdmin, 3=NDH/whitelist)
        shortDescription: {
            en: "Admin-only mode — শুধু bot admin bot use করতে পারবে"
        },
        longDescription: {
            en: "Admin-only mode on/off করো। on থাকলে শুধু config.adminBot-এ থাকা uid রাই bot response/auto-trigger পাবে, বাকি সবাই সম্পূর্ণ silent skip হবে — কোনো reply বা event trigger হবে না।"
        },
        category: "admin",
        guide: {
            en:
`🔒 Admin-Only Command:

{pn} on              — admin-only mode চালু (শুধু bot admin)
{pn} off              — admin-only mode বন্ধ
{pn} ignore <cmd>     — একটা command কে admin-only থেকে exempt করো (সবার জন্য open থাকবে)
{pn} unignore <cmd>   — exempt সরাও
{pn} list             — এখন কী অবস্থায় আছে দেখো`
        }
    },

    langs: {
        en: {
            on: "🔒 Admin-only mode চালু হয়েছে। এখন থেকে শুধু bot admin-রা bot use করতে পারবে, বাকি সবার মেসেজ silently skip হবে।",
            off: "🔓 Admin-only mode বন্ধ হয়েছে। স্বাভাবিক role/whitelist অনুযায়ী bot চলবে।",
            alreadyOn: "⚠️ Admin-only mode এখনই চালু আছে।",
            alreadyOff: "⚠️ Admin-only mode এখনই বন্ধ আছে।",
            ignoreCmdAdded: "✅ '%1' command-টি admin-only থেকে exempt করা হয়েছে (সবার জন্য open)।",
            ignoreCmdExists: "⚠️ '%1' আগে থেকেই ignore list-এ আছে।",
            ignoreCmdRemoved: "🗑️ '%1' ignore list থেকে সরানো হয়েছে।",
            ignoreCmdNotIn: "⚠️ '%1' ignore list-এ নেই।",
            noCmd: "❌ কোনো command name দাও।",
            listHeader: "🔒 Admin-Only Mode: %1\n🚫 Ignore Commands (সবার জন্য open):\n",
            listEmpty: "  কোনো ignore command নেই।\n",
            listItem: "  • %1\n",
            unknownSub: "❌ অজানা subcommand। {pn} help দেখো।"
        }
    },

    onStart: async function ({ args, message, getLang }) {
        const { config } = global.GoatBot;
        const ao = config.adminOnly = config.adminOnly || { status: false, ignoreCommand: [] };
        if (!Array.isArray(ao.ignoreCommand)) ao.ignoreCommand = [];

        const save = () => writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

        const sub = (args[0] || "").toLowerCase();

        // ——— on / off ———
        if (sub === "on") {
            if (ao.status === true) return message.reply(getLang("alreadyOn"));
            ao.status = true;
            save();
            return message.reply(getLang("on"));
        }

        if (sub === "off") {
            if (ao.status !== true) return message.reply(getLang("alreadyOff"));
            ao.status = false;
            save();
            return message.reply(getLang("off"));
        }

        // ——— ignore <cmd> ———
        if (sub === "ignore") {
            const cmd = args[1];
            if (!cmd) return message.reply(getLang("noCmd"));
            if (ao.ignoreCommand.includes(cmd)) return message.reply(getLang("ignoreCmdExists", cmd));
            ao.ignoreCommand.push(cmd);
            save();
            return message.reply(getLang("ignoreCmdAdded", cmd));
        }

        // ——— unignore <cmd> ———
        if (sub === "unignore") {
            const cmd = args[1];
            if (!cmd) return message.reply(getLang("noCmd"));
            const idx = ao.ignoreCommand.indexOf(cmd);
            if (idx === -1) return message.reply(getLang("ignoreCmdNotIn", cmd));
            ao.ignoreCommand.splice(idx, 1);
            save();
            return message.reply(getLang("ignoreCmdRemoved", cmd));
        }

        // ——— list ———
        if (sub === "list") {
            const statusText = ao.status ? "✅ চালু" : "❌ বন্ধ";
            let text = getLang("listHeader", statusText);
            if (ao.ignoreCommand.length === 0) {
                text += getLang("listEmpty");
            } else {
                ao.ignoreCommand.forEach(cmd => { text += getLang("listItem", cmd); });
            }
            return message.reply(text.trim());
        }

        // ——— unknown ———
        return message.reply(getLang("unknownSub"));
    }
};
