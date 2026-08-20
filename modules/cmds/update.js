const fs = require("fs-extra");
const path = require("path");
const {
  checkAndSelfUpdate,
  getPendingUpdate,
  applyPendingUpdate
} = require("../../includes/rX/autoUpdate.js");
const { startBackgroundUpdateChecker, CONFIRM_EMOJIS } = require("../../includes/rX/updateNotifier.js");

module.exports = {
  config: {
    name: "update",
    aliases: ["gitupdate", "selfupdate"],
    version: "2.0",
    author: "EryXenX",
    countDown: 10,
    role: 3,
    category: "owner",
    description: {
      vi: "Kiểm tra và tự động cập nhật bot từ GitHub repo (config.json > gitUpdate)",
      en: "Check config.json > gitUpdate.url on GitHub and self-update the bot if a newer version exists"
    },
    guide: {
      vi: "   {pn}: Áp dụng bản cập nhật đã tải sẵn (nếu có), hoặc kiểm tra + cập nhật ngay",
      en: "   {pn}: Applies an already-downloaded update if one is staged, otherwise checks for and applies the latest update right away"
    }
  },

  langs: {
    vi: {
      notAdmin: "🚫 | Chỉ admin bot mới có thể dùng lệnh này.",
      checking: "🔍 | Đang kiểm tra bản cập nhật...",
      applyingStaged: "📦 | Đã có bản cập nhật v%1 tải sẵn. Đang áp dụng...",
      upToDate: "✅ | Bot đã ở phiên bản mới nhất (v%1).",
      noRepo: "⚠ | Chưa cấu hình repo GitHub. Vui lòng đặt config.json > gitUpdate.url.",
      error: "💥 | Kiểm tra cập nhật thất bại:\n%1",
      reactionApplying: "📦 | Đã xác nhận! Đang áp dụng bản cập nhật v%1...",
      reactionNotAdmin: "🚫 | Chỉ admin bot mới có thể xác nhận cập nhật.",
    },
    en: {
      notAdmin: "🚫 | This command is restricted to bot admins only.",
      checking: "🔍 | Checking for updates...",
      applyingStaged: "📦 | Version v%1 was already downloaded in the background. Applying it now...",
      upToDate: "✅ | Bot is already up to date (v%1).",
      noRepo: "⚠ | No GitHub repo configured. Set config.json > gitUpdate.url first.",
      error: "💥 | Update check failed:\n%1",
      reactionApplying: "📦 | Confirmed! Applying update v%1 now...",
      reactionNotAdmin: "🚫 | Only bot admins can confirm an update.",
    }
  },

  onLoad({ api }) {
    const tmpDir = path.join(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const pathFile = path.join(tmpDir, "update.txt");
    if (fs.existsSync(pathFile)) {
      setTimeout(() => {
        try {
          const [tid, , fromVersion, toVersion] = fs.readFileSync(pathFile, "utf-8").split(" ");
          api.sendMessage(`✅ | Update applied: v${fromVersion} → v${toVersion}.\n🔄 | Bot restarted successfully and is back online.`, tid);
          fs.unlinkSync(pathFile);
        } catch (e) {
          console.error("Update notify error:", e);
        }
      }, 2000);
    }

    // Kick off the silent background update checker. This is fire-and-forget
    // (setTimeout/setInterval only) so it never delays bot boot/login.
    startBackgroundUpdateChecker({ api });
  },

  onStart: async function ({ message, event, getLang }) {
    const admins = global.GoatBot?.config?.adminBot || [];
    if (!admins.includes(event.senderID)) return message.reply(getLang("notAdmin"));

    // Fast path: a version was already silently downloaded in the
    // background — apply it directly instead of re-downloading.
    const pending = getPendingUpdate(process.cwd());
    if (pending) {
      await message.reply(getLang("applyingStaged", pending.remoteVersion));
      const result = await applyPendingUpdate(process.cwd(), { notifyThreadID: event.threadID });
      // If applyPendingUpdate succeeded it already called process.exit(2);
      // this line only runs if something went wrong.
      if (!result?.applied) return message.reply(getLang("error", "Failed to apply the staged update."));
      return;
    }

    await message.reply(getLang("checking"));

    const result = await checkAndSelfUpdate(process.cwd(), {
      notifyThreadID: event.threadID
    });

    // If an update was found and applied, checkAndSelfUpdate already wrote
    // the restart marker and called process.exit(2) — this line is never
    // reached in that case, the onLoad hook above reports back instead.
    if (result?.error) return message.reply(getLang("error", result.error));
    if (result?.noRepo) return message.reply(getLang("noRepo"));

    return message.reply(getLang("upToDate", result?.localVersion || "?"));
  },

  // Fired when someone reacts to the "new version available" DM sent by the
  // background checker (includes/rX/updateNotifier.js). Reacting ✅ (or a
  // similar thumbs-up/confirm emoji) applies the already-staged update.
  onReaction: async function ({ message, event, Reaction, getLang }) {
    if (!Reaction || Reaction.type !== "confirmStagedUpdate") return;

    const admins = global.GoatBot?.config?.adminBot || [];
    if (!admins.includes(event.userID)) return message.reply(getLang("reactionNotAdmin"));

    if (!CONFIRM_EMOJIS.includes(event.reaction)) {
      // Any other reaction (e.g. ❌) is treated as "not now" — just drop it.
      global.GoatBot.onReaction?.delete(event.messageID);
      return;
    }

    global.GoatBot.onReaction?.delete(event.messageID);

    const pending = getPendingUpdate(process.cwd());
    if (!pending) return; // Nothing staged anymore (already applied or cleared)

    await message.reply(getLang("reactionApplying", pending.remoteVersion));
    await applyPendingUpdate(process.cwd(), { notifyThreadID: event.threadID });
  }
};
