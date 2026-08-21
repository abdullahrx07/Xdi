/**
 * utils/money.js
 *
 * Wallet helper for game/economy commands (dice, slot, bet, transfer, quizzes, etc).
 *
 * IMPORTANT: This now stores money through the bot's main database
 * (global.db.usersData -> MongoDB, per config.json "database.type": "mongodb"),
 * the SAME store the rest of the bot already uses for user data.
 *
 * Previously this file kept its own separate balance in a local file
 * (data/bot.json). That file lived only on local disk, was listed in
 * .gitignore, and was never part of the bot's real database — so any
 * redeploy / re-clone / fresh restart on a host with an ephemeral
 * filesystem recreated it empty and every user's balance went back to
 * the default. Routing through global.db.usersData fixes that, because
 * it's the same persistent MongoDB connection configured in config.json.
 */

const DEFAULT_BALANCE = 1000;

function getUsersData() {
  const usersData = global.db && global.db.usersData;
  if (!usersData) {
    throw new Error(
      "[money.js] Database isn't connected yet (global.db.usersData missing). " +
      "The bot must finish connecting to MongoDB before any economy command runs."
    );
  }
  return usersData;
}

function toSafeNumber(amount, label) {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    throw new Error(`[money.js] "${label}" must be a valid number, got: ${amount}`);
  }
  return n;
}

module.exports = {
  // Get a user's current balance. Creates the user with the default
  // starting balance the first time they're seen.
  async get(uid) {
    const usersData = getUsersData();
    if (!usersData.existsSync(uid)) {
      await usersData.set(uid, DEFAULT_BALANCE, "money");
      return DEFAULT_BALANCE;
    }
    const current = await usersData.getMoney(uid);
    // Guard against a corrupted/missing value (e.g. null/NaN from old data).
    return Number.isFinite(current) ? current : DEFAULT_BALANCE;
  },

  // Add an amount to a user's balance (use a negative number to deduct
  // without clamping at 0 - see subtract() for the clamped version).
  async add(uid, amount) {
    const usersData = getUsersData();
    const safeAmount = toSafeNumber(amount, "amount");
    if (!usersData.existsSync(uid)) {
      await usersData.set(uid, DEFAULT_BALANCE, "money");
    }
    const updated = await usersData.addMoney(uid, safeAmount);
    return updated.money;
  },

  // Subtract an amount from a user's balance, clamped so it never goes below 0.
  async subtract(uid, amount) {
    const usersData = getUsersData();
    const safeAmount = toSafeNumber(amount, "amount");
    if (!usersData.existsSync(uid)) {
      await usersData.set(uid, DEFAULT_BALANCE, "money");
    }
    const current = await usersData.getMoney(uid);
    const finalAmount = Math.min(safeAmount, Number.isFinite(current) ? current : 0);
    const updated = await usersData.subtractMoney(uid, finalAmount);
    if (updated.money < 0) {
      await usersData.set(uid, 0, "money");
      return 0;
    }
    return updated.money;
  },

  // Force a user's balance to an exact value.
  async set(uid, amount) {
    const usersData = getUsersData();
    const safeAmount = toSafeNumber(amount, "amount");
    await usersData.set(uid, safeAmount, "money");
    return safeAmount;
  }
};
