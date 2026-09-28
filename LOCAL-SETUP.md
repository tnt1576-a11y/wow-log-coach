# WoW Log Coach v0.4.7 — local installation

This ZIP runs the full current coach on your computer. The local app opens
without a login or password. This project is maintained for local use.

## Windows quick start

1. Install Node.js 24 or newer from https://nodejs.org/ if needed.
2. Extract the ZIP to a normal folder. Do not run the launchers inside the ZIP.
3. Double-click SETUP_LOCAL.cmd. It installs dependencies, creates or repairs the two WCL fields in .env.local
   while preserving existing settings, and builds the app. Internet access is required for this step.
4. Double-click START_LOCAL.cmd. It opens the app at http://127.0.0.1:3000.
   No app password or password setup is required.
5. Choose Explore a sample review to try it without API credentials.

For real logs, each recipient should create their own Warcraft Logs API v2
client at https://www.warcraftlogs.com/api/clients/ and put its values in
.env.local:

```text
WCL_CLIENT_ID=your-client-id
WCL_CLIENT_SECRET=your-client-secret
```

Restart START_LOCAL.cmd after editing credentials. Setup preserves existing values and adds missing credential field names to
.env.local. The filename is .env.local (not .enc.local or .env.local.txt). The ZIP does not contain the sender's credentials or password.

Keep the server window open while using the app. Press Ctrl+C there to stop.
The local server listens only on 127.0.0.1. Use the exact address the launcher
prints; old localhost bookmarks are not the configured local address.

## macOS or Linux

From the extracted folder, run:

```sh
npm ci --include=dev
node scripts/setup-local-env.mjs
npm run build
npm run start
```

Then open http://127.0.0.1:3000. No app password is required. Enter your own WCL
credentials in .env.local and restart before analyzing real logs.

## Updating and troubleshooting

- Install this update in a fresh folder, copy over your own .env.local if needed,
  then run SETUP_LOCAL.cmd. Do not share your configured .env.local.
- If node or npm is missing, install Node.js 24+ and reopen the launcher.
- If port 3000 is in use, close the other server or add PORT=3001 to .env.local.
  The launcher prints the matching address.
- If an old login page appears, use the address printed by START_LOCAL.cmd.
  Re-run SETUP_LOCAL.cmd to replace an old build.
- If credentials are missing or rejected, edit both WCL values and restart.
- The top bar shows the last observed API points and a local reset countdown.
  Idle tabs do not query WCL. Check quota makes an explicit live check (one point
  in our test), throttled to once a minute. Normal report responses update usage.
- At 99–100 percentile, fewer than 20 matches may qualify. Twenty is a maximum,
  not a completion target. The progress panel shows matches and candidates
  checked separately; the result explains why candidates were filtered. Ranking
  eligibility is checked before downloading candidate reports and player tables.
- Each review has a spending allowance up to 600 points, reduced for low quota,
  plus a 60-candidate search limit. Estimates stop new calls before the next
  request is likely to exceed the allowance; exact request cost can vary.
  If the search stops, completed references remain visible. The hourly 10%
  safety reserve also remains active. Cached responses can still be reused.

This is an installation ZIP, not an offline standalone executable. Dependencies
and the build are installed locally. A later launch does not require reinstalling.
It includes raid kills, Mythic+ comparisons, rotation/cooldown timelines, incoming
damage and external-defensive review, game tooltips, and the visible app version.

For a walkthrough of each review view, see [the user guide](docs/USER_GUIDE.md).
