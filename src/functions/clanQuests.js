import { CronJob } from "cron";
import config from "../config.js";
import logger from "./logger.js";

/* Vote keys that mean "shuffle the available quests" instead of a quest id. */
const SHUFFLE_KEYS = ["shuffle", "reroll", "refresh", "skip"];

/*
* Fetches the active clan quest, or null if there is none.
* wolvesville.js crashes with a TypeError when the API returns 404
* (no active quest) instead of throwing NO_ACTIVE_CLAN_QUEST.
*/
async function fetchActiveQuest(clan) {
    try {
        return await clan.quests.fetchActive();
    } catch (error) {
        if (error instanceof TypeError || error.message === "NO_ACTIVE_CLAN_QUEST") return null;
        throw error;
    }
}

/*
* Extracts the voted key out of a single vote entry. Returns "shuffle" for
* shuffle votes and null when the entry carries no usable information.
*/
function voteKeyOf(entry) {
    if (typeof entry === "string") return entry;
    if (!entry || typeof entry !== "object") return null;

    const key = entry.questId ?? entry.id ?? entry.quest ?? entry.type ?? entry.vote;
    /* A vote without a quest id is the "shuffle" option in the game client. */
    if (key === null || key === undefined) return "shuffle";
    return String(key);
}

/*
* Counts how many votes a single entry represents. The API may either send one
* entry per voter or an already aggregated count / list of voters.
*/
function voteCountOf(entry) {
    if (!entry || typeof entry !== "object") return 1;
    if (typeof entry.votes === "number") return entry.votes;
    if (typeof entry.voteCount === "number") return entry.voteCount;
    if (Array.isArray(entry.playerIds)) return entry.playerIds.length;
    if (Array.isArray(entry.voterIds)) return entry.voterIds.length;
    return 1;
}

/*
* Number of votes behind a value: a list of voter ids or an already
* aggregated count.
*/
function sizeOf(value) {
    if (Array.isArray(value)) return value.length;
    if (typeof value === "number") return value;
    return 0;
}

/*
* Normalizes the raw votes payload into a Map of vote key -> vote count.
* The API answers with { votes: { [questId]: [playerId] }, shuffleVotes: [playerId] },
* the other shapes are handled defensively in case the API changes.
*/
function countVotes(rawVotes) {
    const counts = new Map();
    const add = (key, amount) => {
        if (!key || amount <= 0) return;
        const normalized = SHUFFLE_KEYS.includes(key.toLowerCase()) ? "shuffle" : key;
        counts.set(normalized, (counts.get(normalized) ?? 0) + amount);
    };

    if (rawVotes && (rawVotes.votes || rawVotes.shuffleVotes)) {
        for (const [questId, voters] of Object.entries(rawVotes.votes ?? {})) add(questId, sizeOf(voters));
        add("shuffle", sizeOf(rawVotes.shuffleVotes));
        return counts;
    }

    if (Array.isArray(rawVotes)) {
        for (const entry of rawVotes) add(voteKeyOf(entry), voteCountOf(entry));
        return counts;
    }

    if (rawVotes && typeof rawVotes === "object") {
        for (const [key, value] of Object.entries(rawVotes)) add(key, sizeOf(value) || 1);
    }

    return counts;
}

/*
* Decides what to do with the current votes:
* - "shuffle" when the shuffle option has strictly the most votes
* - "claim" when a quest has the most votes (ties are won by the quest that is
*   listed first, shuffle never wins a tie because it costs gold without result)
* - "none" when nobody voted or there is nothing to claim
*/
function decideQuestAction(rawVotes, availableQuests) {
    const counts = countVotes(rawVotes);
    const shuffleVotes = counts.get("shuffle") ?? 0;
    const quests = [...availableQuests.values()];

    let quest = null;
    let questVotes = 0;
    for (const available of quests) {
        const votes = counts.get(available.id) ?? 0;
        if (votes > questVotes) {
            quest = available;
            questVotes = votes;
        }
    }

    const unknownKeys = [...counts.keys()]
        .filter(key => key !== "shuffle" && !quests.some(available => available.id === key));
    if (unknownKeys.length) logger.warn(`Ignoring votes for unknown quest ids: ${unknownKeys.join(", ")}`);

    if (shuffleVotes > questVotes) return { action: "shuffle", quest: null, questVotes, shuffleVotes, counts };
    if (quest) return { action: "claim", quest, questVotes, shuffleVotes, counts };
    return { action: "none", quest: null, questVotes, shuffleVotes, counts };
}

async function announce(clan, message) {
    if (!config.quest.announce) return;
    if (config.dryRun) {
        logger.info(`[dry run] Would send to clan chat: ${message}`);
        return;
    }

    try {
        await clan.chat.send(message);
    } catch (error) {
        logger.error("Could not send the clan quest announcement:", error.message ?? error);
    }
}

/*
* Runs one round of the clan quest automation: claims the most voted quest or
* shuffles the available quests when the shuffle option leads the vote.
*/
async function runQuestAutomation(clan) {
    const activeQuest = await fetchActiveQuest(clan);
    if (activeQuest) {
        logger.warn(`A Clan Quest is currently active: ${activeQuest.name} (tier ${activeQuest.tier}).`);
        return { action: "skipped" };
    }

    const availableQuests = await clan.quests.fetch();
    if (!availableQuests.size) {
        logger.warn("No available Clan Quests to vote on.");
        return { action: "none" };
    }

    const rawVotes = await clan.quests.fetchVotes();
    const decision = decideQuestAction(rawVotes, availableQuests);
    const summary = [...decision.counts]
        .map(([key, votes]) => `${availableQuests.get(key)?.name ?? key}=${votes}`)
        .join(", ");
    logger.info(`Votes: ${summary || "none"}`);

    if (decision.action === "none") {
        logger.warn("Nobody voted for a Clan Quest, doing nothing.");
        return decision;
    }

    if (decision.action === "shuffle") {
        logger.info(`Shuffle won the vote (${decision.shuffleVotes} votes), shuffling quests...`);
        if (config.dryRun) {
            logger.info("[dry run] Would shuffle the available quests.");
            return decision;
        }

        const shuffled = await clan.quests.shuffle();
        logger.success(`Shuffled the Clan Quests: ${[...shuffled.values()].map(quest => quest.name).join(", ")}`);
        await announce(clan, `🎲 | Shuffle won the vote (${decision.shuffleVotes} votes) - please vote again!`);
        return decision;
    }

    logger.info(`"${decision.quest.name}" won the vote (${decision.questVotes} votes), claiming it...`);
    if (config.dryRun) {
        logger.info(`[dry run] Would claim "${decision.quest.name}" (${decision.quest.type}).`);
        return decision;
    }

    const claimed = await decision.quest.claim();
    logger.success(`Started the Clan Quest "${claimed.name}".`);
    await announce(clan, `⚔️ | "${claimed.name}" won the vote (${decision.questVotes} votes) and has been started!`);
    return decision;
}

/*
* Schedules the clan quest automation, by default at 20:00 Europe/Berlin.
*/
function manageClanQuestJob(clan) {
    if (!config.quest.enabled) {
        logger.warn("Clan Quest automation is disabled.");
        return null;
    }

    logger.info(`Clan Quest cron job starting (${config.quest.cronTime}, ${config.timeZone})...`);
    return CronJob.from({
        cronTime: config.quest.cronTime,
        onTick: async () => {
            try {
                await runQuestAutomation(clan);
            } catch (error) {
                logger.error("Clan Quest automation failed:", error.message ?? error);
            }
        },
        runOnInit: config.quest.runOnStart,
        start: true,
        timeZone: config.timeZone,
    });
}

export { manageClanQuestJob, runQuestAutomation, decideQuestAction, countVotes, fetchActiveQuest };
