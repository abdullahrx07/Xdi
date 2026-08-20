// includes/handler/shared.js
// Common helpers + per-event context builder shared by onStart, onReply,
// onReaction and onEvent. Anything that was duplicated across those 4 files
// lives here now — each handler only keeps the logic that's actually unique
// to it (its own trigger condition + its own onXxx call).

const fs = require("fs-extra");
const nullAndUndefined = [undefined, null];

function getType(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

function getRole(threadData, senderID) {
    const config = global.GoatBot.config;
    const adminBot = config.adminBot || [];
    const developer = config.developer || [];
    const vipuser = config.vipuser || [];

    if (!senderID) return 0;
    const adminBox = threadData ? threadData.adminIDs || [] : [];

    if (developer.includes(senderID)) return 4;
    if (adminBot.includes(senderID)) return 3;
    if (vipuser.includes(senderID)) return 2;
    if (adminBox.includes(senderID)) return 1;
    return 0;
}

function getBanText(type, reason, time, targetID, lang) {
    const utils = global.utils;
    if (type == "userBanned") return utils.getText({ lang, head: "handlerOnStart" }, "userBanned", reason, time, targetID);
    else if (type == "threadBanned") return utils.getText({ lang, head: "handlerOnStart" }, "threadBanned", reason, time, targetID);
}

function replaceShortcutInLang(text, prefix, commandName) {
    return text
        .replace(/\{(?:p|prefix)\}/g, prefix)
        .replace(/\{(?:n|name)\}/g, commandName)
        .replace(/\{pn\}/g, `${prefix}${commandName}`);
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
    let roleConfig;
    if (utils.isNumber(command.config.role)) {
        roleConfig = { onStart: command.config.role };
    } else if (typeof command.config.role == "object" && !Array.isArray(command.config.role)) {
        if (!command.config.role.onStart) command.config.role.onStart = 0;
        roleConfig = command.config.role;
    } else {
        roleConfig = { onStart: 0 };
    }

    if (isGroup) roleConfig.onStart = threadData.data.setRole?.[commandName] ?? roleConfig.onStart;

    for (const key of ["onChat", "onStart", "onReaction", "onReply"]) {
        if (roleConfig[key] == undefined) roleConfig[key] = roleConfig.onStart;
    }

    return roleConfig;
}

function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, lang) {
    const config = global.GoatBot.config;
    const { hideNotiMessage } = config;

    const infoBannedUser = userData?.banned || {};
    if (infoBannedUser.status == true) {
        const { reason, date } = infoBannedUser;
        if (hideNotiMessage.userBanned == false) message.reply(getBanText("userBanned", reason, date, senderID, lang));
        return true;
    }

    // ——————————————— WHITELIST MODE ——————————————— //
    // If whiteListMode is enabled, only whiteListIds (+ adminBot + developer)
    // are allowed to use the bot. Commands listed in ignoreCommand are exempt
    // and can be used by everyone even while whitelist is on.
    // NOTE: blocked users get NO reply at all (fully silent) — the bot just
    // ignores their command/trigger as if it never happened.
    const wl = config.whiteListMode || {};
    if (wl.status === true) {
        const ignoredCmds = Array.isArray(wl.ignoreCommand) ? wl.ignoreCommand : [];
        if (!ignoredCmds.includes(commandName)) {
            const allowed = [
                ...(config.adminBot || []),
                ...(config.developer || []),
                ...(wl.whiteListIds || [])
            ];
            if (!allowed.includes(senderID)) {
                return true; // silent block — no message.reply
            }
        }
    }
    // ————————————————————————————————————————————— //

    // ——————————————— ADMIN ONLY MODE ——————————————— //
    // If adminOnlyMode is enabled, only bot admins (config.adminBot /
    // developer) plus group admins (threadData.adminIDs, when in a group)
    // can use ANY command/prefix/onReply/onReaction — including things like
    // baby.js, prefix.js, etc. Commands in ignoreCommand are still exempt.
    // NOTE: blocked users get NO reply at all (fully silent).
    const aom = config.adminOnlyMode || {};
    if (aom.status === true) {
        const ignoredCmds = Array.isArray(aom.ignoreCommand) ? aom.ignoreCommand : [];
        if (!ignoredCmds.includes(commandName)) {
            const role = getRole(threadData, senderID);
            // role >= 1 covers: group admin (1), vip (2), adminBot (3), developer (4)
            if (role < 1) {
                return true; // silent block — no message.reply
            }
        }
    }
    // ————————————————————————————————————————————— //

    if (isGroup == true && threadData) {
        const infoBannedThread = threadData.banned;
        if (infoBannedThread.status == true) {
            const { reason, date } = infoBannedThread;
            if (hideNotiMessage.threadBanned == false) message.reply(getBanText("threadBanned", reason, date, threadID, lang));
            return true;
        }
    }
    return false;
}

function createGetText2(langCode, pathCustomLang, prefix, command) {
    const commandType = command.config.countDown ? "command" : "command event";
    const commandName = command.config.name;
    let customLang = {};
    if (fs.existsSync(pathCustomLang)) customLang = require(pathCustomLang)[commandName]?.text || {};

    return function (key, ...args) {
        let lang = command.langs?.[langCode]?.[key] || customLang[key] || "";
        lang = replaceShortcutInLang(lang, prefix, commandName);
        for (let i = args.length - 1; i >= 0; i--) {
            lang = lang.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
        }
        return lang || `❌ Can't find text on language "${langCode}" for ${commandType} "${commandName}" with key "${key}"`;
    };
}

function removeCommandNameFromBody(body_, prefix_, commandName_) {
    if ([body_, prefix_, commandName_].every(x => nullAndUndefined.includes(x))) throw new Error("Please provide body, prefix and commandName to use this function, this function without parameters only support for onStart");
    for (let i = 0; i < arguments.length; i++) if (typeof arguments[i] != "string") throw new Error(`The parameter "${i + 1}" must be a string, but got "${getType(arguments[i])}"`);
    return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
}

/**
 * Builds everything that onStart / onReply / onReaction / onEvent all need
 * before they can run their own specific logic: loads/creates thread & user
 * data, resolves prefix/role/lang, and prepares the shared `parameters`
 * object passed into every command lifecycle method.
 *
 * Returns null when the event should simply be ignored (no threadID, or the
 * thread is stuck failing to create).
 */
async function buildContext({ api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData, event, message }) {
    const { utils, client, GoatBot } = global;
    const { getPrefix, removeHomeDir, log, getTime } = utils;
    const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
    const { autoRefreshThreadInfoFirstTime } = config.database;
    let { hideNotiMessage = {} } = config;

    const { body, messageID, threadID, isGroup } = event;

    if (!threadID) return null;

    const senderID = event.userID || event.senderID || event.author;

    let threadData = global.db.allThreadData.find(t => t.threadID == threadID);
    let userData = global.db.allUserData.find(u => u.userID == senderID);

    const isValidID = id => !isNaN(id) || (typeof id === 'string' && id.includes('@'));

    if (!userData && isValidID(senderID)) userData = await usersData.create(senderID);

    if (!threadData && isValidID(threadID)) {
        const lastFailedAt = global.temp.createThreadDataError.get(threadID);
        if (lastFailedAt && (Date.now() - lastFailedAt) < 60 * 1000) return null;
        try {
            threadData = await threadsData.create(threadID);
            global.temp.createThreadDataError.delete(threadID);
            global.db.receivedTheFirstMessage[threadID] = true;
        } catch (err) {
            if (err.name != "DATA_ALREADY_EXISTS") {
                global.temp.createThreadDataError.set(threadID, Date.now());
                log.err("DATABASE", `Can't create thread data for ${threadID}`, err.message || err);
                return null;
            }
            threadData = global.db.allThreadData.find(t => t.threadID == threadID);
            if (!threadData) return null;
        }
    } else {
        if (autoRefreshThreadInfoFirstTime === true && !global.db.receivedTheFirstMessage[threadID]) {
            global.db.receivedTheFirstMessage[threadID] = true;
            await threadsData.refreshInfo(threadID);
        }
    }

    // Guard: if threadID didn't pass isValidID (unusual/malformed ID format,
    // seen on some E2EE bridge edge-cases) threadData was never created above
    // and is still undefined here. Every access below (.settings, .data,
    // .banned, .isGroup) would throw a TypeError and silently kill the whole
    // event pipeline for that message. Bail out cleanly instead.
    if (!threadData) {
        log.err("DATABASE", `No thread data available for ${threadID}, skipping event`);
        return null;
    }

    // For E2EE events, `event.isGroup` is only a best-effort guess based on
    // the chat JID's suffix (see e2ee.js _mapMsg) — @msgr JIDs are shared by
    // both 1-1 DMs and groups, so that guess can't be fully trusted. Once we
    // have real threadData (created via getThreadInfo, which resolves the
    // true Facebook thread_type), prefer that value instead. This is what
    // fixes E2EE inbox/DM chats that were being silently treated as groups
    // (and hitting group-only checks like adminOnly) because of the guess.
    let resolvedIsGroup = isGroup;
    if (threadData && typeof threadData.isGroup === "boolean") resolvedIsGroup = threadData.isGroup;
    if (resolvedIsGroup !== isGroup) event.isGroup = resolvedIsGroup;

    if (typeof threadData.settings.hideNotiMessage == "object") hideNotiMessage = threadData.settings.hideNotiMessage;

    const prefix = getPrefix(threadID);
    const role = getRole(threadData, senderID);
    const parameters = {
        api, usersData, threadsData, message, event,
        userModel, threadModel, prefix, dashBoardModel,
        globalModel, dashBoardData, globalData, envCommands,
        envEvents, envGlobal, role,
        removeCommandNameFromBody
    };
    const langCode = threadData.data.lang || config.language || "en";

    function createMessageSyntaxError(commandName) {
        message.SyntaxError = async function () {
            return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "commandSyntaxError", prefix, commandName));
        };
    }

    return {
        utils, client, GoatBot, getPrefix, removeHomeDir, log, getTime,
        config, envGlobal, envCommands, envEvents,
        body, messageID, threadID, isGroup: resolvedIsGroup, senderID,
        threadData, userData, hideNotiMessage, prefix, role,
        parameters, langCode, createMessageSyntaxError
    };
}

module.exports = {
    nullAndUndefined,
    getType,
    getRole,
    getBanText,
    replaceShortcutInLang,
    getRoleConfig,
    isBannedOrOnlyAdmin,
    createGetText2,
    removeCommandNameFromBody,
    buildContext
};
