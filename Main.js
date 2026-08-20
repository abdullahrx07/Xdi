/**
 *  GOATBOT V3 
 *  NOTES : THIS CODE MADE BY RX @RX_ABDULLAH007 (GIVE CREDIT OTHERWISE EVERYONE FUCK YOU AT 300 KM SPEED)
 **/

process.on('unhandledRejection', error => console.log(error));
process.on('uncaughtException', error => console.log(error));

// ——————————— IMPORTS ——————————— //
const defaultRequire = require;
const gradient = defaultRequire("gradient-string");
const axios = defaultRequire("axios");
const fs = defaultRequire("fs-extra");
const path = defaultRequire("path");
const readline = defaultRequire("readline");
const login = require("@rxabdullah/xdi-fca");
const https = defaultRequire("https");
const { execSync } = require('child_process');
const log = require('./utils/logger/log.js');

process.stdout.write("\x1b]2;GOAT BOT V3 - MADE BY RX\x1b\x5c");
process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0;

// ——————————— GLOBAL UTILS & VARIABLES ——————————— //
const { writeFileSync, readFileSync, existsSync, watch } = require("fs-extra");
const handlerWhenListenHasError = require("./includes/rX/handlerWhenListenHasError.js");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ——————————— CONFIG PATH FUNCTIONS ——————————— //
function getConfigPath(baseName, ext = ".json") {
	const devPath = path.join(__dirname, `${baseName}.dev${ext}`);
	const normalPath = path.join(__dirname, `${baseName}${ext}`);
	if (fs.existsSync(devPath)) return devPath;
	if (fs.existsSync(normalPath)) return normalPath;
	throw new Error(`Missing ${baseName}${ext} or ${baseName}.dev${ext}`);
}

function validJSON(pathDir) {
	if (!fs.existsSync(pathDir)) throw new Error(`File "${pathDir}" not found`);
	execSync(`npx jsonlint "${pathDir}"`, { stdio: 'pipe' });
	return true;
}

// ——————————— CONFIG FILES ——————————— //
const dirConfig = getConfigPath("config", ".json");
const dirConfigCommands = getConfigPath("configCommands", ".json");
const dirAccount = getConfigPath("account", ".txt");

[dirConfig, dirConfigCommands].forEach(pathDir => validJSON(pathDir));

// Load config files once
const config = require(dirConfig);
const configCommands = require(dirConfigCommands);

// ——————————— GLOBAL OBJECTS ——————————— //
global.GoatBot = {
	startTime: Date.now() - process.uptime() * 1000,
	commands: new Map(),
	eventCommands: new Map(),
	aliases: new Map(),
	onFirstChat: [],
	onChat: [],
	onEvent: [],
	onReply: new Map(),
	onReaction: new Map(),
	onAnyEvent: [],
	config: config,
	configCommands: configCommands,
	envCommands: configCommands.envCommands,
	envEvents: configCommands.envEvents,
	envGlobal: configCommands.envGlobal,
	reLoginBot: function () { },
	Listening: null
};

// utils load after global exists
global.utils = require("./utils/utils.js");
const { colors, getText } = global.utils;

// ——————————— DATABASE / CLIENT / TEMP ——————————— //
global.db = {
	allThreadData: [],
	allUserData: [],
	allDashBoardData: [],
	allGlobalData: [],
	threadModel: null,
	userModel: null,
	dashboardModel: null,
	globalModel: null,
	threadsData: null,
	usersData: null,
	dashBoardData: null,
	globalData: null,
	receivedTheFirstMessage: {}
};

global.client = {
	dirConfig,
	dirConfigCommands,
	dirAccount,
	countDown: {},
	cache: {},
	database: {
		creatingThreadData: [],
		creatingUserData: [],
		creatingDashBoardData: [],
		creatingGlobalData: []
	},
	commandBanned: configCommands.commandBanned
};

global.temp = {
	createThreadData: [],
	createUserData: [],
	// Map<threadID, lastFailureTimestamp> — a thread that failed to create
	// (e.g. a transient api.getThreadInfo error) is only skipped for a short
	// cooldown, then retried on the next incoming message, instead of being
	// silently ignored forever until the bot restarts.
	createThreadDataError: new Map(),
	filesOfGoogleDrive: { arraybuffer: {}, stream: {}, fileNames: {} },
	contentScripts: { cmds: {}, events: {} }
};

// ——————————— CONFIG WATCHER ——————————— //
const watchAndReloadConfig = (dir, type, prop, logName) => {
	let lastModified = fs.statSync(dir).mtimeMs;
	fs.watch(dir, (eventType) => {
		if (eventType === type) {
			const oldConfig = global.GoatBot[prop];
			setTimeout(() => {
				try {
					// NOTE: previously a "skip the first change" flag lived
					// here, meant to ignore the fs.watch fire caused by the
					// bot's own initial file touch. In practice it also
					// swallowed the FIRST real edit made after boot (e.g.
					// the very first {p}adminonly on / off), so the in-memory
					// config silently never updated on that first toggle —
					// only a second save (or a full restart) would apply it.
					// mtimeMs comparison below already prevents redundant
					// reloads, so the extra flag wasn't needed.
					if (lastModified === fs.statSync(dir).mtimeMs) return;
					global.GoatBot[prop] = JSON.parse(fs.readFileSync(dir, 'utf-8'));
					log.success(logName, `Reloaded ${dir.replace(process.cwd(), "")}`);
				} catch {
					log.warn(logName, `Can't reload ${dir.replace(process.cwd(), "")}`);
					global.GoatBot[prop] = oldConfig;
				} finally {
					lastModified = fs.statSync(dir).mtimeMs;
				}
			}, 200);
		}
	});
};

watchAndReloadConfig(dirConfigCommands, 'change', 'configCommands', 'CONFIG COMMANDS');
watchAndReloadConfig(dirConfig, 'change', 'config', 'CONFIG');

// ——————————— BOT STARTUP LOGIC ——————————— //
const axiosInstance = axios.create({
	timeout: 30000,
	httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 10 })
});

const { dirAccount: accountFile } = global.client;

function filterKeysAppState(appState) {
	return appState.filter(item => ["c_user", "xs", "datr", "fr", "sb", "i_user"].includes(item.key || item.name));
}

async function stopListening() {
	return new Promise(resolve => global.GoatBot.fcaApi?.stopListening?.(() => resolve()) || resolve());
}

async function safeGetUserName(userID, api) {
	try {
		const userInfo = await api.getUserInfo(userID);
		return userInfo[userID]?.name || `User_${userID}`;
	} catch {
		return `User_${userID}`;
	}
}

async function startBot() {
	console.log(colors.hex("#f5ab00")("──────────────────────────────────────────────────"));
	if (global.GoatBot.Listening) await stopListening();
	if (!existsSync(accountFile)) { log.error("LOGIN", "Account file not found!"); process.exit(); }

	let appState;
	try { appState = JSON.parse(readFileSync(accountFile, "utf8")); }
	catch { log.error("LOGIN", "Invalid appstate.json format!"); process.exit(); }

	log.info("LOGIN", "Logging in with FCA...");
	const e2eeConfig = config.e2ee || {};
	const fcaOptions = {
		...config.optionsFca,
		enableE2EE: e2eeConfig.enable === true,
		e2eeMemoryOnly: e2eeConfig.saveType !== "path",
		...(e2eeConfig.devicePath ? { e2eeDevicePath: e2eeConfig.devicePath } : {}),
		...(e2eeConfig.deviceData ? { e2eeDeviceData: e2eeConfig.deviceData } : {})
	};
	login({ appState }, fcaOptions, async (error, api) => {
		if (error) { log.err("LOGIN", "FCA Login Failed:", error); return process.exit(); }

		global.GoatBot.fcaApi = api;
		global.botID = api.getCurrentUserID();

		log.info("LOGIN", "Login Success!");
		console.log(colors.hex("#f5ab00")("───────────────── BOT INFO ─────────────────"));

		const botName = await safeGetUserName(global.botID, api);
		log.info("BOT ID", `${global.botID} - ${botName}`);
		log.info("PREFIX", global.GoatBot.config.prefix);

		if (config.autoRefreshFbstate) {
			const newState = api.getAppState();
			writeFileSync(accountFile, JSON.stringify(filterKeysAppState(newState), null, 2));
			log.info("REFRESH", "Appstate updated successfully.");
		}

		const { threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData } =
			await require("./includes/rX/loadData.js")(api, c => c);

		global.GoatBot.usersData = usersData;

		await require("./includes/custom.js")({ api, threadsData, usersData, globalData, getText });
		await require("./includes/rX/loadScripts.js")(api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, c => c);

		function callBackListen(err, event) {
			if (err) { log.err("LISTEN", "Connection Error, attempting restart..."); return setTimeout(() => startBot(), 5000); }

			const handlerAction = require("./includes/listen.js")(
				api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData
			);
			handlerAction(event);
		}

		global.GoatBot.Listening = api.listenMqtt(callBackListen);

		// E2EE: without this call the bridge only ever connects lazily
		// (e.g. when api.sendMessage targets an @msgr/@g.us JID), and in
		// that lazy path no callback is registered — so incoming e2ee
		// messages/reactions/receipts are decrypted internally but never
		// forwarded to callBackListen, and no command ever fires even
		// though outgoing sends to e2ee threads work fine.
		if (typeof api.connectE2EE === "function") {
			try {
				await api.connectE2EE(callBackListen);
				log.info("E2EE", "E2EE bridge connected and wired to the listener.");
			} catch (e) {
				log.warn("E2EE", "Failed to connect E2EE bridge:", e && e.message ? e.message : e);
			}
		}

		log.master("SUCCESS", "Bot is now active and listening to messages!");
	});
}

global.GoatBot.reLoginBot = startBot;

// ——————————— START BOT ——————————— //
// Git auto update no longer blocks boot (this used to time out deploys on
// hosts like Render). It now runs silently in the background after login —
// see modules/cmds/update.js (onLoad starts includes/rX/updateNotifier.js).
startBot();
