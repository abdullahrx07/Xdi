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
    // Role system:
    //   0 = all (everyone)
    //   1 = bot admin only
    //   2 = bot admin + group admin
    //   3 = NDH — bot admin + group admin + whitelist users (highest)
    const config = global.GoatBot.config;
    const adminBot = config.adminBot || [];
    const ids = config.whitelist?.ids || [];

    if (!senderID) return 0;
    const adminBox = threadData ? (threadData.adminIDs || []) : [];

    if (adminBot.includes(senderID)) return 1; // bot admin → role 1
    if (adminBox.includes(senderID)) return 2;  // group admin → role 2 (bot admin already returned above)
    if (ids.includes(senderID)) return 3; // whitelist/NDH → role 3
    return 0;
}


/**
 * Global access-mode gate — checked once per event, before ANY command,
 * onChat/onFirstChat/onAnyEvent, event-command, or auto-trigger onEvent
 * (welcome/leave/logsbot/checkwarn/autoUpdateInfoThread/etc.) is allowed
 * to run.
 *
 *   adminOnly.status = true       -> only senderIDs directly listed in
 *                                    config.adminBot may get ANY
 *                                    response/trigger (senderID is
 *                                    matched against config.adminBot
 *                                    directly — an exact ID match, no
 *                                    derived permission level involved).
 *                                    Everyone else is skipped completely
 *                                    and silently (no reply, no
 *                                    auto-trigger event runs).
 *   whitelist.status = true       -> only senderIDs directly listed in
 *                                    config.adminBot or config.whitelist.ids
 *                                    may get a response/trigger (same
 *                                    direct ID-match approach as
 *                                    adminOnly above). Everyone else is
 *                                    skipped completely and silently.
 *   whitelist.threadStatus = true -> the bot only responds/triggers inside
 *                                    group threads whose threadID is listed
 *                                    in config.whitelist.threadIds (E2EE
 *                                    group JIDs like "12345@g.us" work the
 *                                    same as classic numeric thread IDs —
 *                                    it's a plain string match either way).
 *                                    Any group thread NOT in that list is
 *                                    skipped completely and silently for
 *                                    everyone except bot admins (see below).
 *                                    1-1 DMs are unaffected by this (it
 *                                    only gates group threads).
 *
 * If both adminOnly and whitelist are enabled, adminOnly wins (stricter
 * of the two). A sender whose ID is directly listed in config.adminBot
 * always passes every check here — matched against config.adminBot
 * directly by senderID, not via any derived permission level, so this
 * can never be affected by role 2 (group admin) or any other
 * role-resolution detail. The bot's own admins must always be able to
 * reach the bot (e.g. to run `whitelist threadadd` inside a group that
 * isn't whitelisted yet, or to turn a mode back off) and must never be
 * able to lock themselves out.
 *
 * ignoreCommand (on either adminOnly or whitelist) lets specific command
 * names stay open to everyone even while the mode is on — e.g. so a
 * "whitelist off" or "adminOnly off" escape hatch command, or a public
 * "help"/"ping", can still be reached. commandName is optional: pass it
 * when checking a specific command (onStart/onChat/onReply/onReaction);
 * leave it undefined for the fully generic auto-trigger events (onEvent/
 * eventCommands/onAnyEvent/onFirstChat), which have no single command
 * name to exempt. The whitelist command itself is always implicitly
 * exempt from the thread gate (see check below) so a bot admin can
 * never get locked out of managing thread whitelist from inside the
 * very group they're trying to add/remove.
 */
function isAllowedByAccessMode(config, commandName, threadID, isGroup, senderID) {
    const adminOnly = config.adminOnly || {};
    const whitelist = config.whitelist || {};
    const adminBot = Array.isArray(config.adminBot) ? config.adminBot : [];

    // Direct senderID <-> config.adminBot match — this is the actual
    // source of truth for "is this a bot admin", not any derived
    // permission level.
    const isBotAdmin = !!senderID && adminBot.includes(senderID);
    if (isBotAdmin) return true; // bot admin always passes every check here

    if (isGroup && whitelist.threadStatus === true) {
        const threadIds = Array.isArray(whitelist.threadIds) ? whitelist.threadIds : [];
        if (!threadID || !threadIds.includes(String(threadID))) return false;
    }

    if (adminOnly.status === true) {
        const ignoreCommand = Array.isArray(adminOnly.ignoreCommand) ? adminOnly.ignoreCommand : [];
        if (commandName && ignoreCommand.includes(commandName)) return true;
        return false;
    }

    if (whitelist.status === true) {
        const ignoreCommand = Array.isArray(whitelist.ignoreCommand) ? whitelist.ignoreCommand : [];
        if (commandName && ignoreCommand.includes(commandName)) return true;
        // Direct senderID <-> config.whitelist.ids match — same pattern as
        // the bot-admin check above: an exact ID match, not any derived
        // permission level.
        const whitelistIds = Array.isArray(whitelist.ids) ? whitelist.ids : [];
        const isWhitelistedUser = !!senderID && whitelistIds.includes(senderID);
        if (isWhitelistedUser) return true;
        return false;
    }

    return true; // neither mode is on -> normal role checks apply as before
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
            // E2EE (Labyrinth) threadIDs are JIDs — api.getThreadInfo() can't
            // resolve those, so build a minimal fallback record instead of
            // letting threadsData.create() call the FB API and throw. Without
            // this, every E2EE thread without an existing DB record (typically
            // every 1-1 E2EE DM, since those never had a "classic" thread to
            // begin with) fails create() here, buildContext() returns null,
            // and onStart/onReply/onReaction/onEvent all silently no-op —
            // the bot looks completely unresponsive in that DM.
            const isJidThreadID = typeof threadID === 'string' && threadID.includes('@');
            const fallbackThreadInfo = isJidThreadID ? {
                threadName: null,
                userInfo: [],
                adminIDs: [],
                nicknames: {},
                emoji: null,
                imageSrc: null,
                approvalMode: null,
                threadTheme: null,
                threadType: isGroup === true ? 2 : 1
            } : undefined;
            threadData = await threadsData.create(threadID, fallbackThreadInfo);
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
            try {
                await threadsData.refreshInfo(threadID);
            } catch (err) {
                // Never let a refresh failure (e.g. a stale/edge-case thread
                // lookup) take down the whole event — worst case the cached
                // threadData is a little stale, not silence.
                log.err("DATABASE", `refreshInfo failed for ${threadID}`, err.message || err);
            }
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
    isAllowedByAccessMode,
    replaceShortcutInLang,
    getRoleConfig,
    createGetText2,
    removeCommandNameFromBody,
    buildContext
};
