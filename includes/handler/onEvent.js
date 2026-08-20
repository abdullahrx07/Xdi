// onEvent.js
const { getType, getRoleConfig, isBannedOrOnlyAdmin, createGetText2, buildContext } = require("./shared");

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
    return async function (event, message) {
        const ctx = await buildContext({ api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData, event, message });
        if (!ctx) return;
        const {
            utils, log, removeHomeDir, getTime,
            threadData, userData, role,
            parameters, langCode, createMessageSyntaxError,
            senderID, threadID, isGroup, body, prefix
        } = ctx;
        const { GoatBot } = global;
        const { author } = event;

        // এখানে যোগ করা হয়েছে → এরর ফিক্স
        let isUserCallCommand = false;

        // onAnyEvent
        let args = [];
        if (typeof event.body == "string" && event.body.startsWith(prefix)) args = event.body.split(/ +/);
        const allOnAnyEvent = GoatBot.onAnyEvent || [];
        for (const key of allOnAnyEvent) {
            if (typeof key !== "string") continue;
            const command = GoatBot.commands.get(key);
            if (!command) continue;
            const commandName = command.config.name;
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);
            if (getType(command.onAnyEvent) == "Function") {
                const defaultOnAnyEvent = command.onAnyEvent;
                command.onAnyEvent = async function () { return defaultOnAnyEvent(...arguments); };
            }
            command.onAnyEvent({ ...parameters, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        try {
                            await handler();
                            log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData?.name || "Unknown"} | ${threadID}`);
                        } catch (err) {
                            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred7", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                            log.err("onAnyEvent", `Error in onAnyEvent ${commandName}`, err);
                        }
                    }
                })
                .catch(err => log.err("onAnyEvent", `Error in onAnyEvent ${commandName}`, err));
        }

        // onFirstChat
        const allOnFirstChat = GoatBot.onFirstChat || [];
        args = body ? body.split(/ +/) : [];
        for (const itemOnFirstChat of allOnFirstChat) {
            const { commandName, threadIDsChattedFirstTime } = itemOnFirstChat;
            if (threadIDsChattedFirstTime.includes(threadID)) continue;
            const command = GoatBot.commands.get(commandName);
            if (!command) continue;
            if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) continue;
            itemOnFirstChat.threadIDsChattedFirstTime.push(threadID);
            const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            if (getType(command.onFirstChat) == "Function") {
                const defaultOnFirstChat = command.onFirstChat;
                command.onFirstChat = async function () { return defaultOnFirstChat(...arguments); };
            }
            command.onFirstChat({ ...parameters, isUserCallCommand, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        try {
                            await handler();
                            log.info("onFirstChat", `${commandName} | ${userData?.name || "Unknown"} | ${senderID} | ${threadID} | ${args.join(" ")}`);
                        } catch (err) {
                            await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                        }
                    }
                })
                .catch(err => log.err("onFirstChat", `Error in onFirstChat ${commandName}`, err));
        }

        // onChat
        const allOnChat = GoatBot.onChat || [];
        args = body ? body.split(/ +/) : [];
        for (const key of allOnChat) {
            const command = GoatBot.commands.get(key);
            if (!command) continue;
            const commandName = command.config.name;
            const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
            const needRole = roleConfig.onChat;
            if (needRole > role) continue;
            if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) continue;
            const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            if (getType(command.onChat) == "Function") {
                const defaultOnChat = command.onChat;
                command.onChat = async function () { return defaultOnChat(...arguments); };
            }
            command.onChat({ ...parameters, isUserCallCommand, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        try {
                            await handler();
                            log.info("onChat", `${commandName} | ${userData?.name || "Unknown"} | ${senderID} | ${threadID} | ${args.join(" ")}`);
                        } catch (err) {
                            await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                        }
                    }
                })
                .catch(err => log.err("onChat", `Error in onChat ${commandName}`, err));
        }

        // handlerEvent
        const allEventCommand = GoatBot.eventCommands.entries();
        for (const [key] of allEventCommand) {
            const getEvent = GoatBot.eventCommands.get(key);
            if (!getEvent) continue;
            const commandName = getEvent.config.name;
            const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, getEvent);
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            try {
                const handler = await getEvent.onStart({ ...parameters, commandName, getLang: getText2 });
                if (typeof handler == "function") {
                    await handler();
                    log.info("EVENT COMMAND", `Event: ${commandName} | ${author} | ${userData?.name || "Unknown"} | ${threadID}`);
                }
            } catch (err) {
                log.err("EVENT COMMAND", `Error in event command ${commandName}`, err);
                await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred5", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
            }
        }

        // onEvent
        const allOnEvent = GoatBot.onEvent || [];
        args = [];
        for (const key of allOnEvent) {
            if (typeof key !== "string") continue;
            const command = GoatBot.commands.get(key);
            if (!command) continue;
            const commandName = command.config.name;
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);
            if (getType(command.onEvent) == "Function") {
                const defaultOnEvent = command.onEvent;
                command.onEvent = async function () { return defaultOnEvent(...arguments); };
            }
            command.onEvent({ ...parameters, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        try {
                            await handler();
                            log.info("onEvent", `${commandName} | ${author} | ${userData?.name || "Unknown"} | ${threadID}`);
                        } catch (err) {
                            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred6", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                            log.err("onEvent", `Error in onEvent ${commandName}`, err);
                        }
                    }
                })
                .catch(err => log.err("onEvent", `Error in onEvent ${commandName}`, err));
        }

        // placeholder functions
        async function presence() { /* Your code here */ }
        async function read_receipt() { /* Your code here */ }
        async function typ() { /* Your code here */ }

        await presence();
        await read_receipt();
        await typ();
    };
};
