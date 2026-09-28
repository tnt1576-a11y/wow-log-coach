# User guide

## 1. Install and open the app

Follow [local setup](../LOCAL-SETUP.md). Use the exact address printed by START_LOCAL.cmd or npm run start. The standard address is http://127.0.0.1:3000.

Choose **Explore a sample review** to learn the interface without credentials or API spending. The sample's player, equipment and combat events are illustrative.

## 2. Connect Warcraft Logs

1. Sign in to [Warcraft Logs](https://www.warcraftlogs.com/api/clients/) and create an API v2 client for your own use.
2. Stop the local server. Open .env.local in a text editor.
3. Fill WCL_CLIENT_ID and WCL_CLIENT_SECRET with your own values. Do not add them to source files.
4. Start the app again. The header should indicate that the API is configured.

The filename is **.env.local**, not .enc.local or .env.local.txt. SETUP_LOCAL.cmd creates both field names and preserves existing settings. Each person receiving a ZIP must supply their own credentials.

## 3. Pick a report and player

Paste a public Warcraft Logs report URL and select **Inspect report**. Choose a timed Mythic+ run or completed raid boss kill, then a DPS player from that fight. Reports with several encounters can have different ranking contexts; the chosen fight determines the comparison.

Private logs, unranked encounters, missing ranking metadata, unsupported roles, wipes and LFR may not be eligible. Inspecting and analyzing real reports uses the API budget.

## 4. Choose comparable references

| Control | Meaning |
| --- | --- |
| DPS percentile | For Mythic+, percentile within the same key bracket. For raids, boss DPS percentile. Start with 95–100; 99–100 is a smaller pool. |
| Log age | Default: last 14 days. Other presets and custom dates may find more candidates. All dates still stay in the current ranking partition. |
| Match affixes | Used below +12. The interface disables it for +12 and above and for raids. |
| Similar kill duration | Raid-only tolerance, default ±20%, to reduce differences caused by the number of possible cooldown uses. |

Select **Compare**. Matches found and candidates checked are separate counts: seven matches can be a completed search. Up to 20 are included; 20 is not required. The progress log and References explain filters, unavailable data, and spending stops. Cancel stops your connection; another tab sharing that comparison may keep it running.

## 5. Read the review

Start with **Run review**. Open the timestamp and supporting evidence for one priority, then choose a specific action to practice. Treat differences as questions to check against encounter context.

### Rotation comparison

Choose one reference player and a pull/window for each player. Unique matching boss IDs can pair automatically; trash and ambiguous bosses need manual selection. Compare chronological casts or ability tracks in the same 10-, 30-, or 60-second window. The shorter pull bounds the shared duration. Gaps can reflect mechanics, movement, channels, or missing events.

### Cooldown timing, including raids

Choose recorded abilities and load reference timelines as needed. Compare exact timestamps in seconds or relative fight percentage. Raid casts align to pull start: phase transitions and assignments are not automatically aligned. A later cast can be intentional; the timeline does not prove the ability was ready earlier.

### Defensives & survival

Select a death or incoming-damage peak. Inspect the attacks, enemy sources, personal defensive casts, and available external defensive auras. Compare what was recorded before, during, and after the danger window. External support and self-casts are distinguished; active coverage requires recorded aura evidence when available.

Choose a reference danger window independently. Suggested similar attacks use spell IDs and available enemy names, but you should confirm the occurrence and encounter context. A different health pool, pull, mitigation source, or healer response can change the outcome. Missing protection data is not proof that nothing was used.

### Gear, stats, damage, and buffs

Use **Gear & stats** for item level, equipment slots, raw ratings, enchants and gems when the log includes a snapshot. Select one reference to inspect an actual equipped pair of rings or trinkets; cohort popularity is not a best-in-slot recommendation.

Use **Damage diagnosis** and **Abilities & buffs** to separate cast-frequency differences from damage per cast and buff uptime. Spell links and tooltips provide context, but current game descriptions can differ from historical log mechanics.

### Spec guides and practice

Supported Mythic+ specs get additional guide tabs with recorded states, build context, moments and reference examples. Unknown talent or aura state limits which checks can run. **Practice workshop** helps turn evidence into a next-run focus. See [feature coverage](FEATURES.md) for the implemented specs.

## 6. Understand your API budget

The header shows the **last observed** balance and a local reset countdown. Idle time does not request a new WCL balance. Check quota makes a live request and is throttled to once per minute. Refreshing the browser does not reset Warcraft Logs' quota.

Searches retain up to 60 candidates over three ranking pages. A review's allowance is at most 600 points and shrinks with remaining quota; a separate hourly reserve remains active. Eligibility checks run before expensive candidate downloads. When spending stops, the review keeps completed references and explains its limits. Detailed reference event views can use additional points.

While the server stays running, completed report responses are cached for up to an hour and rankings/finished comparisons for ten minutes, subject to memory limits. Restarting the app clears in-memory caches; it does not reset the provider's budget.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Missing credentials | Both WCL fields must be filled in .env.local; restart the server. |
| Old login screen | Use the address printed by START_LOCAL.cmd and rebuild with SETUP_LOCAL.cmd. |
| Few or no references | Read filter reasons. Try a wider percentile/date range if that comparison suits your goal. |
| Insufficient sample | Fewer than eight peers limits cohort advice. Individual event evidence can still be useful. |
| Gear or stats unavailable | The log may omit snapshots; the app does not reconstruct them from a current armory. |
| API spending stopped | Use retained results or wait for the reported reset. Repeated refreshes do not add quota. |
| Port already used | Stop the older server or set PORT=3001 in .env.local. |
| Stale app after update | Stop the old server, extract into a fresh folder, copy your own .env.local, run setup, then start. |

## Sharing results and reporting problems

Exported analysis JSON can contain player names, report IDs, equipment, and combat details. Review it before sharing. For a bug report, provide the app version, operating system, selected filters and a redacted error description. Share only report URLs you are comfortable making public. Never attach .env.local, password files, access tokens, or API credentials. See [security](../SECURITY.md).
