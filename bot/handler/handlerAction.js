const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");

module.exports = (
  api,
  threadModel,
  userModel,
  dashBoardModel,
  globalModel,
  usersData,
  threadsData,
  dashBoardData,
  globalData
) => {
  const handlerEvents = require(
    process.env.NODE_ENV == "development"
      ? "./handlerEvents.dev.js"
      : "./handlerEvents.js"
  )(
    api,
    threadModel,
    userModel,
    dashBoardModel,
    globalModel,
    usersData,
    threadsData,
    dashBoardData,
    globalData
  );

  return async function (event) {
    // ✅ Anti-Inbox Protection
    // E2EE events always have isE2EE:true — never block them here regardless
    // of antiInbox, because their threadID is a JID (not a numeric senderID)
    // so the senderID == threadID check would false-positive on E2EE DMs.
    if (
      !event.isE2EE &&
      global.GoatBot.config.antiInbox == true &&
      (event.senderID == event.threadID ||
        event.userID == event.senderID ||
        event.isGroup == false) &&
      (event.senderID || event.userID || event.isGroup == false)
    )
      return;

    const message = createFuncMessage(api, event);
    await handlerCheckDB(usersData, threadsData, event);

    const handlerChat = await handlerEvents(event, message);
    if (!handlerChat) return;

    const {
      onAnyEvent,
      onFirstChat,
      onStart,
      onChat,
      onReply,
      onEvent,
      handlerEvent,
      onReaction,
      typ,
      presence,
      read_receipt
    } = handlerChat;

    onAnyEvent();

    switch (event.type) {
      case "message":
      case "message_reply":
      case "message_unsend":
      // ── E2EE equivalents ──────────────────────────────────────────────────
      // e2ee.js maps incoming E2EE messages to:
      //   "e2ee_message"   → plain message (no reply)
      //   "message_reply"  → already mapped above (E2EE reply)
      // Both need the same command-dispatch chain as a normal message.
      case "e2ee_message":
        onFirstChat();
        onChat();
        onStart();
        onReply();
        break;

      case "event":
        handlerEvent();
        onEvent();
        break;

      // E2EE reactions arrive as "e2ee_message_reaction"
      case "e2ee_message_reaction":
      case "message_reaction":
        onReaction();

        // 💣 React-Unsend System
        try {
          const cfg = global.GoatBot.config.reactUnsend || {};
          const adminIDs = global.GoatBot.config.adminBot || [];
          const isAdmin = adminIDs.includes(event.userID || event.senderID);

          if (
            cfg.enable &&
            cfg.emojis?.includes(event.reaction) &&
            (!cfg.onlyAdmin || isAdmin)
          ) {
            await api.unsendMessage(event.messageID);
          }
        } catch (err) {
          console.error("❌ React-Unsend Error:", err);
        }

        break;

      case "typ":
        typ();
        break;

      case "presence":
        presence();
        break;

      case "read_receipt":
        read_receipt();
        break;

      // E2EE lifecycle events — no bot action needed, just swallow them silently
      case "e2ee_ready":
      case "e2ee_fully_ready":
      case "e2ee_connected":
      case "e2ee_disconnected":
      case "e2ee_device_data_changed":
      case "e2ee_receipt":
      case "e2ee_message_edit":
        break;

      default:
        break;
    }
  };
};
