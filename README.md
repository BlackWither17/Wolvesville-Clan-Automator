# Wolvesville Clan Automator

A small Node.js bot that takes the recurring clan chores off your hands:

- **Clan quests** – at a configured time it starts the quest with the most votes, or shuffles the available quests when the shuffle option leads the vote.
- **Auto messages** – sends clan chat messages at configured times, e.g. a daily reminder to vote.

Built on [wolvesville.js](https://www.npmjs.com/package/wolvesville.js) and [cron](https://www.npmjs.com/package/cron).

## Requirements

- Node.js 22 or newer
- A Wolvesville **bot API key** that is authorized for your clan (Wolvesville → clan settings → bots)
- Your clan id

## Setup

```bash
git clone https://github.com/BlackWither17/Wolvesville-Clan-Automator.git
cd Wolvesville-Clan-Automator
npm install
cp .env.example .env
```

Fill in `.env` with your API key and clan id, then start the bot:

```bash
npm start      # production
npm run dev    # with nodemon
```

The bot stays running and triggers its jobs at the configured times, so it belongs on a machine that is always on (VPS, Raspberry Pi, ...).

## Configuration

### `.env`

| Variable | Default | Description |
| --- | --- | --- |
| `WOLVESVILLE_BOT_API_KEY` | – | **Required.** Bot API key of your clan |
| `WOLVESVILLE_CLAN_ID` | – | **Required.** Id of your clan |
| `TIME_ZONE` | `Europe/Berlin` | Time zone used by every job |
| `DRY_RUN` | `false` | Only log what *would* happen – nothing is claimed, shuffled or sent |
| `QUEST_ENABLED` | `true` | Enables the clan quest automation |
| `QUEST_TIME` | `20:00` | Time of the daily quest run (`HH:MM`) |
| `QUEST_CRON` | – | Raw cron expression, overrides `QUEST_TIME` |
| `QUEST_ANNOUNCE` | `true` | Posts the result of the quest run into the clan chat |
| `QUEST_RUN_ON_START` | `false` | Runs the quest automation once right after startup |
| `CLAN_MESSAGE_CONTENT` | – | Fallback message, only used when `config/auto-messages.json` is missing |

> [!TIP]
> Start with `DRY_RUN=true` and `QUEST_RUN_ON_START=true` to see the decision the bot would make without spending any clan gold or gems.

### `config/auto-messages.json`

Every entry becomes its own scheduled message:

```json
[
  {
    "name": "quest-vote-reminder",
    "time": "18:00",
    "message": "🔥 | Please vote for the next Clan Quest"
  },
  {
    "name": "weekend-reminder",
    "time": "12:00",
    "days": "6,0",
    "enabled": false,
    "message": [
      "🐺 | Have a great weekend, don't forget your quest participation!",
      "🌙 | Weekend time - join the Clan Quest!"
    ]
  }
]
```

| Field | Description |
| --- | --- |
| `name` | Label used in the logs |
| `time` | Time of day as `HH:MM` |
| `days` | Optional weekdays in cron notation (`*` = daily, `1-5` = Mon–Fri, `6,0` = weekend) |
| `cronTime` | Optional raw cron expression, used instead of `time`/`days` |
| `message` | A single message or a list – a random one is picked per send |
| `enabled` | Set to `false` to keep an entry without scheduling it |

## How the quest automation decides

1. If a quest is already active, the run is skipped.
2. Otherwise the available quests and their votes are fetched.
3. **Shuffle** wins only with *strictly* more votes than the best quest, because shuffling costs clan gold without starting anything – a tie therefore starts the quest.
4. The quest with the most votes is claimed. If nobody voted at all, nothing happens.

> [!WARNING]
> Claiming a quest spends clan gold or gems, and shuffling spends clan gold. The bot only ever acts once per scheduled run and never touches an already active quest.

## Project structure

```
src/
  index.js                  # startup, connects to the clan and schedules the jobs
  config.js                 # .env + auto-messages.json handling
  functions/
    clanQuests.js           # vote counting, decision and quest job
    autoMessages.js         # scheduled clan chat messages
    logger.js               # timestamped console logger
config/
  auto-messages.json        # your message schedule
```

## Development

```bash
npm run lint
```

ESLint also runs on every push and pull request to `main`.
