// onReaction.js
const { getRoleConfig, createGetText2, buildContext, isAllowedByAccessMode } = require("./shared");

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
    return async function (event, message) {
        const ctx = await buildContext({ api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData, event, message });
        if (!ctx) return;
        const {
            utils, log, removeHomeDir, getTime, config,
            threadData, userData, hideNotiMessage, prefix, role,
            parameters, langCode, createMessageSyntaxError,
            senderID, threadID, isGroup, messageID
        } = ctx;
        const { GoatBot } = global;

        // <<< --- onReaction LOGIC --- >>>
        // Global adminOnly / whitelist gate — silent skip for everyone else.
        if (!isAllowedByAccessMode(config, undefined, threadID, isGroup, senderID)) return;
        const { onReaction } = GoatBot;
        // Always look up by String — the map is populated with String(messageID)
        // whenever a command sends a message (see sendMessage.js / e2ee.js), but
        // incoming reaction events (especially E2EE ones) can carry messageID as
        // a Number. Map.get() is strict-equality, so without this coercion the
        // lookup silently misses and the reaction is never dispatched.
        const reactionKey = String(messageID);
        const Reaction = onReaction.get(reactionKey) || onReaction.get(messageID);
        if (!Reaction) return;
        Reaction.delete = () => { onReaction.delete(reactionKey); onReaction.delete(messageID); };
        const commandName = Reaction.commandName;
        if (!commandName) {
            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "cannotFindCommandName"));
            return log.err("onReaction", `Can't find command name to execute this reaction!`, Reaction);
        }
        const command = GoatBot.commands.get(commandName);
        if (!command) {
            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "cannotFindCommand", commandName));
            return log.err("onReaction", `Command "${commandName}" not found`, Reaction);
        }
        const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
        const time = getTime("DD/MM/YYYY HH:mm:ss");
        try {
            if (!command) throw new Error(`Cannot find command with commandName: ${commandName}`);
            const args = [];
            createMessageSyntaxError(commandName);
            await command.onReaction({ ...parameters, Reaction, args, commandName, getLang: getText2 });
            log.info("onReaction", `${commandName} | ${userData?.name || "Unknown"} | ${senderID} | ${threadID} | ${event.reaction}`);
        } catch (err) {
            log.err("onReaction", `An error occurred when calling the command onReaction ${commandName}`, err);
            await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred4", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
        }
    };
};
