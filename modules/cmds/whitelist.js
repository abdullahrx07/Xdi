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
            en: "Only whitelisted users can use the bot"
        },
        longDescription: {
            en: "Turn whitelist mode on/off, add/remove users, view the list. When on, only listed users plus adminBot can use the bot. Thread whitelist: when on, the bot only runs in listed group threads (also works with E2EE group JIDs like xxxx@g.us)."
        },
        category: "admin",
        guide: {
            en:
`— User whitelist —
{pn} on          - turn whitelist mode on
{pn} off         - turn whitelist mode off
{pn} add <uid>   - add a user to the whitelist (reply or give uid)
{pn} remove <uid>- remove a user from the whitelist
{pn} list        - show who is on the whitelist
{pn} ignore <cmd>- let a command work for everyone
{pn} unignore <cmd> - remove that exemption

— Thread whitelist (group) —
{pn} threadon           - only whitelisted threads can use the bot
{pn} threadoff          - turn off thread whitelist (all groups work)
{pn} threadadd [tid]    - add current thread (or given tid) to whitelist
{pn} threadremove [tid] - remove current thread (or given tid) from whitelist
{pn} threadlist         - show whitelisted threads`
        }
    },

    langs: {
        en: {
            on: "Whitelist mode is now on. Only whitelisted users can use the bot.",
            off: "Whitelist mode is now off. Everyone can use the bot.",
            alreadyOn: "Whitelist mode is already on.",
            alreadyOff: "Whitelist mode is already off.",
            added: "%1 added to the whitelist.",
            alreadyIn: "%1 is already on the whitelist.",
            removed: "%1 removed from the whitelist.",
            notIn: "%1 is not on the whitelist.",
            listEmpty: "Whitelist is empty.",
            listHeader: "Whitelist Mode: %1\nWhitelist Users (%2):\n",
            listItem: "  %1. %2\n",
            ignoredHeader: "\nIgnore Commands:\n",
            ignoredItem: "  - %1\n",
            noUID: "Please give a UID or mention someone.",
            ignoreCmdAdded: "'%1' is now exempt from whitelist.",
            ignoreCmdExists: "'%1' is already in the ignore list.",
            ignoreCmdRemoved: "'%1' removed from the ignore list.",
            ignoreCmdNotIn: "'%1' is not in the ignore list.",
            unknownSub: "Unknown subcommand. See {pn} help.",
            noCmd: "Please give a command name.",

            threadOn: "Thread whitelist mode is now on. Only whitelisted groups can use the bot.",
            threadOff: "Thread whitelist mode is now off. The bot works in all groups.",
            threadAlreadyOn: "Thread whitelist mode is already on.",
            threadAlreadyOff: "Thread whitelist mode is already off.",
            threadNotGroup: "This isn't a group thread. Only group threads can be added/removed.",
            threadAdded: "Thread %1 added to the whitelist.",
            threadAlreadyIn: "Thread %1 is already on the whitelist.",
            threadRemoved: "Thread %1 removed from the whitelist.",
            threadNotIn: "Thread %1 is not on the whitelist.",
            threadListEmpty: "Thread whitelist is empty.",
            threadListHeader: "Thread Whitelist Mode: %1\nWhitelisted Threads (%2):\n",
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
            const statusText = wl.threadStatus ? "ON" : "OFF";
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
            const statusText = wl.status ? "ON" : "OFF";
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
