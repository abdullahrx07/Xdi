# Changed files (this session only)

## Modified
- `includes/handler/shared.js` — `isAllowedByAccessMode()` gate (adminOnly / whitelist / thread-whitelist), removed developer role (4), direct senderID<->config.adminBot / config.whitelist.ids matching
- `includes/handler/onStart.js` — wired the access-mode gate, no-prefix whitelist users, removed role-4 branch
- `includes/handler/onReply.js` — wired the access-mode gate
- `includes/handler/onReaction.js` — wired the access-mode gate
- `includes/handler/onEvent.js` — wired the access-mode gate (covers onAnyEvent/onFirstChat/onChat/eventCommands/onEvent auto-triggers)
- `modules/cmds/whitelist.js` — added thread-whitelist subcommands (threadon/threadoff/threadadd/threadremove/threadlist)
- `config.json` — added `whitelist.threadStatus` / `whitelist.threadIds`, removed `developer` key

## Deleted
- `modules/cmds/developer.js` — developer role/command removed entirely (not included in this zip since it's deleted; just delete it manually from your project if it's still there)
