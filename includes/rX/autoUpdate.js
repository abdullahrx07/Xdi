/**
 * GIT AUTO UPDATE SYSTEM (staged / admin-confirmed model)
 * ---------------------------------------------------------
 * Reads `gitUpdate` from config.json:
 *   "gitUpdate": {
 *       "autoUpdate": true,              // true = periodically check in the background, false = disabled
 *       "url": "https://github.com/owner/repo",
 *       "branch": "main",                // optional, auto-detected if omitted
 *       "checkIntervalMinutes": 60,      // optional, how often to check in the background
 *       "protect": ["myCustomFolder"]    // optional, extra files/folders to never overwrite
 *   }
 *
 * Why staged instead of "check + apply immediately on boot":
 * On hosts like Render, the boot process must bind to a port quickly or the
 * deploy is killed/timed out. Downloading + npm installing on every boot
 * before the bot even logs in can blow that budget. So now:
 *
 *   1. The bot boots and starts listening immediately (no blocking update check).
 *   2. In the background, on an interval, we silently check the remote repo's
 *      package.json version and, if newer, silently download + extract it into
 *      a staging folder (`.autoupdate_staged`) WITHOUT touching live files.
 *   3. Once staged, the bot messages every admin's inbox: "new version
 *      available". Admin reacts ✅ on that message (or runs the `update`
 *      command) to actually apply the already-downloaded update.
 *   4. Applying = copy staged files over the project (skipping protected
 *      paths), npm install if deps changed, then exit(2) so the process
 *      manager restarts the bot on the new code.
 */

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");
const log = require("../../utils/logger/log.js");

// Never touch these when copying updated files over the project — they're
// either user secrets/config or runtime data, not part of the bot's code.
// This is only the fallback used when config.json > gitUpdate.protectedPaths
// is missing (e.g. an old config.json from before this list was exposed).
// Normally the list the user actually sees/edits is in config.json.
const DEFAULT_PROTECTED_PATHS = [
	"config.json",
	"config.dev.json",
	"configCommands.json",
	"configCommands.dev.json",
	"account.txt",
	"account.dev.txt",
	"appstate.txt",
	"appstate.json",
	"appstate.dev.txt",
	"appstate.dev.json",
	"node_modules",
	".git",
	"package-lock.json",
	".autoupdate_tmp",
	".autoupdate_staged",
	".autoupdate_staged_tmp",
	".update-pending.json",
	"database.sqlite",
	"includes/data"
];

// Path that gets skipped when config.json > gitUpdate.cmdUpdate is set to
// false — i.e. the user's local commands (modules/cmds) are left alone and
// only the rest of the bot's code (core, includes, etc.) gets updated.
const CMDS_PATH = "modules/cmds";

const STAGED_DIR_NAME = ".autoupdate_staged";
const STAGED_TMP_DIR_NAME = ".autoupdate_staged_tmp";
const PENDING_MARKER_NAME = ".update-pending.json";

function getGitRemoteUrl(rootDir) {
	try {
		const { execSync } = require("child_process");
		let url = execSync("git config --get remote.origin.url", { cwd: rootDir, stdio: "pipe" }).toString().trim();
		if (url) {
			if (url.startsWith("git@github.com:")) {
				url = url.replace("git@github.com:", "https://github.com/");
			}
			if (url.endsWith(".git")) {
				url = url.slice(0, -4);
			}
			return url;
		}
	} catch {
		// Ignore if git command fails or not in git repo
	}
	return null;
}

function parseGitUrl(url) {
	const match = String(url).replace(/\.git$/, "").match(/github\.com\/([^\/]+)\/([^\/]+)/i);
	if (!match) throw new Error(`"gitUpdate.url" is not a valid GitHub repo URL: ${url}`);
	return { owner: match[1], repo: match[2] };
}

function compareVersion(version1, version2) {
	const v1 = String(version1).split(".").map(n => parseInt(n) || 0);
	const v2 = String(version2).split(".").map(n => parseInt(n) || 0);
	for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
		if ((v1[i] || 0) > (v2[i] || 0)) return 1;
		if ((v1[i] || 0) < (v2[i] || 0)) return -1;
	}
	return 0;
}

async function getDefaultBranch(owner, repo) {
	try {
		const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { timeout: 10000 });
		return data.default_branch || "main";
	} catch {
		return "main";
	}
}

async function fetchRemotePackageJson(owner, repo, branch) {
	try {
		const { data } = await axios.get(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`, { timeout: 10000 });
		return typeof data === "string" ? JSON.parse(data) : data;
	} catch (err) {
		log.warn("AUTO UPDATE", `Failed to fetch remote package.json from ${owner}/${repo} on branch "${branch}": ${err.message}`);
		throw err;
	}
}

async function downloadAndExtractZip(owner, repo, branch, destDir) {
	const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
	const { data } = await axios.get(zipUrl, { responseType: "arraybuffer", timeout: 120000 });
	const zip = new AdmZip(Buffer.from(data));
	zip.extractAllTo(destDir, true);

	// GitHub zips always extract into a single "<repo>-<branch>" root folder
	const extractedFolder = fs.readdirSync(destDir).find(f => fs.statSync(path.join(destDir, f)).isDirectory());
	if (!extractedFolder) throw new Error("Failed to extract downloaded update zip");
	return path.join(destDir, extractedFolder);
}

function isProtected(relPath, protectedPaths) {
	const normalized = relPath.split(path.sep).join("/");
	return protectedPaths.some(p => normalized === p || normalized.startsWith(p + "/"));
}

function copyRecursiveSkipProtected(srcDir, destRootDir, protectedPaths, relBase = "") {
	for (const entry of fs.readdirSync(srcDir)) {
		const relPath = relBase ? `${relBase}/${entry}` : entry;
		if (isProtected(relPath, protectedPaths)) continue;

		const srcPath = path.join(srcDir, entry);
		const destPath = path.join(destRootDir, relPath);

		if (fs.statSync(srcPath).isDirectory()) {
			fs.ensureDirSync(destPath);
			copyRecursiveSkipProtected(srcPath, destRootDir, protectedPaths, relPath);
		} else {
			fs.ensureDirSync(path.dirname(destPath));
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function getProtectedPaths(gitUpdate) {
	gitUpdate = gitUpdate || {};

	// Base list: use the one exposed in config.json (gitUpdate.protectedPaths)
	// if present so the user can see/edit exactly what's skipped, otherwise
	// fall back to the built-in defaults (old config.json without this field).
	const basePaths = Array.isArray(gitUpdate.protectedPaths) ? gitUpdate.protectedPaths : DEFAULT_PROTECTED_PATHS;

	const paths = [...basePaths, ...(Array.isArray(gitUpdate.protect) ? gitUpdate.protect : [])];

	// cmdUpdate: false -> also skip modules/cmds so the update never touches
	// the user's local commands, only the rest of the bot's code.
	if (gitUpdate.cmdUpdate === false && !paths.includes(CMDS_PATH)) {
		paths.push(CMDS_PATH);
	}

	return paths;
}

function loadConfig(rootDir) {
	return global.GoatBot?.config || require(path.join(rootDir, "config.json"));
}

/**
 * Resolves { owner, repo, branch } from config.json's gitUpdate block
 * (falling back to the local .git remote / default branch detection),
 * with the same graceful fallbacks the original implementation had.
 */
async function resolveRepo(rootDir, gitUpdate) {
	let gitUrl = gitUpdate.url || getGitRemoteUrl(rootDir);
	if (!gitUrl) {
		const err = new Error("Git auto update is enabled but no git repository URL could be found or auto-detected.");
		err.noRepo = true;
		throw err;
	}

	let owner, repo;
	try {
		const parsed = parseGitUrl(gitUrl);
		owner = parsed.owner;
		repo = parsed.repo;
	} catch (parseErr) {
		const fallbackUrl = gitUpdate.url ? getGitRemoteUrl(rootDir) : null;
		if (fallbackUrl && fallbackUrl !== gitUpdate.url) {
			log.warn("AUTO UPDATE", `Configured URL "${gitUpdate.url}" is invalid. Trying auto-detected remote: "${fallbackUrl}"...`);
			const parsed = parseGitUrl(fallbackUrl);
			owner = parsed.owner;
			repo = parsed.repo;
			gitUrl = fallbackUrl;
		} else {
			throw parseErr;
		}
	}

	let branch = gitUpdate.branch || await getDefaultBranch(owner, repo);

	async function tryFetchWithBranchFallback(curOwner, curRepo, curBranch) {
		try {
			return { pkg: await fetchRemotePackageJson(curOwner, curRepo, curBranch), activeBranch: curBranch };
		} catch (err) {
			if (!gitUpdate.branch && (curBranch === "main" || curBranch === "master") && err.response?.status === 404) {
				const fallbackBranch = curBranch === "main" ? "master" : "main";
				log.info("AUTO UPDATE", `Failed to fetch from branch "${curBranch}", trying fallback branch "${fallbackBranch}"...`);
				const pkg = await fetchRemotePackageJson(curOwner, curRepo, fallbackBranch);
				return { pkg, activeBranch: fallbackBranch };
			}
			throw err;
		}
	}

	let remotePkg;
	try {
		const fetchResult = await tryFetchWithBranchFallback(owner, repo, branch);
		remotePkg = fetchResult.pkg;
		branch = fetchResult.activeBranch;
	} catch (err) {
		const fallbackUrl = gitUpdate.url ? getGitRemoteUrl(rootDir) : null;
		if (fallbackUrl && fallbackUrl !== gitUpdate.url) {
			log.warn("AUTO UPDATE", `Configured repo "${owner}/${repo}" fetch failed (${err.message}). Trying auto-detected remote: "${fallbackUrl}"...`);
			const fallbackParsed = parseGitUrl(fallbackUrl);
			const fallbackOwner = fallbackParsed.owner;
			const fallbackRepo = fallbackParsed.repo;
			const fallbackBranch = gitUpdate.branch || await getDefaultBranch(fallbackOwner, fallbackRepo);
			const fetchResult = await tryFetchWithBranchFallback(fallbackOwner, fallbackRepo, fallbackBranch);
			remotePkg = fetchResult.pkg;
			branch = fetchResult.activeBranch;
			owner = fallbackOwner;
			repo = fallbackRepo;
			gitUrl = fallbackUrl;
		} else {
			throw err;
		}
	}

	return { owner, repo, branch, remotePkg };
}

/**
 * Silent, read-only check: is a newer version available on the remote repo?
 * Does NOT download anything. Safe to call as often as you like.
 */
async function checkForUpdate(rootDir = process.cwd()) {
	const config = loadConfig(rootDir);
	const gitUpdate = config.gitUpdate;
	if (!gitUpdate) return { available: false, noRepo: true };

	const localPkg = require(path.join(rootDir, "package.json"));
	const { owner, repo, branch, remotePkg } = await resolveRepo(rootDir, gitUpdate);

	if (!remotePkg.version) return { available: false, error: "Remote package.json has no version field." };

	const available = compareVersion(remotePkg.version, localPkg.version) > 0;
	return {
		available,
		owner, repo, branch,
		localVersion: localPkg.version,
		remoteVersion: remotePkg.version,
		remotePkg
	};
}

function readPendingMarker(rootDir) {
	const markerPath = path.join(rootDir, PENDING_MARKER_NAME);
	if (!fs.existsSync(markerPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(markerPath, "utf-8"));
	} catch {
		return null;
	}
}

function writePendingMarker(rootDir, data) {
	fs.writeFileSync(path.join(rootDir, PENDING_MARKER_NAME), JSON.stringify(data, null, 2));
}

/**
 * Returns the currently staged (downloaded-but-not-applied) update info, or
 * null if nothing is staged / the staged folder is missing.
 */
function getPendingUpdate(rootDir = process.cwd()) {
	const marker = readPendingMarker(rootDir);
	if (!marker) return null;
	const stagedDir = path.join(rootDir, STAGED_DIR_NAME);
	if (!fs.existsSync(stagedDir)) return null;
	return marker;
}

/**
 * Marks the currently staged update as "admin has been notified" so the
 * background checker doesn't re-send the same DM every interval.
 */
function markPendingNotified(rootDir = process.cwd()) {
	const marker = readPendingMarker(rootDir);
	if (!marker) return null;
	marker.notified = true;
	writePendingMarker(rootDir, marker);
	return marker;
}

function clearPendingUpdate(rootDir = process.cwd()) {
	try { fs.removeSync(path.join(rootDir, STAGED_DIR_NAME)); } catch {}
	try { fs.removeSync(path.join(rootDir, PENDING_MARKER_NAME)); } catch {}
}

/**
 * Downloads the given remote version into the staging folder
 * (`.autoupdate_staged`) without touching any live project files, and
 * writes the pending-update marker. Meant to be called from the background
 * checker once `checkForUpdate()` reports `available: true`.
 */
async function stageUpdate(rootDir, { owner, repo, branch, localVersion, remoteVersion, remotePkg }) {
	const tmpDir = path.join(rootDir, STAGED_TMP_DIR_NAME);
	fs.emptyDirSync(tmpDir);

	const extractedRoot = await downloadAndExtractZip(owner, repo, branch, tmpDir);

	const stagedDir = path.join(rootDir, STAGED_DIR_NAME);
	fs.removeSync(stagedDir);
	fs.moveSync(extractedRoot, stagedDir);
	fs.removeSync(tmpDir);

	const marker = {
		owner, repo, branch,
		localVersion, remoteVersion,
		remoteDependencies: remotePkg.dependencies || {},
		stagedAt: Date.now(),
		notified: false
	};
	writePendingMarker(rootDir, marker);

	log.master("AUTO UPDATE", `New version v${remoteVersion} downloaded and staged silently (was v${localVersion}). Waiting for admin confirmation to apply.`);
	return marker;
}

/**
 * Checks the remote repo and, if a newer version exists and isn't already
 * staged, silently downloads it into the staging folder. Never restarts or
 * touches live files. Meant for the background interval.
 *
 * @returns {Promise<{staged:boolean, alreadyStaged:boolean, marker:?object, checked:object}>}
 */
async function checkAndStageUpdate(rootDir = process.cwd()) {
	const checked = await checkForUpdate(rootDir);
	if (!checked.available) return { staged: false, alreadyStaged: false, marker: null, checked };

	const existing = getPendingUpdate(rootDir);
	if (existing && existing.remoteVersion === checked.remoteVersion) {
		return { staged: false, alreadyStaged: true, marker: existing, checked };
	}

	const marker = await stageUpdate(rootDir, {
		owner: checked.owner, repo: checked.repo, branch: checked.branch,
		localVersion: checked.localVersion, remoteVersion: checked.remoteVersion,
		remotePkg: checked.remotePkg
	});
	return { staged: true, alreadyStaged: false, marker, checked };
}

/**
 * Applies a previously staged update: copies the staged files over the
 * live project (skipping protected paths), npm installs if dependencies
 * changed, clears the staged folder/marker, then exits(2) so the process
 * manager restarts the bot on the new code.
 */
async function applyPendingUpdate(rootDir = process.cwd(), options = {}) {
	const { notifyThreadID = null } = options;
	const config = loadConfig(rootDir);
	const gitUpdate = config.gitUpdate || {};

	const marker = getPendingUpdate(rootDir);
	if (!marker) return { applied: false, noPending: true };

	const stagedDir = path.join(rootDir, STAGED_DIR_NAME);
	const protectedPaths = getProtectedPaths(gitUpdate);

	log.master("AUTO UPDATE", `Applying staged update: v${marker.localVersion} → v${marker.remoteVersion}...`);
	copyRecursiveSkipProtected(stagedDir, rootDir, protectedPaths);

	// Check if dependencies changed vs. what was staged, and npm install if so.
	let depsChanged = false;
	try {
		const localPkg = require(path.join(rootDir, "package.json"));
		const localDeps = localPkg.dependencies || {};
		const remoteDeps = marker.remoteDependencies || {};
		const remoteKeys = Object.keys(remoteDeps);
		const localKeys = Object.keys(localDeps);
		if (remoteKeys.length !== localKeys.length) {
			depsChanged = true;
		} else {
			for (const key of remoteKeys) {
				if (remoteDeps[key] !== localDeps[key]) { depsChanged = true; break; }
			}
		}
	} catch {}

	if (depsChanged) {
		log.info("AUTO UPDATE", "Dependencies in package.json have changed. Running 'npm install' to update dependencies...");
		try {
			const { execSync } = require("child_process");
			execSync("npm install --no-audit --no-fund", { cwd: rootDir, stdio: "inherit" });
			log.success("AUTO UPDATE", "Dependencies updated successfully.");
		} catch (npmErr) {
			log.err("AUTO UPDATE", "Failed to automatically install updated dependencies. Please run 'npm install' manually.", npmErr);
		}
	}

	const fromVersion = marker.localVersion;
	const toVersion = marker.remoteVersion;
	clearPendingUpdate(rootDir);

	log.master("AUTO UPDATE", `Update applied: v${fromVersion} → v${toVersion}. Restarting bot to load new code...`);

	if (notifyThreadID) {
		try {
			const markerDir = path.join(rootDir, "modules", "cmds", "tmp");
			fs.ensureDirSync(markerDir);
			fs.writeFileSync(path.join(markerDir, "update.txt"), `${notifyThreadID} ${Date.now()} ${fromVersion} ${toVersion}`);
		} catch (markerErr) {
			log.warn("AUTO UPDATE", `Failed to write update notification marker: ${markerErr.message}`);
		}
	}

	// Exit code 2 signals a "please restart me" to process managers
	// (PM2, nodemon, Render, or a simple bash restart-loop).
	process.exit(2);
	// eslint-disable-next-line no-unreachable
	return { applied: true, fromVersion, toVersion };
}

/**
 * All-in-one manual flow used by the `update` command when an admin runs
 * it directly: if there's already a matching staged update, apply it
 * immediately (no re-download). Otherwise check + download + apply in one
 * shot. This one is expected to block/restart — it was explicitly requested.
 */
async function checkAndSelfUpdate(rootDir = process.cwd(), options = {}) {
	const { notifyThreadID = null } = options;

	let config;
	try {
		config = loadConfig(rootDir);
	} catch (configErr) {
		log.err("AUTO UPDATE", "Failed to load config.json, skipping auto update check.", configErr);
		return { updated: false, error: configErr.message };
	}

	const gitUpdate = config.gitUpdate;
	if (!gitUpdate) {
		log.warn("AUTO UPDATE", "No \"gitUpdate\" block found in config.json.");
		return { updated: false, noRepo: true };
	}

	try {
		const checked = await checkForUpdate(rootDir);
		if (checked.error) return { updated: false, error: checked.error };
		if (!checked.available) {
			log.info("AUTO UPDATE", `Bot is already up to date (v${checked.localVersion}).`);
			return { updated: false, localVersion: checked.localVersion, remoteVersion: checked.remoteVersion };
		}

		const existing = getPendingUpdate(rootDir);
		if (!existing || existing.remoteVersion !== checked.remoteVersion) {
			await stageUpdate(rootDir, {
				owner: checked.owner, repo: checked.repo, branch: checked.branch,
				localVersion: checked.localVersion, remoteVersion: checked.remoteVersion,
				remotePkg: checked.remotePkg
			});
		}

		const result = await applyPendingUpdate(rootDir, { notifyThreadID });
		return { updated: result.applied, localVersion: checked.localVersion, remoteVersion: checked.remoteVersion };
	} catch (err) {
		log.err("AUTO UPDATE", "Failed to check/apply git auto update", err);
		return { updated: false, error: err.message };
	}
}

module.exports = {
	checkForUpdate,
	checkAndStageUpdate,
	getPendingUpdate,
	markPendingNotified,
	clearPendingUpdate,
	applyPendingUpdate,
	checkAndSelfUpdate,
	compareVersion,
	parseGitUrl
};
