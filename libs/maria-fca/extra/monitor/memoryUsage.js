"use strict";

/**
 * memoryUsage.js
 *
 * Standalone FCA/hosting memory-usage (%) tracking system. Extracted out of
 * the old extra/memoryMonitor.js (which used to mix this together with the
 * cache-clean system in a single file). Cache cleanup now lives separately
 * in extra/monitor/cacheCleaner.js and is only called from here when usage
 * gets too high.
 *
 * This is a standalone utility, not an api endpoint, so it's not auto-loaded
 * by buildAPI()'s src/ loop. index.js requires it directly:
 * require('./extra/monitor/memoryUsage').
 */

const v8 = require('v8');
const os = require('os');
const { findAndCleanCache } = require('./cacheCleaner');

/**
 * Calculates current FCA heap memory usage percentage.
 */
function getFcaMemoryUsage() {
    const memory = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapLimit = heapStats.heap_size_limit;
    const usagePercent = (memory.heapUsed / heapLimit) * 100;
    return {
        used: memory.heapUsed,
        limit: heapLimit,
        percent: parseFloat(usagePercent.toFixed(2))
    };
}

/**
 * Calculates current system/hosting memory load percentage.
 */
function getHostingMemoryLoad() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total) * 100;
    return {
        used: used,
        total: total,
        percent: parseFloat(usagePercent.toFixed(2))
    };
}

/**
 * Prints memory status in Bengali/English hybrid as requested.
 * format: "FCA koto% use hocce + memory koto% load hocce hosting er seita jeno console a show kore..."
 * Triggers cache cleanup (from cacheCleaner.js) if usage crosses 90%.
 */
function reportMemoryStatus() {
    const fca = getFcaMemoryUsage();
    const hosting = getHostingMemoryLoad();

    console.log(`\x1b[35m[MemoryUsage] FCA Heap Usage: ${fca.percent}% | Hosting Memory Load: ${hosting.percent}%\x1b[0m`);

    if (fca.percent >= 90 || hosting.percent >= 90) {
        console.warn(`\x1b[31m[MemoryUsage] Warning: Memory usage is over 90%! (FCA: ${fca.percent}%, Hosting: ${hosting.percent}%)\x1b[0m`);
        console.warn(`\x1b[31m[MemoryUsage] Initiating chatbot cache cleanup...\x1b[0m`);
        findAndCleanCache();
    }
}

/**
 * Starts periodic background checking
 */
function startMonitoring(intervalMs = 5 * 60 * 1000) {
    // Initial report
    reportMemoryStatus();

    const intervalId = setInterval(() => {
        reportMemoryStatus();
    }, intervalMs);

    if (intervalId && typeof intervalId.unref === 'function') {
        intervalId.unref();
    }

    return intervalId;
}

module.exports = function (defaultFuncs, api, ctx) {
    return {
        getFcaMemoryUsage,
        getHostingMemoryLoad,
        reportMemoryStatus,
        startMonitoring
    };
};
