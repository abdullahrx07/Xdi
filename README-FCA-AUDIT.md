# FCA / Reaction-Detection Audit — Setup & Usage

This file documents what changed in this pass and how to run/verify it.
Full technical details: `CHANGELOG-FCA-AUDIT.md`. Manual live tests:
`diagnostics/MANUAL_LIVE_TESTS.md`.

## Install

```bash
npm install
```

The FCA is the npm package `@rxabdullah/xdi-fca` (`^1.6.5` in
`package.json`). The old vendored `./fca` / `./fca_old_backup` folders are
gone — `bot/login/login.js` requires the npm package directly, and
`npm install` provisions everything without any extra setup.

### E2EE (Labyrinth encrypted chats)

xdi-fca ships a built-in Labyrinth E2EE client. After login it connects via
`connectE2EE` and device/session keys persist to `./data/e2ee-device.json`
(when `config.json → e2ee.memoryOnly === false` and `e2ee.devicePath` is
set), so encrypted sessions survive bot restarts. E2EE settings live in the
top-level `config.json → e2ee` block, mapped to xdi-fca options at login
(`enableE2EE`, `e2eeMemoryOnly`, `e2eeDevicePath`); the builder also forces
`autoUpdate: false` so xdi-fca's built-in updater can't npm-install/restart
the process at runtime.

## Run

```bash
node index.js
```

Watch the first few log lines for:
```
warn: FCA  Loaded FCA v1.6.5 (@rxabdullah/xdi-fca) from: <your-project-path>/node_modules/@rxabdullah/xdi-fca/index.js
```
This confirms the npm-provided FCA implementation is what's actually
running. Resolving from `node_modules` is expected now — the vendored-folder
era is over.

## Run the test suite

```bash
node diagnostics/run-all.js
```

This runs two suites (12 tests total, all passing at time of delivery):
- `reaction-registry.test.js` — the `GoatBot.onReaction` TTL/cleanup logic
- `atomic-json.test.js` — atomic file writes, `.bak` corruption recovery

(`reconnect-policy.test.js` was removed — it depended on the deleted
vendored `./fca` folder.)

These don't need a Facebook session or network access. For the parts that
do (the real MQTT/WebSocket transport), see
`diagnostics/MANUAL_LIVE_TESTS.md`.

## Turning on reaction diagnostics

Normally leave these `false`. If reactions ever stop firing again, flip both
and restart:

```json
{
  "reactionDebug": true,
  "optionsFca": { "reactionDebug": true }
}
```

You'll get a full trace per reaction: raw FCA event → dispatch →
`GoatBot.onReaction` Map lookup (found/not found, current Map size) →
handler success/failure + latency — plus a watchdog tick every 15s showing
transport health (`mqttState`, time since last packet, time since last
reaction, reconnect count).

## Vendored FCA folders

The old `./fca` and `./fca_old_backup` folders have been deleted. The only
FCA used by the bot is the npm package `@rxabdullah/xdi-fca`.
