# NanoClaw Migration Guide

Generated: 2026-04-28
Updated: 2026-05-14
Base: 934f063aff5c30e7b49ce58b53b41901d3472a3e
HEAD at generation: 8b21c41
Upgraded to upstream: b779a0b (v2.0.60)
Current HEAD after upgrade: 8b21c41

## Migration Summary

This is a v1 → v2 major upgrade. The primary customizations are:
1. Discord channel integration (custom table rendering logic)
2. systemd service file for Linux
3. Nix development environment
4. GitHub CI/fork-sync workflow
5. Apple Container runtime support (skill/apple-container + post-merge fixes)
6. Native credential proxy (skill/native-credential-proxy + post-merge fixes)
7. Channel-aware text formatting (skill/channel-formatting)
8. Emacs channel integration (skill/emacs)
9. Additional skills: compact, ollama-tool, qmd, setup-dynamic-context, native-credential-proxy

## Applied Skills (from upstream branches)

Apply all of these in the worktree via `git merge upstream/<branch> --no-edit`:

- `channels` — branch `upstream/channels` — v2 Discord, Telegram, Slack, WhatsApp, Signal adapters
- `skill/apple-container` — Apple Container runtime support (macOS 15+)
- `skill/native-credential-proxy` — Credential proxy (replaces OneCLI gateway)
- `skill/channel-formatting` — Channel-aware Markdown text formatting
- `skill/emacs` — Emacs channel via HTTP bridge
- `skill/compact` — Conversation compaction skill
- `skill/ollama-tool` — Ollama local model tool
- `skill/qmd` — QMD document skill
- `skill/setup-dynamic-context` — Dynamic context setup

Apply in this order (channels first, then skills):
```bash
cd "$WORKTREE" && git merge upstream/channels --no-edit
cd "$WORKTREE" && git merge upstream/skill/apple-container --no-edit
cd "$WORKTREE" && git merge upstream/skill/native-credential-proxy --no-edit
cd "$WORKTREE" && git merge upstream/skill/channel-formatting --no-edit
cd "$WORKTREE" && git merge upstream/skill/emacs --no-edit
cd "$WORKTREE" && git merge upstream/skill/compact --no-edit
cd "$WORKTREE" && git merge upstream/skill/ollama-tool --no-edit
cd "$WORKTREE" && git merge upstream/skill/qmd --no-edit
cd "$WORKTREE" && git merge upstream/skill/setup-dynamic-context --no-edit
```

## Skill Interactions

**apple-container + native-credential-proxy** both modify `src/container-runtime.ts`. After merging both, apply the post-merge fix described in "Post-Merge: container-runtime.ts and credential-proxy.ts Fixes" below — specifically:
- Remove any duplicate declarations of `CONTAINER_HOST_GATEWAY` and `PROXY_BIND_HOST`
- Fix `logger` import: use `log` from `'./log.js'` (not `logger` from `'./logger.js'`)
- Make `PROXY_BIND_HOST` optional (read from `process.env.CREDENTIAL_PROXY_HOST`, no fatal if missing)

## Customizations

### Post-Merge: container-runtime.ts and credential-proxy.ts Fixes

**Intent:** After merging both `skill/apple-container` and `skill/native-credential-proxy`, the resulting `src/container-runtime.ts` has duplicate declarations and a wrong logger import. This section documents the manual cleanup needed.

**Files:**
- `src/container-runtime.ts`
- `src/credential-proxy.ts`

**How to apply:**

1. In `src/container-runtime.ts`, fix the import (replace `logger` from `logger.js` with `log` from `log.js`):
   ```typescript
   // WRONG (from skill merge):
   import { logger } from './logger.js';
   // CORRECT:
   import { log } from './log.js';
   ```

2. Remove any duplicate declarations of `CONTAINER_HOST_GATEWAY` or `PROXY_BIND_HOST` — keep exactly one of each.

3. Ensure `PROXY_BIND_HOST` is optional (no fatal error if `CREDENTIAL_PROXY_HOST` is unset):
   ```typescript
   export const PROXY_BIND_HOST = process.env.CREDENTIAL_PROXY_HOST;
   ```
   (Do NOT throw if undefined — the proxy starts before containers, so the env var may be set later.)

4. In `src/credential-proxy.ts`, the logger import must use `log` (not `logger`):
   ```typescript
   import { log as logger } from './log.js';
   ```

5. Ensure `readonlyMountArgs` uses Apple Container syntax (`--mount` not `-v`):
   ```typescript
   export function readonlyMountArgs(hostPath: string, containerPath: string): string[] {
     return ['--mount', `type=bind,source=${hostPath},target=${containerPath},readonly`];
   }
   ```

---

### Discord: Markdown Table Rendering (discord-table.ts)

**Intent:** Markdown tables are automatically converted to ASCII art code blocks before being sent via Discord. This makes tabular data readable in Discord's monospace font. Two strategies are implemented: ASCII art fallback and Discord native embeds.

**Files:**
- `src/discord-table.ts` — copy verbatim from main tree
- `src/discord-table.test.ts` — copy verbatim from main tree
- `src/channels/discord.ts` — modify the v2 adapter to apply table conversion

**How to apply:**

1. Copy both files into the worktree:
   ```bash
   cp "$PROJECT_ROOT/src/discord-table.ts" "$WORKTREE/src/discord-table.ts"
   cp "$PROJECT_ROOT/src/discord-table.test.ts" "$WORKTREE/src/discord-table.test.ts"
   ```

2. Modify `$WORKTREE/src/channels/discord.ts` (the v2 adapter from the `channels` branch) to import and apply `convertMarkdownTables`.

   Add this import near the top of the file (after existing imports):
   ```typescript
   import { convertMarkdownTables } from '../discord-table.js';
   ```

   Add `transformOutboundText: convertMarkdownTables` inside the `createChatSdkBridge({...})` call:
   ```typescript
   return createChatSdkBridge({
     adapter: discordAdapter,
     concurrency: 'concurrent',
     botToken: env.DISCORD_BOT_TOKEN,
     extractReplyContext,
     supportsThreads: true,
     transformOutboundText: convertMarkdownTables,  // ← add this line
   });
   ```

**Note on new required env vars:** The v2 Discord adapter requires two additional environment variables beyond what v1 needed:
- `DISCORD_PUBLIC_KEY` — Discord application public key
- `DISCORD_APPLICATION_ID` — Discord application ID

Add these to `.env` alongside `DISCORD_BOT_TOKEN`.

---

### systemd Service File

**Intent:** Runs NanoClaw as a systemd user service on Linux. Supports restart-on-failure, custom PATH, and separate log files for stdout/stderr.

**Files:** `systemd/nanoclaw.service`

**How to apply:** Copy verbatim from main tree:
```bash
cp "$PROJECT_ROOT/systemd/nanoclaw.service" "$WORKTREE/systemd/nanoclaw.service"
```

The file contains template placeholders (`{{PROJECT_ROOT}}`, `{{NODE_PATH}}`, `{{HOME}}`) that must be filled in at install time. The `ASSISTANT_NAME=Andy` environment variable is also set here.

Current file content:
```ini
[Unit]
Description=NanoClaw Personal Claude Assistant
After=network.target

[Service]
Type=simple
WorkingDirectory={{PROJECT_ROOT}}
ExecStart={{NODE_PATH}} {{PROJECT_ROOT}}/dist/index.js
Restart=always
RestartSec=5

Environment=PATH={{HOME}}/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=HOME={{HOME}}
Environment=ASSISTANT_NAME=Andy

StandardOutput=append:{{PROJECT_ROOT}}/logs/nanoclaw.log
StandardError=append:{{PROJECT_ROOT}}/logs/nanoclaw.error.log

[Install]
WantedBy=default.target
```

---

### Nix Development Environment

**Intent:** Provides a reproducible dev shell with Node.js 22 and npm via Nix flakes. Used with direnv (`.envrc` contains `use flake`).

**Files:** `flake.nix`, `flake.lock`, `.envrc`

**How to apply:** Copy all three files verbatim from main tree:
```bash
cp "$PROJECT_ROOT/flake.nix" "$WORKTREE/flake.nix"
cp "$PROJECT_ROOT/flake.lock" "$WORKTREE/flake.lock"
cp "$PROJECT_ROOT/.envrc" "$WORKTREE/.envrc"
```

---

### GitHub CI / Fork-Sync Workflow

**Intent:** Automatically syncs this fork with upstream `qwibitai/nanoclaw` every 6 hours (and on push). Also merge-forwards skill branches. On failure, creates a GitHub issue automatically.

**Files:** `.github/workflows/fork-sync-skills.yml`

**How to apply:** Copy verbatim from main tree:
```bash
cp "$PROJECT_ROOT/.github/workflows/fork-sync-skills.yml" "$WORKTREE/.github/workflows/fork-sync-skills.yml"
```

---

### .env.example: Discord Token Entry

**Intent:** Documents the `DISCORD_BOT_TOKEN` env var as required.

**Files:** `.env.example`

**How to apply:** After the `channels` branch is merged, the `.env.example` may already have Discord entries. If not, add:
```
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=
```

---

## Data / User Content (do not touch)

These are user data, not code. Do not copy or migrate — they already exist in the live install:

- `groups/global/CLAUDE.md` — Andy persona and behavioral guidelines. Copy from main tree after upgrade if it doesn't exist in the live groups directory.
- `groups/` — all group state and memory
- `store/` — persistent storage
- `.env` — credentials

### groups/global/CLAUDE.md Persona

The agent persona is named **Andy** and is defined as a personal strategic partner. Key behavioral guidelines:

- Three thinking frames: L1 (immediate resolution), L2 (structural improvement), L3 (long-term capital)
- "Teach to fish, not give fish" — prefer structural over temporary solutions
- Wellness buffer prioritization
- Channel-specific Markdown: Discord (standard), Slack (mrkdwn), WhatsApp/Telegram (WhatsApp syntax)

To restore after upgrade, copy from the backup:
```bash
cp backup-branch:groups/global/CLAUDE.md groups/global/CLAUDE.md
```
Or check out from the backup tag: `git show pre-migrate-<HASH>-<TIMESTAMP>:groups/global/CLAUDE.md > groups/global/CLAUDE.md`
