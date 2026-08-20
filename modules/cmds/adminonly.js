const { writeFileSync } = require("fs-extra");

module.exports = {
    config: {
        name: "adminonly",
        aliases: ["aom"],
        version: "1.0",
        author: "rX Abdullah",
        countDown: 3,
        role: 3, // adminBot only
        shortDescription: {
            en: "Admin Only Mode — শুধু bot admin/group admin bot use করতে পারবে"
        },
        longDescription: {
            en: "Admin Only mode on/off করো। চালু থাকলে group-এ শুধু group admin + adminBot, আর DM-এ শুধু adminBot/developer bot-এর সব command (prefix, no-prefix, baby, onReply, onReaction — সব) use করতে পারবে।"
        },
        category: "admin",
        guide: {
            en:
`🛡️ Admin Only Mode:

{pn} on              — admin only mode চালু
{pn} off             — admin only mode বন্ধ
{pn} ignore <cmd>    — একটা command exempt করো (সবাই use করতে পারবে)
{pn} unignore <cmd>  — সেই exempt সরাও
{pn} list            — status ও ignore list দেখো`
        }
    },

    langs: {
        en: {
            on: "✅ Admin Only Mode চালু হয়েছে। এখন শুধু bot admin / group admin-রাই bot-এর সব command (prefix, no-prefix, baby, reply, reaction সহ) use করতে পারবে।",
            off: "🔓 Admin Only Mode বন্ধ হয়েছে। এখন সবাই আগের মতো bot use করতে পারবে।",
            alreadyOn: "⚠️ Admin Only Mode এখনই চালু আছে।",
            alreadyOff: "⚠️ Admin Only Mode এখনই বন্ধ আছে।",
            listHeader: "🛡️ Admin Only Mode: %1\n",
            ignoredHeader: "🚫 Ignore Commands (সবার জন্য open থাকবে):\n",
            ignoredItem: "  • %1\n",
            ignoredEmpty: "🚫 কোনো ignore command নাই।",
            ignoreCmdAdded: "✅ '%1' command-টি admin-only থেকে exempt করা হয়েছে।",
            ignoreCmdExists: "⚠️ '%1' আগে থেকেই ignore list-এ আছে।",
            ignoreCmdRemoved: "🗑️ '%1' ignore list থেকে সরানো হয়েছে।",
            ignoreCmdNotIn: "⚠️ '%1' ignore list-এ নেই।",
            noCmd: "❌ কোনো command name দাও।",
            unknownSub: "❌ অজানা subcommand। {pn} help দেখো।"
        }
    },

    onStart: async function ({ args, message, getLang }) {
        const { config } = global.GoatBot;
        const aom = config.adminOnlyMode = config.adminOnlyMode || { status: false, ignoreCommand: [] };
        if (!Array.isArray(aom.ignoreCommand)) aom.ignoreCommand = [];

        const save = () => writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            if (aom.status === true) return message.reply(getLang("alreadyOn"));
            aom.status = true;
            save();
            return message.reply(getLang("on"));
        }

        if (sub === "off") {
            if (aom.status !== true) return message.reply(getLang("alreadyOff"));
            aom.status = false;
            save();
            return message.reply(getLang("off"));
        }

        if (sub === "list") {
            const statusText = aom.status ? "✅ চালু" : "❌ বন্ধ";
            let text = getLang("listHeader", statusText);
            text += getLang("ignoredHeader");
            if (aom.ignoreCommand.length === 0) text += getLang("ignoredEmpty");
            else aom.ignoreCommand.forEach(cmd => { text += getLang("ignoredItem", cmd); });
            return message.reply(text.trim());
        }

        if (sub === "ignore") {
            const cmd = args[1];
            if (!cmd) return message.reply(getLang("noCmd"));
            if (aom.ignoreCommand.includes(cmd)) return message.reply(getLang("ignoreCmdExists", cmd));
            aom.ignoreCommand.push(cmd);
            save();
            return message.reply(getLang("ignoreCmdAdded", cmd));
        }

        if (sub === "unignore") {
            const cmd = args[1];
            if (!cmd) return message.reply(getLang("noCmd"));
            const idx = aom.ignoreCommand.indexOf(cmd);
            if (idx === -1) return message.reply(getLang("ignoreCmdNotIn", cmd));
            aom.ignoreCommand.splice(idx, 1);
            save();
            return message.reply(getLang("ignoreCmdRemoved", cmd));
        }

        return message.reply(getLang("unknownSub"));
    }
};
