const { colors } = require('../func/colors.js');
const moment = require("moment-timezone");

const getCurrentTime = () => colors.gray(moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY"));

// ── level styles: icon + background + text color ──
const LEVELS = {
	ERROR:   { icon: "✖", bg: colors.bgRed,          fg: colors.white },
	WARN:    { icon: "⚠", bg: colors.bgYellow,       fg: colors.black },
	INFO:    { icon: "ℹ", bg: colors.bgBlue,         fg: colors.white },
	SUCCESS: { icon: "✔", bg: colors.bgGreen,        fg: colors.black },
	MASTER:  { icon: "★", bg: colors.bgHex("#eb6734"), fg: colors.white },
};

function badge(level, prefix) {
	const style = LEVELS[level] || LEVELS.INFO;
	const label = ` ${style.icon} ${prefix} `;
	return `\x1b[1m${style.fg(style.bg(label))}\x1b[0m`;
}

function printLine(level, prefix, message) {
	console.log(`${getCurrentTime()} ${badge(level, prefix)}`, message);
}

function logError(prefix, message) {
	if (message === undefined) {
		message = prefix;
		prefix = "ERROR";
	}
	printLine("ERROR", prefix, message);
	const extras = Object.values(arguments).slice(2);
	for (let err of extras) {
		if (typeof err == "object" && err !== null && !err.stack)
			err = JSON.stringify(err, null, 2);
		printLine("ERROR", prefix, err);
	}
}

module.exports = {
	err: logError,
	error: logError,
	warn: function (prefix, message) {
		if (message === undefined) {
			message = prefix;
			prefix = "WARN";
		}
		printLine("WARN", prefix, message);
	},
	info: function (prefix, message) {
		if (message === undefined) {
			message = prefix;
			prefix = "INFO";
		}
		printLine("INFO", prefix, message);
	},
	success: function (prefix, message) {
		if (message === undefined) {
			message = prefix;
			prefix = "SUCCESS";
		}
		printLine("SUCCESS", prefix, message);
	},
	master: function (prefix, message) {
		if (message === undefined) {
			message = prefix;
			prefix = "MASTER";
		}
		printLine("MASTER", prefix, message);
	},
	dev: (...args) => {
		if (["development", "production"].includes(process.env.NODE_ENV) == false)
			return;
		try {
			throw new Error();
		}
		catch (err) {
			const at = err.stack.split('\n')[2];
			let position = at.slice(at.indexOf(process.cwd()) + process.cwd().length + 1);
			position.endsWith(')') ? position = position.slice(0, -1) : null;
			console.log(`\x1b[36m${position} =>\x1b[0m`, ...args);
		}
	}
};
