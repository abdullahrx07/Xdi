const { writeFileSync } = require("fs-extra");

module.exports = {
    config: {
        name: "adminonly",
        aliases: ["ao"],
        version: "1.0",
        author: "rX",
        countDown: 3,
        role: 1, // botAdmin only (new system: 0=all, 1=botAdmin, 2=botAdmin+groupAdmin, 3=NDH/whitelist)
        shortDescription: {
            en: "Only bot admin can use the bot"
        },
        longDescription: {
            en: "Turn admin only mode on or off. When on, only bot admin gets a response, everyone else is ignored."
        },
        category: "admin",
        guide: {
            en:
`{pn} on              - turn admin only on
{pn} off              - turn admin only off
{pn} ignore <cmd>     - let a command work for everyone
{pn} unignore <cmd>   - remove that exemption
{pn} list             - show current status`
        }
    },

    langs: {
        en: {
            on: "Admin only is now on. Only bot admin can use the bot.",
            off: "Admin only is now off. Bot will run normally.",
            alreadyOn: "Admin only is already on.",
            alreadyOff: "Admin only is already off.",
            ignoreCmdAdded: "'%1' is now exempt from admin only.",
            ignoreCmdExists: "'%1' is already in the ignore list.",
            ignoreCmdRemoved: "'%1' removed from the ignore list.",
            ignoreCmdNotIn: "'%1' is not in the ignore list.",
            noCmd: "Please give a command name.",
            listHeader: "Admin Only Mode: %1\nIgnore Commands:\n",
            listEmpty: "  No ignore commands set.\n",
            listItem: "  - %1\n",
            unknownSub: "Unknown subcommand. See {pn} help."
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
            const statusText = ao.status ? "ON" : "OFF";
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
