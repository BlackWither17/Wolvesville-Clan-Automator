import { Client } from "wolvesville.js";
import chalk from "chalk";
import config from "./config.js";
import logger from "./functions/logger.js";
import { manageClanQuestJob } from "./functions/clanQuests.js";
import { autoMessageCronJobs } from "./functions/autoMessages.js";

const client = new Client(config.apiKey);

async function main() {
    printAsciiLogo();
    logger.info("Bot starting...");
    if (config.dryRun) logger.warn("DRY_RUN is enabled - no quests are claimed and no messages are sent.");

    const clan = await client.clans.fetch(config.clanId);
    /* Only clans the bot key is authorized for expose the quest and chat managers. */
    if (!clan.quests || !clan.chat) throw new Error("CLAN_NOT_AUTHORIZED: the bot API key does not belong to this clan");
    logger.success(`Connected to clan "${clan.name}".`);

    manageClanQuestJob(clan);
    autoMessageCronJobs(clan);
}

function printAsciiLogo() {
    logger.log(chalk.magenta(" ██████╗██╗      █████╗ ███╗   ██╗     █████╗ ██╗   ██╗████████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ██████╗ \n" +
        "██╔════╝██║     ██╔══██╗████╗  ██║    ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗\n" +
        "██║     ██║     ███████║██╔██╗ ██║    ███████║██║   ██║   ██║   ██║   ██║██╔████╔██║███████║   ██║   ██║   ██║██████╔╝\n" +
        "██║     ██║     ██╔══██║██║╚██╗██║    ██╔══██║██║   ██║   ██║   ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗\n" +
        "╚██████╗███████╗██║  ██║██║ ╚████║    ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║\n" +
        " ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝    ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝\n" +
        "                                                                                                                      "));
}

main().catch(error => {
    logger.error("Bot could not start:", error.message ?? error);
    process.exit(1);
});
