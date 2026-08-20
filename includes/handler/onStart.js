// onStart.js
const leven = require('leven');
const { getRoleConfig, isBannedOrOnlyAdmin, createGetText2, removeCommandNameFromBody, buildContext } = require("./shared");

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
    return async function (event, message) {
        const ctx = await buildContext({ api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData, event, message });
        if (!ctx) return;
        const {
            utils, client, log, removeHomeDir, getTime, config,
            threadData, userData, hideNotiMessage, prefix, role,
            parameters, langCode, createMessageSyntaxError,
            senderID, threadID, isGroup, body
        } = ctx;
        const { GoatBot } = global;

        // <<< --- onStart LOGIC --- >>>
        // Admin no-prefix users
        const adminNoPrefixUsers = [...(config.adminBot || []), ...(config.developer || []), ...(config.whiteListMode?.whiteListIds || [])];

        let command, commandName, args = [];
        const dateNow = Date.now();

        if (!body) return;

        if (!body.startsWith(prefix)) {
            if (adminNoPrefixUsers.includes(senderID)) {
                const allCommands = Array.from(GoatBot.commands.keys());

                // First, check primary commands
                let matchCommand = null;
                let remainingBody = "";

                for (const cmd of allCommands) {
                    const lowerCmd = cmd.toLowerCase();
                    if (body.toLowerCase() === lowerCmd || body.toLowerCase().startsWith(lowerCmd + " ")) {
                        matchCommand = cmd;
                        remainingBody = body.slice(cmd.length).trim();
                        break;
                    }
                }

                // If no primary match, check global aliases
                if (!matchCommand) {
                    for (const [alias, realCmd] of GoatBot.aliases.entries()) {
                        const lowerAlias = alias.toLowerCase();
                        if (body.toLowerCase() === lowerAlias || body.toLowerCase().startsWith(lowerAlias + " ")) {
                            matchCommand = realCmd;  // Assuming GoatBot.aliases maps alias -> primary name
                            remainingBody = body.slice(alias.length).trim();
                            break;
                        }
                    }
                }

                // Then, check thread-specific aliases
                if (!matchCommand) {
                    const aliasesData = threadData.data.aliases || {};
                    for (const cmdKey in aliasesData) {
                        for (const alias of aliasesData[cmdKey]) {
                            const lowerAlias = alias.toLowerCase();
                            if (body.toLowerCase() === lowerAlias || body.toLowerCase().startsWith(lowerAlias + " ")) {
                                matchCommand = cmdKey;
                                remainingBody = body.slice(alias.length).trim();
                                break;
                            }
                        }
                        if (matchCommand) break;
                    }
                }

                if (matchCommand) {
                    commandName = matchCommand;
                    command = GoatBot.commands.get(commandName);
                    args = remainingBody ? remainingBody.split(/ +/) : [];
                } else return; // Not a known command, ignore
            } else return; // normal user without prefix -> ignore
        } else {
            // === PREFIX FLOW ===
            args = body.slice(prefix.length).trim().split(/ +/);
            let cmdName = args.shift().toLowerCase();
            commandName = cmdName;
            command = GoatBot.commands.get(cmdName) || GoatBot.commands.get(GoatBot.aliases.get(cmdName));

            const aliasesData = threadData.data.aliases || {};
            for (const cmdKey in aliasesData) {
                if (aliasesData[cmdKey].includes(cmdName)) {
                    command = GoatBot.commands.get(cmdKey);
                    cmdName = cmdKey;
                    break;
                }
            }
            if (command) commandName = command.config.name;
        }
        if (command) commandName = command.config.name;

        if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;
        if (!command) {
            if (!hideNotiMessage.commandNotFound) {
                const allCommands = Array.from(GoatBot.commands.keys());
                let closestCommand = null;
                let minDistance = 999;
                const distanceThreshold = 2;
                if (commandName) {
                    for (const correctCommand of allCommands) {
                        const distance = leven(commandName.toLowerCase(), correctCommand.toLowerCase());
                        if (distance < minDistance && distance <= distanceThreshold) {
                            minDistance = distance;
                            closestCommand = correctCommand;
                        }
                    }
                }
                if (closestCommand) {
                    return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "commandNotFoundSuggestion", closestCommand, prefix));
                } else {
                    return await message.reply(commandName ? utils.getText({ lang: langCode, head: "handlerOnStart" }, "commandNotFound", commandName, prefix) : utils.getText({ lang: langCode, head: "handlerOnStart" }, "commandNotFound2", prefix));
                }
            } else return true;
        }
        const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
        const needRole = roleConfig.onStart;
        if (needRole > role) {
            if (!hideNotiMessage.needRoleToUseCmd) {
                if (needRole == 1) return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "onlyAdmin", commandName));
                else if (needRole == 2) return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "onlyAdminBot2", commandName));
                else if (needRole == 3) return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "onlyVipUser", commandName));
                else if (needRole == 4) return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "onlyDeveloper", commandName));
            } else return true;
        }
        if (!client.countDown[commandName]) client.countDown[commandName] = {};
        const timestamps = client.countDown[commandName];
        let getCoolDown = command.config.countDown;
        if (!getCoolDown && getCoolDown != 0 || isNaN(getCoolDown)) getCoolDown = 1;
        const cooldownCommand = getCoolDown * 1000;
        if (timestamps[senderID]) {
            const expirationTime = timestamps[senderID] + cooldownCommand;
            if (dateNow < expirationTime) return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "waitingForCommand", ((expirationTime - dateNow) / 1000).toString().slice(0, 3)));
        }
        const time = getTime("DD/MM/YYYY HH:mm:ss");
        try {
            (async () => {
                const analytics = await globalData.get("analytics", "data", {});
                if (!analytics[commandName]) analytics[commandName] = 0;
                analytics[commandName]++;
                await globalData.set("analytics", analytics, "data");
            })();
            createMessageSyntaxError(commandName);
            const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
            await command.onStart({ ...parameters, args, commandName, getLang: getText2, removeCommandNameFromBody });
            timestamps[senderID] = dateNow;
            log.info("CALL COMMAND", `${commandName} | ${userData?.name || "Unknown"} | ${senderID} | ${threadID} | ${args.join(" ")}`);
        } catch (err) {
            log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
            return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
        }
    };
};
