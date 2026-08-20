const { writeFileSync } = require("fs-extra");

module.exports = {
    config: {
        name: "whitelist",
        aliases: ["wl"],
        version: "1.0",
        author: "rX Abdullah",
        countDown: 3,
        role: 1, // botAdmin only (new system: 0=all, 1=botAdmin, 2=botAdmin+groupAdmin, 3=NDH/whitelist, 4=developer)
        shortDescription: {
            en: "Whitelist mode — শুধু নির্দিষ্ট user-রা bot use করতে পারবে"
        },
        longDescription: {
            en: "Whitelist mode on/off করো, user add/remove করো, list দেখো। Whitelist on থাকলে শুধু listed user + adminBot bot use করতে পারবে।"
        },
        category: "admin",
        guide: {
            en:
`🛡️ Whitelist Command:

{pn} on          — whitelist mode চালু
{pn} off         — whitelist mode বন্ধ
{pn} add <uid>   — whitelist-এ user যোগ (reply বা uid দিয়ে)
{pn} remove <uid>— whitelist থেকে user সরাও
{pn} list        — whitelist-এ কে কে আছে দেখো
{pn} ignore <cmd>— একটা command কে whitelist থেকে exempt করো
{pn} unignore <cmd> — exempt সরাও`
        }
    },

    langs: {
        en: {
            on: "✅ Whitelist mode চালু হয়েছে। এখন থেকে শুধু whitelist user-রা bot use করতে পারবে।",
            off: "🔓 Whitelist mode বন্ধ হয়েছে। সবাই bot use করতে পারবে।",
            alreadyOn: "⚠️ Whitelist mode এখনই চালু আছে।",
            alreadyOff: "⚠️ Whitelist mode এখনই বন্ধ আছে।",
            added: "✅ %1 কে whitelist-এ যোগ করা হয়েছে।",
            alreadyIn: "⚠️ %1 আগে থেকেই whitelist-এ আছে।",
            removed: "🗑️ %1 কে whitelist থেকে সরানো হয়েছে।",
            notIn: "⚠️ %1 whitelist-এ নেই।",
            listEmpty: "📋 Whitelist এখন খালি।",
            listHeader: "🛡️ Whitelist Mode: %1\n📋 Whitelist Users (%2 জন):\n",
            listItem: "  %1. %2\n",
            ignoredHeader: "\n🚫 Ignore Commands (সবার জন্য open):\n",
            ignoredItem: "  • %1\n",
            noUID: "❌ কোনো UID বা mention দাও।",
            ignoreCmdAdded: "✅ '%1' command-টি whitelist থেকে exempt করা হয়েছে।",
            ignoreCmdExists: "⚠️ '%1' আগে থেকেই ignore list-এ আছে।",
            ignoreCmdRemoved: "🗑️ '%1' ignore list থেকে সরানো হয়েছে।",
            ignoreCmdNotIn: "⚠️ '%1' ignore list-এ নেই।",
            unknownSub: "❌ অজানা subcommand। {pn} help দেখো।",
            noCmd: "❌ কোনো command name দাও।"
        }
    },

    onStart: async function ({ args, message, event, getLang }) {
        const { config } = global.GoatBot;
        const wl = config.whitelist = config.whitelist || { status: false, ids: [], ignoreCommand: [] };
        if (!Array.isArray(wl.ids)) wl.ids = [];
        if (!Array.isArray(wl.ignoreCommand)) wl.ignoreCommand = [];

        const save = () => writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

        const sub = (args[0] || "").toLowerCase();

        // ——— on / off ———
        if (sub === "on") {
            if (wl.status === true) return message.reply(getLang("alreadyOn"));
            wl.status = true;
            save();
            return message.reply(getLang("on"));
        }

        if (sub === "off") {
            if (wl.status !== true) return message.reply(getLang("alreadyOff"));
            wl.status = false;
            save();
            return message.reply(getLang("off"));
        }

        // ——— list ———
        if (sub === "list") {
            const statusText = wl.status ? "✅ চালু" : "❌ বন্ধ";
            if (wl.ids.length === 0 && wl.ignoreCommand.length === 0) {
                return message.reply(
                    getLang("listHeader", statusText, 0) + getLang("listEmpty")
                );
            }
            let text = getLang("listHeader", statusText, wl.ids.length);
            wl.ids.forEach((uid, i) => {
                text += getLang("listItem", i + 1, uid);
            });
            if (wl.ignoreCommand.length > 0) {
                text += getLang("ignoredHeader");
                wl.ignoreCommand.forEach(cmd => { text += getLang("ignoredItem", cmd); });
            }
            return message.reply(text.trim());
        }

        // ——— add ———
        if (sub === "add") {
            const uid = resolveUID(args.slice(1), event);
            if (!uid) return message.reply(getLang("noUID"));
            if (wl.ids.includes(uid)) return message.reply(getLang("alreadyIn", uid));
            wl.ids.push(uid);
            save();
            return message.reply(getLang("added", uid));
        }

        // ——— remove ———
        if (sub === "remove" || sub === "rem" || sub === "rm") {
            const uid = resolveUID(args.slice(1), event);
            if (!uid) return message.reply(getLang("noUID"));
            const idx = wl.ids.indexOf(uid);
            if (idx === -1) return message.reply(getLang("notIn", uid));
            wl.ids.splice(idx, 1);
            save();
            return message.reply(getLang("removed", uid));
        }

        // ——— ignore <cmd> ———
        if (sub === "ignore") {
            const cmd = args[1];
            if (!cmd) return message.reply(getLang("noCmd"));
            if (wl.ignoreCommand.includes(cmd)) return message.reply(getLang("ignoreCmdExists", cmd));
            wl.ignoreCommand.push(cmd);
            save();
            return message.reply(getLang("ignoreCmdAdded", cmd));
        }

        // ——— unignore <cmd> ———
        if (sub === "unignore") {
            const cmd = args[1];
            if (!cmd) return message.reply(getLang("noCmd"));
            const idx = wl.ignoreCommand.indexOf(cmd);
            if (idx === -1) return message.reply(getLang("ignoreCmdNotIn", cmd));
            wl.ignoreCommand.splice(idx, 1);
            save();
            return message.reply(getLang("ignoreCmdRemoved", cmd));
        }

        // ——— unknown ———
        return message.reply(getLang("unknownSub"));
    }
};

/**
 * Resolve UID from args (plain uid string) or from event mentions/reply.
 */
function resolveUID(args, event) {
    // From reply
    if (event.messageReply?.senderID) return String(event.messageReply.senderID);

    // From @mention
    const mentions = event.mentions || {};
    const mentionIDs = Object.keys(mentions);
    if (mentionIDs.length > 0) return String(mentionIDs[0]);

    // From plain arg (numeric uid)
    const raw = args.join("").trim();
    if (raw && /^\d+$/.test(raw)) return raw;

    return null;
}
