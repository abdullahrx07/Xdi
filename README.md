# @MARI-GBOT 〄

A powerful and modular **Facebook Messenger Bot Framework** built with **Node.js**.  
This project includes a command system, event handlers, database support, uptime system, and dashboard-ready controllers.

---

## ✨ Features

- Modular command & event system  
- Auto uptime system  
- MongoDB & SQLite database support  
- User / Thread / Global data controller  
- Reply, Reaction & Event handlers  
- Easy configuration & customization  
- Dashboard-ready API structure  

---

##

- Facebook Messenger chatbot functionality
- Facebook login through `appstate.txt` (cookies)
- 
- Easily customizable structure for developers


## 🧰 Requirements

- **Node.js version 18 or above (18+)**
- Facebook `appstate.txt` file (login cookie JSON)


## ⚙️ Installation

### 1. Repository Clone Karein

```bash
https://github.com/abdullahrx07/MARI-GBOT.git
```

### 2. Dependencies Installed

```bash
npm install
```

### 3. Facebook Appstate Add Do it

- Paste your Facebook account's `appstate.txt` file in the root folder.

- Ensure that the file is valid and updated.

### 4. Run the Bot

```bash
node index.js
```

---

## 🚀 Usage

- The bot will login to your Facebook account as soon as it is launched.

- It listens to Messenger chats in the background.

- You can use available commands like:

```
!help
!up
!song [name]
!info

```
# No Prefix system for admins

```
help
up
song [name]
info

```

- The bot automatically tracks group and user data (if the database is configured).

---


## 🧠 Core Modules

- **Command System** – Easily extendable command architecture  
- **Event Handler** – Handles message, reaction, and reply events  
- **Database Layer** – Abstracted MongoDB & SQLite connectors  
- **Controllers** – User, thread, global & dashboard data handling  
- **Uptime System** – Keeps the bot alive automatically  

---

## 🛠 Customization

- Custom logic can be added in:
- Uptime behavior can be modified in



---

## 📊 Dashboard Ready

Structured controllers designed for easy integration with dashboards and APIs.

---

## 🤝 Contributors

Thanks to everyone who contributed to this project:

- **Original Framework Author**  
- **Fork & Enhancements** – Community Contributors  

Want to contribute?  
Feel free to fork this repository and submit a pull request.

---

## 📜 License

This project is provided for **educational and development purposes only**.

---

## ❤️ Credits

Built with **Node.js**  

---

## 🔄 Auto-Update System Changelog

We have significantly upgraded the auto-update mechanism (`includes/rX/autoUpdate.js`) to make the bot more robust, self-healing, and secure.

### ✨ What's Improved:
1. **Critical Asset & Data Protection**: Expanded the protected paths list to automatically exclude the `includes/data` directory (preserving SQLite databases), as well as login sessions (`appstate.txt`, `appstate.json`, and dev variants) from being overwritten or wiped during updates.
2. **Git Remote Origin Auto-Detection**: If the configured repository URL is empty, invalid, or returns a 404, the bot will automatically fall back to detecting and using the local repository's cloned Git remote origin.
3. **Resilient Branch Fallbacks**: Added automatic failover between `main` and `master` default branches. If the target repository's default branch cannot be retrieved via API, it gracefully falls back and tries the other branch automatically.
4. **Intelligent Auto-Dependency Sync**: The auto-updater now compares the remote and local `package.json` dependencies. If any dependencies have changed, it automatically executes `npm install` post-update before restarting, preventing startup crashes.
5. **Standardized Diagnostics**: Replaced silent try-catch blocks with descriptive logger warnings and error reporting.

> ⚠️ **Notice**: There is a known issue regarding Facebook's E2EE (End-to-End Encryption) module in the current build. This issue has been identified and will be fully fixed in the next update.
