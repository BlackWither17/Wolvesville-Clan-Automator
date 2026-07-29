import fs from "node:fs";
import dotenv from "dotenv";
import logger from "./functions/logger.js";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const AUTO_MESSAGES_FILE = new URL("../config/auto-messages.json", import.meta.url);

/*
* Reads a boolean environment variable ("true", "1", "yes", "on" are truthy).
*/
function bool(value, fallback) {
    if (value === undefined || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

/*
* Turns "18:00" into a cron expression, optionally limited to certain weekdays
* ("1-5", "0,6", ...). Entries may also provide a raw `cronTime` instead.
*/
function timeToCron(time, days = "*") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim());
    if (!match) throw new Error(`INVALID_TIME_FORMAT: "${time}" (expected "HH:MM")`);

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new Error(`INVALID_TIME_VALUE: "${time}"`);

    return `0 ${minute} ${hour} * * ${days}`;
}

/*
* Loads the auto message schedule from config/auto-messages.json.
* Falls back to the legacy single message from the .env file when the
* config file does not exist yet.
*/
function loadAutoMessages() {
    if (!fs.existsSync(AUTO_MESSAGES_FILE)) {
        logger.warn("No config/auto-messages.json found, falling back to CLAN_MESSAGE_CONTENT at 18:00.");
        if (!process.env.CLAN_MESSAGE_CONTENT) return [];
        return [{
            name: "clan-message",
            cronTime: timeToCron("18:00"),
            messages: [process.env.CLAN_MESSAGE_CONTENT],
        }];
    }

    const raw = JSON.parse(fs.readFileSync(AUTO_MESSAGES_FILE, "utf8"));
    if (!Array.isArray(raw)) throw new Error("AUTO_MESSAGES_MUST_BE_AN_ARRAY");

    return raw
        .filter(entry => entry.enabled !== false)
        .map((entry, index) => {
            const name = entry.name ?? `message-${index + 1}`;
            const messages = [entry.message ?? entry.messages].flat().filter(Boolean);
            if (!messages.length) throw new Error(`AUTO_MESSAGE_WITHOUT_CONTENT: "${name}"`);

            return {
                name,
                cronTime: entry.cronTime ?? timeToCron(entry.time, entry.days),
                messages,
            };
        });
}

function requireEnv(key) {
    const value = process.env[key];
    if (!value) throw new Error(`MISSING_ENV_VARIABLE: ${key}`);
    return value;
}

const config = {
    apiKey: requireEnv("WOLVESVILLE_BOT_API_KEY"),
    clanId: requireEnv("WOLVESVILLE_CLAN_ID"),
    timeZone: process.env.TIME_ZONE ?? "Europe/Berlin",
    /* When enabled, nothing is claimed, shuffled or sent - actions are only logged. */
    dryRun: bool(process.env.DRY_RUN, false),
    quest: {
        enabled: bool(process.env.QUEST_ENABLED, true),
        cronTime: process.env.QUEST_CRON ?? timeToCron(process.env.QUEST_TIME ?? "20:00"),
        /* Runs the quest automation once right after startup (useful for testing). */
        runOnStart: bool(process.env.QUEST_RUN_ON_START, false),
        /* Posts the result of the automation into the clan chat. */
        announce: bool(process.env.QUEST_ANNOUNCE, true),
    },
    autoMessages: loadAutoMessages(),
};

export default config;
export { timeToCron };
