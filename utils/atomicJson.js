"use strict";

const fs = require("fs");
const path = require("path");

// One write queue per absolute file path, so concurrent callers writing to
// the same file are serialized instead of racing (the classic cause of a
// JSON file getting truncated or interleaved when two writes land at once).
const _writeQueues = new Map();

function _enqueue(filePath, task) {
    const prev = _writeQueues.get(filePath) || Promise.resolve();
    const next = prev.then(task, task); // run task even if a previous write failed
    _writeQueues.set(filePath, next);
    return next;
}

/**
 * Write `data` (any JSON-serializable value) to `filePath` atomically:
 * serialize -> write to a temp file in the same directory -> fsync -> rename
 * over the target. A rename on the same filesystem is atomic on POSIX and on
 * modern Windows/NTFS, so a crash or power loss can never leave the target
 * file half-written — readers either see the old complete file or the new
 * complete file, never a truncated one.
 *
 * Also keeps one rotating `<file>.bak` copy of the previous good version, so
 * a corruption caused by something other than this function (disk error,
 * manual edit gone wrong, etc.) can still be recovered from.
 */
function writeJsonAtomic(filePath, data, options) {
    const opts = options || {};
    const spaces = opts.spaces == null ? 2 : opts.spaces;
    filePath = path.resolve(filePath);

    return _enqueue(filePath, async function () {
        const dir = path.dirname(filePath);
        const tmpPath = path.join(dir, "." + path.basename(filePath) + ".tmp-" + process.pid + "-" + Date.now());
        const json = JSON.stringify(data, null, spaces);

        const fh = await fs.promises.open(tmpPath, "w");
        try {
            await fh.writeFile(json, "utf8");
            await fh.sync(); // flush to disk before the rename is visible
        } finally {
            await fh.close();
        }

        // Keep a backup of whatever was there before, best-effort.
        if (opts.keepBackup !== false) {
            try {
                await fs.promises.copyFile(filePath, filePath + ".bak");
            } catch (err) {
                if (err.code !== "ENOENT") throw err; // ENOENT = nothing to back up yet, fine
            }
        }

        await fs.promises.rename(tmpPath, filePath);
        return true;
    });
}

function writeJsonAtomicSync(filePath, data, options) {
    const opts = options || {};
    const spaces = opts.spaces == null ? 2 : opts.spaces;
    filePath = path.resolve(filePath);
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, "." + path.basename(filePath) + ".tmp-" + process.pid + "-" + Date.now());
    const json = JSON.stringify(data, null, spaces);

    const fd = fs.openSync(tmpPath, "w");
    try {
        fs.writeSync(fd, json, null, "utf8");
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }

    if (opts.keepBackup !== false) {
        try { fs.copyFileSync(filePath, filePath + ".bak"); }
        catch (err) { if (err.code !== "ENOENT") throw err; }
    }

    fs.renameSync(tmpPath, filePath);
    return true;
}

/**
 * Read and JSON.parse a file, falling back to the `.bak` copy if the primary
 * file is missing or fails to parse (corruption recovery). Throws only if
 * both the primary and the backup are unreadable/invalid.
 */
function readJsonSafeSync(filePath, defaultValue) {
    filePath = path.resolve(filePath);
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (primaryErr) {
        try {
            const backup = JSON.parse(fs.readFileSync(filePath + ".bak", "utf8"));
            return backup;
        } catch (backupErr) {
            if (defaultValue !== undefined) return defaultValue;
            throw primaryErr;
        }
    }
}

function writeFileAtomicSync(filePath, contents, options) {
    const opts = options || {};
    filePath = path.resolve(filePath);
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, "." + path.basename(filePath) + ".tmp-" + process.pid + "-" + Date.now());

    const fd = fs.openSync(tmpPath, "w");
    try {
        fs.writeSync(fd, contents, null, "utf8");
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }

    if (opts.keepBackup !== false) {
        try { fs.copyFileSync(filePath, filePath + ".bak"); }
        catch (err) { if (err.code !== "ENOENT") throw err; }
    }

    fs.renameSync(tmpPath, filePath);
    return true;
}

module.exports = {
    writeJsonAtomic,
    writeJsonAtomicSync,
    writeFileAtomicSync,
    readJsonSafeSync
};
