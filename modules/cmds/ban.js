const fs = require("fs-extra");

module.exports = {
  config: {
    name: "ban",
    version: "2.0.5",
    author: "rX",
    countDown: 5,
    role: 0,
    shortDescription: "Permanently ban members from the group",
    longDescription: "Warn / ban members from the group, view warns, unban, reset data",
    category: "group",
    guide: {
      en:
`{p}ban [tag] or [reply] "reason" - warn a user (auto ban after 1 warning)
{p}ban listban - see the list of banned users
{p}ban unban [id] - remove a user from the banned list
{p}ban view [@tag] / view all / view - see warn history
{p}ban reset - reset all warn/ban data in the group`
    }
  },

  onStart: async function ({ api, event, args, message, usersData, role }) {
    const { threadID, messageID, senderID } = event;

    const info = await api.getThreadInfo(threadID);
    if (!info.adminIDs.some(item => item.id == api.getCurrentUserID())) {
      return message.reply("The bot needs group admin rights to use this command\nPlease add and try again!");
    }

    const cacheDir = __dirname + "/cache";
    const cachePath = cacheDir + "/bans.json";
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    if (!fs.existsSync(cachePath)) {
      fs.writeFileSync(cachePath, JSON.stringify({ warns: {}, banned: {} }));
    }

    const bans = JSON.parse(fs.readFileSync(cachePath));
    // { warns: { threadID: { userID: [reasons] } }, banned: { threadID: [userID] } }

    if (!bans.warns.hasOwnProperty(threadID)) {
      bans.warns[threadID] = {};
      fs.writeFileSync(cachePath, JSON.stringify(bans, null, 2));
    }

    // isAdmin = group admin (role 1) or bot admin (role 2)
    const isAdmin = role >= 1;

    if (args[0] == "view") {
      if (!args[1]) {
        const mywarn = bans.warns[threadID][senderID];
        if (!mywarn || !mywarn.length) return message.reply("✅ You have never been warned");
        let msg = "";
        for (const reasonwarn of mywarn) msg += `${reasonwarn}\n`;
        return message.reply(`❎ You have been warned for the reason:\n${msg}`);
      }

      else if (Object.keys(event.mentions).length != 0) {
        let messageOut = "";
        const mentions = Object.keys(event.mentions);
        for (const id of mentions) {
          const name = (await api.getUserInfo(id))[id].name;
          let msg = "";
          const reasonarr = bans.warns[threadID][id];
          if (typeof reasonarr != "object") {
            msg += " Never been warned\n";
          } else {
            for (const reason of reasonarr) msg += "" + reason + "\n";
          }
          messageOut += "⭐️" + name + " :" + msg + "";
        }
        return message.reply(messageOut);
      }

      else if (args[1] == "all") {
        const dtwbox = bans.warns[threadID];
        let allwarn = "";
        for (const idtvw in dtwbox) {
          const name = (await api.getUserInfo(idtvw))[idtvw].name;
          let msg = "";
          for (const reasonwtv of dtwbox[idtvw]) msg += `${reasonwtv}`;
          allwarn += `${name} : ${msg}\n`;
        }
        return allwarn == ""
          ? message.reply("✅ No one in your group has been warned yet")
          : message.reply("List of members who have been warned:\n" + allwarn);
      }
      return message.SyntaxError();
    }

    else if (args[0] == "unban") {
      if (!isAdmin) return message.reply("❎ Right cunt border!");

      const id = parseInt(args[1]);
      const mybox = bans.banned[threadID] || [];
      if (!id) return message.reply("❎ Need to enter the id of the person to be removed from the banned list of the group");
      if (!mybox.includes(id)) return message.reply("✅ This person hasn't been banned from your group yet");

      mybox.splice(mybox.indexOf(id), 1);
      delete bans.warns[threadID][id];
      fs.writeFileSync(cachePath, JSON.stringify(bans, null, 2));
      return message.reply(`✅ Removed the member with id ${id} from the group banned list`);
    }

    else if (args[0] == "listban") {
      const mybox = bans.banned[threadID] || [];
      let msg = "";
      for (const iduser of mybox) {
        const name = (await api.getUserInfo(iduser))[iduser].name;
        msg += "╔Name: " + name + "\n╚ID: " + iduser + "\n";
      }
      return msg == ""
        ? message.reply("✅ No one in your group has been banned from the group yet")
        : message.reply("❎ Members who have been banned from the group:\n" + msg);
    }

    else if (args[0] == "reset") {
      if (!isAdmin) return message.reply("❎ Right cunt border!");

      bans.warns[threadID] = {};
      bans.banned[threadID] = [];
      fs.writeFileSync(cachePath, JSON.stringify(bans, null, 2));
      return message.reply("Reset all data in your group");
    }

    //◆━━━━━━━━━◆WARN◆━━━━━━━━━◆\\
    else {
      if (event.type != "message_reply" && Object.keys(event.mentions).length == 0) {
        return message.SyntaxError();
      }

      if (!isAdmin) return message.reply("Right cunt border!");

      let reason = "";
      let iduser;

      if (event.type == "message_reply") {
        iduser = [event.messageReply.senderID];
        reason = (args.join(" ")).trim();
      }

      else if (Object.keys(event.mentions).length != 0) {
        iduser = Object.keys(event.mentions);
        const namearr = Object.values(event.mentions);
        let messageBody = args.join(" ");
        for (const valuemention of namearr) {
          messageBody = messageBody.replace(valuemention, "");
        }
        reason = messageBody.replace(/\s+/g, " ").trim();
      }

      const arraytag = [];
      const arrayname = [];

      for (const iid of iduser) {
        const id = parseInt(iid);
        const nametag = (await api.getUserInfo(id))[id].name;
        arraytag.push({ id: id, tag: nametag });

        if (!reason) reason = "No reason was given";

        const dtwmybox = bans.warns[threadID];
        if (!dtwmybox.hasOwnProperty(id)) dtwmybox[id] = [];

        arrayname.push(nametag);
        const pushreason = bans.warns[threadID][id];
        pushreason.push(reason);

        if (!bans.banned[threadID]) bans.banned[threadID] = [];

        if (bans.warns[threadID][id].length > 0) {
          api.removeUserFromGroup(id, threadID);
          bans.banned[threadID].push(id);
          fs.writeFileSync(cachePath, JSON.stringify(bans, null, 2));
        }
      }

      message.reply({ body: `Banned members ${arrayname.join(", ")} permanently leave the group for the reason: ${reason}`, mentions: arraytag });
      fs.writeFileSync(cachePath, JSON.stringify(bans, null, 2));
    }
  }
};
