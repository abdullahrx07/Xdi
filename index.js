/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 *
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * Vietnamese:
 * ! Vui lòng không thay đổi mã bên dưới, nó rất quan trọng đối với dự án.
 * Nó là động lực để tôi duy trì và phát triển dự án miễn phí.
 * ! Nếu thay đổi nó, bạn sẽ bị cấm vĩnh viễn
 * Cảm ơn bạn đã sử dụng
 */

const { spawn } = require("child_process");
const log = require("./logger/log.js");

let consecutiveCrashes = 0;
let lastCrashTime = 0;

function startProject() {
	const child = spawn("node", ["Goat.js"], {
		cwd: __dirname,
		stdio: "inherit",
		shell: true
	});

	child.on("close", (code) => {
		const now = Date.now();
		// if the last crash/restart was more than 2 minutes ago, this is a fresh run, reset the backoff
		if (now - lastCrashTime > 2 * 60 * 1000) {
			consecutiveCrashes = 0;
		}
		lastCrashTime = now;

		if (code == 2) {
			// planned restart (scheduled auto-restart, or Two-ID Mode switching account) - go immediately
			consecutiveCrashes = 0;
			log.info("Restarting Project...");
			startProject();
			return;
		}

		if (code == 0) {
			// clean, intentional shutdown - don't auto-restart
			return;
		}

		// unexpected crash (e.g. code 1 = login failed and Two-ID Mode isn't enabled/didn't switch).
		// Keep the bot alive by restarting anyway, but back off so we don't rapid-fire login
		// attempts at Facebook if something is persistently broken (bad cookies, no internet, etc).
		consecutiveCrashes++;
		const delaySeconds = Math.min(10 * consecutiveCrashes, 300); // 10s, 20s, 30s ... capped at 5 min
		log.warn(`Project exited unexpectedly (code ${code}). Restarting in ${delaySeconds}s (attempt ${consecutiveCrashes})...`);
		setTimeout(startProject, delaySeconds * 1000);
	});
}

startProject();
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(3000, () => {
  console.log('Uptime server running on port 3000');
});
