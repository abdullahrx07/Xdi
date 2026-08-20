// onReply.js
const { getRoleConfig, createGetText2, buildContext, isAllowedByAccessMode } = require("./shared");

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
    return async function (event, message) {
        const ctx = await buildContext({ api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData, event, message });
        if (!ctx) return;
        const {
            utils, log, removeHomeDir, getTime, config,
            threadData, userData, hideNotiMessage, prefix, role,
            parameters, langCode, createMessageSyntaxError,
            senderID, threadID, isGroup, body, messageID
        } = ctx;
        const { GoatBot } = global;

        // <<< --- onReply LOGIC --- >>>
        // Global adminOnly / whitelist gate — silent skip for everyone else.
        if (!isAllowedByAccessMode(config, undefined, threadID, isGroup, senderID)) return;
        if (!event.messageReply) return;
        const { onReply } = GoatBot;
        const Reply = onReply.get(event.messageReply.messageID);
        if (!Reply) return;
        Reply.delete = () => onReply.delete(event.messageReply.messageID);
        const commandName = Reply.commandName;
        if (!commandName) {
            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "cannotFindCommandName"));
            return log.err("onReply", `Can't find command name to execute this reply!`, Reply);
        }
        const command = GoatBot.commands.get(commandName);
        if (!command) {
            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "cannotFindCommand", commandName));
            return log.err("onReply", `Command "${commandName}" not found`, Reply);
        }
        const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
        const time = getTime("DD/MM/YYYY HH:mm:ss");
        try {
            if (!command) throw new Error(`Cannot find command with commandName: ${commandName}`);
            const args = body ? body.split(/ +/) : [];
            createMessageSyntaxError(commandName);
            await command.onReply({ ...parameters, Reply, args, commandName, getLang: getText2 });
            log.info("onReply", `${commandName} | ${userData?.name || "Unknown"} | ${senderID} | ${threadID} | ${args.join(" ")}`);
        } catch (err) {
            log.err("onReply", `An error occurred when calling the command onReply ${commandName}`, err);
            await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred3", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
        }
    };
};
