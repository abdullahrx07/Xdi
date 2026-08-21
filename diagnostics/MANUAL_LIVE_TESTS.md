# Manual live tests (run against your real bot)

`node diagnostics/run-all.js` covers everything that can be tested without a
real Facebook session (backoff math, circuit breaker, `ReactionRegistry` TTL
behavior, atomic file writes). It intentionally does **not** fake a real
MQTT/WebSocket connection — a simulated "fake Facebook" would only prove that
the fake behaves as scripted, not that the real transport code is correct.
These steps close that gap using your actual bot.

## 1. Confirm the correct FCA is loaded

Start the bot and check the very first log lines. You should see:

```
warn: FCA  Loaded FCA v3.0.1 from: /path/to/your/project/fca/index.js
```

If you ever see a path containing `node_modules/hridoy-fca`, or the error
`FCA was resolved from node_modules instead of the vendored ./fca folder`,
something reintroduced the old ambiguity — check `package.json` and
`bot/login/login.js` before doing anything else.

## 2. Turn on the diagnostics

In `config.json`, set both:
```json
"reactionDebug": true,
"optionsFca": { "reactionDebug": true }
```
Restart. You'll now see `reactionDebug` log lines for every reaction: the raw
FCA event, the dispatch into `handlerEvents.js`, the `onReaction` Map lookup
(found/not found + Map size), and success/failure + latency. Leave this on
for the duration of these tests, then turn it back off for normal production
use (it's verbose by design).

## 3. Normal event flow

React to any message with an active reaction handler (e.g. start a game that
uses `onReaction`, then react to its prompt). Confirm you see the full
`reactionDebug` trail end-to-end and the command actually runs.

## 4. Simulated socket close

While the bot is running, temporarily block outbound traffic to Facebook's
MQTT edge (e.g. firewall rule, or just disconnect the network for 10–15
seconds and reconnect). You should see:
```
warn: listenMqtt  MQTT disconnected (close). Reconnecting in ~3s...
```
then a reconnect, then `Loaded FCA` is NOT reprinted (that only logs at
process start) but you should see the mqtt `connect` handler re-subscribe,
and reactions should keep working immediately after.

## 5. Silent transport freeze (the original bug)

Harder to trigger on demand, but if it recurs: with `reactionDebug` on, the
watchdog tick logs every 15s, including `msSinceLastPacket`. If that number
grows past `keepalive * 2` seconds (default keepalive is whatever `mqttOptions.keepalive`
is set to) without a reconnect being logged, that's the watchdog failing to
catch it — file that as a new issue with the surrounding log lines.

## 6. Repeated reconnects / circuit breaker

If your network is flaky enough to cause >10 reconnects in 5 minutes, you
should see:
```
warn: listenMqtt  N reconnects in the last few minutes — circuit breaker engaged, waiting 300s...
```
instead of a tight reconnect loop.

## 7. Reaction handling after reconnect

Start a game (creates a `GoatBot.onReaction` entry), force a reconnect (step
4), then react. The handler must still fire — this confirms reconnects don't
wipe `GoatBot.onReaction` (only a full bot restart does, by design).

## 8. Long-running check

No shortcut for this one — leave `reactionDebug` on for 24–48h and confirm
reactions are still being dispatched at the end, with `GoatBot.onReaction`'s
logged Map size staying bounded (the periodic sweep logs `Swept N expired
reaction handler(s)` roughly every 15 minutes when there's something to
clean up).
