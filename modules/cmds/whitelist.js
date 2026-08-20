const { writeFileSync } = require("fs-extra");

module.exports = {
    config: {
        name: "whitelist",
        aliases: ["wl"],
        version: "1.0",
        author: "rX Abdullah",
        countDown: 3,
        role: 1, // botAdmin only (new system: 0=all, 1=botAdmin, 2=botAdmin+groupAdmin, 3=NDH/whitelist)
        shortDescription: {
            en: "Whitelist mode — শুধু নির্দিষ্ট user-রা bot use করতে পারবে"
        },
        longDescription: {
            en: "Whitelist mode on/off করো, user add/remove করো, list দেখো। Whitelist on থাকলে শুধু listed user + adminBot bot use করতে পারবে। থ্রেড-হোয়াইটলিস্ট: থ্রেড-হোয়াইটলিস্ট on থাকলে শুধু listed group thread-এ bot চলবে (E2EE group JID যেমন xxxx@g.us ধরেও কাজ করে)।"
        },
        category: "admin",
        guide: {
            en:
`🛡️ Whitelist Command:

— User whitelist —
{pn} on          — whitelist mode চালু
{pn} off         — whitelist mode বন্ধ
{pn} add <uid>   — whitelist-এ user যোগ (reply বা uid দিয়ে)
{pn} remove <uid>— whitelist থেকে user সরাও
{pn} list        — whitelist-এ কে কে আছে দেখো
{pn} ignore <cmd>— একটা command কে whitelist থেকে exempt করো
{pn} unignore <cmd> — exempt সরাও

— Thread whitelist (group) —
{pn} threadon           — শুধু whitelisted thread-এ bot চালু (mode on)
{pn} threadoff          — thread-whitelist mode বন্ধ (সব group-এ চলবে)
{pn} threadadd [tid]    — current thread (বা দেওয়া tid) whitelist-এ যোগ
{pn} threadremove [tid] — current thread (বা দেওয়া tid) whitelist থেকে বাদ
{pn} threadlist         — whitelisted thread-দের list দেখো`
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
            noCmd: "❌ কোনো command name দাও।",

            threadOn: "✅ Thread-whitelist mode চালু হয়েছে। এখন থেকে শুধু whitelisted group-এ bot চলবে।",
            threadOff: "🔓 Thread-whitelist mode বন্ধ হয়েছে। এখন সব group-এ bot চলবে।",
            threadAlreadyOn: "⚠️ Thread-whitelist mode এখনই চালু আছে।",
            threadAlreadyOff: "⚠️ Thread-whitelist mode এখনই বন্ধ আছে।",
            threadNotGroup: "❌ এটা group thread না, শুধু group thread whitelist-এ add/remove করা যায়।",
            threadAdded: "✅ থ্রেড %1 কে whitelist-এ যোগ করা হয়েছে।",
            threadAlreadyIn: "⚠️ থ্রেড %1 আগে থেকেই whitelist-এ আছে।",
            threadRemoved: "🗑️ থ্রেড %1 কে whitelist থেকে সরানো হয়েছে।",
            threadNotIn: "⚠️ থ্রেড %1 whitelist-এ নেই।",
            threadListEmpty: "📋 Thread-whitelist এখন খালি।",
            threadListHeader: "🛡️ Thread-Whitelist Mode: %1\n📋 Whitelisted Threads (%2 টা):\n",
            threadListItem: "  %1. %2\n"
        }
    },

    onStart: async function ({ args, message, event, getLang }) {
        const { config } = global.GoatBot;
        const { threadID, isGroup } = event;
        const wl = config.whitelist = config.whitelist || { status: false, ids: [], ignoreCommand: [], threadStatus: false, threadIds: [] };
        if (!Array.isArray(wl.ids)) wl.ids = [];
        if (!Array.isArray(wl.ignoreCommand)) wl.ignoreCommand = [];
        if (typeof wl.threadStatus !== "boolean") wl.threadStatus = false;
        if (!Array.isArray(wl.threadIds)) wl.threadIds = [];

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

        // ——— threadon / threadoff ———
        if (sub === "threadon") {
            if (wl.threadStatus === true) return message.reply(getLang("threadAlreadyOn"));
            wl.threadStatus = true;
            save();
            return message.reply(getLang("threadOn"));
        }

        if (sub === "threadoff") {
            if (wl.threadStatus !== true) return message.reply(getLang("threadAlreadyOff"));
            wl.threadStatus = false;
            save();
            return message.reply(getLang("threadOff"));
        }

        // ——— threadadd ———
        if (sub === "threadadd") {
            const tid = resolveThreadID(args.slice(1), event, threadID, isGroup);
            if (!tid) return message.reply(getLang("threadNotGroup"));
            if (wl.threadIds.includes(tid)) return message.reply(getLang("threadAlreadyIn", tid));
            wl.threadIds.push(tid);
            save();
            return message.reply(getLang("threadAdded", tid));
        }

        // ——— threadremove ———
        if (sub === "threadremove" || sub === "threadrem" || sub === "threadrm") {
            const tid = resolveThreadID(args.slice(1), event, threadID, isGroup);
            if (!tid) return message.reply(getLang("threadNotGroup"));
            const idx = wl.threadIds.indexOf(tid);
            if (idx === -1) return message.reply(getLang("threadNotIn", tid));
            wl.threadIds.splice(idx, 1);
            save();
            return message.reply(getLang("threadRemoved", tid));
        }

        // ——— threadlist ———
        if (sub === "threadlist") {
            const statusText = wl.threadStatus ? "✅ চালু" : "❌ বন্ধ";
            if (wl.threadIds.length === 0) {
                return message.reply(
                    getLang("threadListHeader", statusText, 0) + getLang("threadListEmpty")
                );
            }
            let text = getLang("threadListHeader", statusText, wl.threadIds.length);
            wl.threadIds.forEach((tid, i) => {
                text += getLang("threadListItem", i + 1, tid);
            });
            return message.reply(text.trim());
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
 * Resolve a threadID to add/remove from the thread whitelist: either an
 * explicit tid passed as an arg, or (when none given) the current thread —
 * but only if the current thread is actually a group (isGroup === true),
 * since thread-whitelist only makes sense for groups. Works the same for
 * classic numeric thread IDs and E2EE group JIDs (e.g. "12345@g.us") —
 * both are just compared/stored as plain strings, no special parsing
 * needed for the "@g.us" suffix.
 */
function resolveThreadID(args, event, currentThreadID, isGroup) {
    const raw = args.join(" ").trim();
    if (raw) return raw; // explicit tid given, trust it as-is (numeric or ...@g.us)
    if (isGroup && currentThreadID) return String(currentThreadID);
    return null;
}

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
