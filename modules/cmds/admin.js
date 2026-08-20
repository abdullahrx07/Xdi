const { config } = global.GoatBot;
const { writeFileSync } = require("fs-extra");

module.exports = {
    config: {
        name: "admin",
        aliases: ["ad"],
        version: "1.1",
        author: "Azadx69x",
        countDown: 5,
        role: 0,
        shortDescription: {
            en: "𝗔𝗱𝗱, 𝗿𝗲𝗺𝗼𝘃𝗲 𝗼𝗿 𝘃𝗶𝗲𝘄 𝘁𝗵𝗲 𝗮𝗱𝗺𝗶𝗻 𝗹𝗶𝘀𝘁"
        },
        longDescription: {
            en: "𝗠𝗮𝗻𝗮𝗴𝗲 𝗯𝗼𝘁 𝗮𝗱𝗺𝗶𝗻𝘀 — 𝗮𝗱𝗱/𝗿𝗲𝗺𝗼𝘃𝗲/𝘃𝗶𝗲𝘄"
        },
        category: "admin",
        guide: {
            en:
`🕵 𝗨𝘀𝗮𝗴𝗲:
{pn} 𝗹𝗶𝘀𝘁
{pn} 𝗮𝗱𝗱 <uid|tag|reply>
{pn} 𝗿𝗲𝗺𝗼𝘃𝗲 <uid|tag|reply>`
        }
    },

    langs: {
        en: {
            listAdmin:
`╔════⛨ 𝐀𝐃𝐌𝐈𝐍 𝐋𝐈𝐒𝐓 ⛨════╗
     ✪ 𝙾𝚆𝙽𝙴𝚁: RS• RIFAT.¥
╠═══════════════════╣
     📋 𝙰𝚍𝚖𝚒𝚗 𝙻𝚒𝚜𝚝:
%1
╚═══════════════════╝`,

            noAdmin: "⚠️ | 𝙽𝚘 𝙰𝚍𝚖𝚒𝚗𝚜 𝙵𝚘𝚞𝚗𝚍!",

            added:
`✔ 𝗡𝗲𝘄 𝗔𝗱𝗺𝗶𝗻𝘀 𝗔𝗱𝗱𝗲𝗱:
━━━━━━━━━━━━━━━━
%2
━━━━━━━━━━━━━━━━`,

            alreadyAdmin:
`⚠️ 𝗔𝗹𝗿𝗲𝗮𝗱𝘆 𝗔𝗱𝗺𝗶𝗻:
━━━━━━━━━━━━━━━━
%2
━━━━━━━━━━━━━━━━`,

            removed:
`✔ 𝗔𝗱𝗺𝗶𝗻 𝗣𝗿𝗶𝘃𝗶𝗹𝗲𝗴𝗲 𝗥𝗲𝗺𝗼𝘃𝗲𝗱:
━━━━━━━━━━━━━━━━
%2
━━━━━━━━━━━━━━━━`,

            notAdmin:
`⚠️ 𝗡𝗼𝘁 𝗔𝗻 𝗔𝗱𝗺𝗶𝗻:
━━━━━━━━━━━━━━━━
%2
━━━━━━━━━━━━━━━━`,

            missingIdAdd: "⚠️ | 𝗧𝗮𝗴/𝗿𝗲𝗽𝗹𝘆/𝗨𝗜𝗗 𝗻𝗲𝗲𝗱𝗲𝗱 𝘁𝗼 𝗮𝗱𝗱 𝗮𝗱𝗺𝗶𝗻.",
            missingIdRemove: "⚠️ | 𝗧𝗮𝗴/𝗿𝗲𝗽𝗹𝘆/𝗨𝗜𝗗 𝗻𝗲𝗲𝗱𝗲𝗱 𝘁𝗼 𝗿𝗲𝗺𝗼𝘃𝗲 𝗮𝗱𝗺𝗶𝗻.",

            notAllowed: "⛔ | 𝗬𝗼𝘂 𝗮𝗿𝗲 𝗻𝗼𝘁 𝗮𝗹𝗹𝗼𝘄𝗲𝗱 𝘁𝗼 𝘂𝘀𝗲 𝘁𝗵𝗶𝘀!"
        }
    },

    onStart: async function ({ message, args, event, usersData, getLang }) {
        const senderID = event.senderID;
        
        if (args[0] === "list" || args[0] === "-l") {
            if (config.adminBot.length === 0)
                return message.reply(getLang("noAdmin"));

            const adminList = await Promise.all(
                config.adminBot.map(async uid => {
                    const name = await usersData.getName(uid);
                    return `• ${name} (${uid})`;
                })
            );

            return message.reply(getLang("listAdmin", adminList.join("\n")));
        }
        
        if (["add", "-a", "remove", "-r"].includes(args[0])) {
            if (!config.adminBot.includes(senderID))
                return message.reply(getLang("notAllowed"));
        }
        
        if (args[0] === "add" || args[0] === "-a") {
            let uids = [];

            if (Object.keys(event.mentions).length)
                uids = Object.keys(event.mentions);
            else if (event.type === "message_reply")
                uids = [event.messageReply.senderID];
            else
                uids = args.filter(a => !isNaN(a));

            if (!uids.length)
                return message.reply(getLang("missingIdAdd"));

            const newAdmins = [];
            const alreadyAdmins = [];

            for (const uid of uids) {
                if (config.adminBot.includes(uid))
                    alreadyAdmins.push(uid);
                else
                    newAdmins.push(uid);
            }

            config.adminBot.push(...newAdmins);
            writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

            const newNames = await Promise.all(newAdmins.map(uid => usersData.getName(uid)));
            const oldNames = await Promise.all(alreadyAdmins.map(uid => usersData.getName(uid)));

            return message.reply(
                (newNames.length ? getLang("added", newNames.length, newNames.map(n => `• ${n}`).join("\n")) : "") +
                (alreadyAdmins.length ? "\n" + getLang("alreadyAdmin", alreadyAdmins.length, oldNames.map(n => `• ${n}`).join("\n")) : "")
            );
        }
        
        if (args[0] === "remove" || args[0] === "-r") {
            let uids = [];

            if (Object.keys(event.mentions).length)
                uids = Object.keys(event.mentions);
            else if (event.type === "message_reply")
                uids = [event.messageReply.senderID];
            else
                uids = args.filter(a => !isNaN(a));

            if (!uids.length)
                return message.reply(getLang("missingIdRemove"));

            const removed = [];
            const notAdmins = [];

            for (const uid of uids) {
                if (config.adminBot.includes(uid)) {
                    removed.push(uid);
                    config.adminBot.splice(config.adminBot.indexOf(uid), 1);
                } else {
                    notAdmins.push(uid);
                }
            }

            writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

            const removedNames = await Promise.all(removed.map(uid => usersData.getName(uid)));
            const notNames = await Promise.all(notAdmins.map(uid => usersData.getName(uid)));

            return message.reply(
                (removed.length ? getLang("removed", removed.length, removedNames.map(n => `• ${n}`).join("\n")) : "") +
                (notAdmins.length ? "\n" + getLang("notAdmin", notAdmins.length, notNames.map(n => `• ${n}`).join("\n")) : "")
            );
        }
        
        return message.reply("⚠️ | 𝗨𝘀𝗲: 𝗹𝗶𝘀𝘁 / 𝗮𝗱𝗱 / 𝗿𝗲𝗺𝗼𝘃𝗲");
    }
};
