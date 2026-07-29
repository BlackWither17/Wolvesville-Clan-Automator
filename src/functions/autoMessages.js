import { CronJob } from "cron";
import config from "../config.js";
import logger from "./logger.js";

/*
* Sends one configured message. When an entry holds several messages, a random
* one is picked so the clan chat does not always read the same.
*/
async function sendAutoMessage(clan, entry) {
    const content = entry.messages[Math.floor(Math.random() * entry.messages.length)];

    if (config.dryRun) {
        logger.info(`[dry run] Would send "${entry.name}": ${content}`);
        return;
    }

    try {
        await clan.chat.send(content);
        logger.success(`Sent auto message "${entry.name}".`);
    } catch (error) {
        logger.error(`Could not send auto message "${entry.name}":`, error.message ?? error);
    }
}

/*
* Schedules every message from config/auto-messages.json at its configured time.
*/
function autoMessageCronJobs(clan) {
    if (!config.autoMessages.length) {
        logger.warn("No auto messages configured.");
        return [];
    }

    logger.info(`Auto Message cron jobs starting (${config.autoMessages.length} configured, ${config.timeZone})...`);
    return config.autoMessages.map(entry => {
        logger.info(`  - "${entry.name}" at ${entry.cronTime}`);
        return CronJob.from({
            cronTime: entry.cronTime,
            onTick: () => sendAutoMessage(clan, entry),
            start: true,
            timeZone: config.timeZone,
        });
    });
}

export { autoMessageCronJobs, sendAutoMessage };
