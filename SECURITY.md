# Security and privacy

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/tnt1576-a11y/wow-log-coach/security/advisories/new). Do not post credentials or a working exploit containing private data in a public issue. Include the affected version, reproduction steps and a redacted description of impact.

## Credentials and local access

- Put your own WCL_CLIENT_ID and WCL_CLIENT_SECRET in .env.local. Only blank examples belong in Git.
- The local launcher listens on 127.0.0.1 and does not require an app password. Host/origin checks remain active. This is a local application, not a supported public multi-user service.
- Warcraft Logs credentials and OAuth tokens are used by server code. The browser receives analysis data, not the API secret.
- Legacy hosted authentication code remains for compatibility; it is not part of the normal local setup. Never commit its password hash, signing secret or generated access file.
- .env files, work directories, build output, local releases, password files and common key/database formats are excluded from Git. Ignore rules do not protect files already committed: review the staged diff before pushing.

## What can leave your computer

Real analysis sends report queries to Warcraft Logs. Icons and on-demand game details may contact Wowhead; links can open those services. Report responses and completed comparisons are cached in server memory within limits. Exported JSON and screenshots can contain player/report information, so review them before sharing.

## Checks before a public release

Scan both the current tracked files and **all Git history, branches and tags**, plus release archives. This project uses [Gitleaks](https://github.com/gitleaks/gitleaks) in CI with redacted output. A known-value check against local credentials is also useful; it must never print those values. Scanners reduce risk but cannot prove that every possible secret is absent.

If a real credential was ever committed, revoke/rotate it before publication and remove it from all reachable history and release assets. Deleting it only in the latest commit is insufficient. Keep audit reports that might contain findings outside Git.

## Dependency maintenance

Install with npm ci from the lockfile. Review dependency advisories before upgrading, and rerun tests, runtime checks and the production build. Do not use npm audit fix --force without reviewing its compatibility impact.
