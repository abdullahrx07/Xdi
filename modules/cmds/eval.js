const util = require("util");

module.exports = {
  config: {
    name: "eval",
    version: "1.0",
    author: "rX",
    countDown: 0,
    role: 2,
    shortDescription: "Run JavaScript code",
    longDescription: "Execute JavaScript with full bot access",
    category: "owner",
    guide: {
      en: "{pn} <code>"
    }
  },

  onStart: async function ({ message, args, api, event, usersData, threadsData, globalData }) {
    const code = args.join(" ");

    if (!code) {
      return message.reply("❌ Please provide JavaScript code.\n\nExample:\n/eval 1+1");
    }

    try {
      let result = await (async () => eval(code))();

      if (typeof result !== "string")
        result = util.inspect(result, { depth: 2 });

      if (result.length > 1900)
        result = result.slice(0, 1900) + "\n...output truncated";

      return message.reply(
        `🧪 EVAL RESULT\n────────────\n${result}`
      );

    } catch (err) {
      return message.reply(
        `❌ EVAL ERROR\n────────────\n${err.stack || err.toString()}`
      );
    }
  }
};
