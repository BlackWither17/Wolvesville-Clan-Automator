import dotenv from "dotenv";
import { Client } from "wolvesville.js";
import { CronJob } from "cron";
import logger from "./functions/logger.js";
import chalk from "chalk";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const client = new Client(process.env.WOLVESVILLE_BOT_API_KEY);

async function main() {
    printAsciiLogo();
    logger.info("Bot starting...");

    const clan = await client.clans.fetch(process.env.WOLVESVILLE_CLAN_ID);
    autoMessageCronJob(clan);
}

/*
    Automatically sends a clan message every day at
    18:00 in Europe/Berline time zone.
 */
function autoMessageCronJob(clan) {
    CronJob.from({
        cronTime: '0 0 18 * * *',
        onTick: async () => {
            await clan.chat.send(process.env.CLAN_MESSAGE_CONTENT)
                .then(() => logger.success("Message cron job successfully"))
                .catch(logger.error);
        },
        start: true,
        timeZone: 'Europe/Berlin',
    });
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

main();
