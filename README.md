# ccswarm

Universal macOS launcher for swarms of CLI AI agents (Claude Code, Codex, Hermes,
OpenClaw — anything that runs in a terminal).

It opens an iTerm2 window split into a grid, runs each agent in its own pane,
auto-injects a protocol prompt that tells every agent how to read/write
inter-agent messages via a shared workspace, and then steps out of the way so
you can drive the agents interactively.

## Prerequisites

- macOS
- [iTerm2](https://iterm2.com/) installed
- iTerm2 Python API enabled: **iTerm2 → Settings → General → Magic → Enable Python API**
- Python 3.9+ on your `PATH` with the iTerm2 SDK:
  ```
  python3 -m pip install iterm2
  ```
- Node.js 18+ and npm

## Install & run (dev)

```bash
npm install
npm run dev
```

Build a packaged `.app`:

```bash
npm run dist
```

## How it works

```
~/.ccswarm/
├── agents/                    user-editable agent profiles (JSON)
│   ├── claude-code.json       (seeded from presets on first run)
│   ├── codex.json
│   └── ...
├── config.json                app settings (workspace root, protocol, ...)
└── workspaces/<run-id>/       one directory per swarm launch
    ├── PROTOCOL.md            rendered protocol document
    ├── shared/                shared scratch space
    └── agents/<agent>/
        ├── inbox/             peers drop messages here
        │   └── processed/     move handled messages here
        └── outbox/
```

When you click **Launch swarm**, the app:

1. Creates the per-run workspace dirs above.
2. Asks iTerm2 (via a small Python helper, `resources/iterm-driver.py`) to
   open one window split into N panes — `ceil(sqrt(N))` columns × the rows
   needed.
3. Types `cd <agent-cwd>; <command> <args>` into each pane.
4. Waits each agent's `readyDelayMs`, then types the rendered protocol prompt
   plus the agent's per-agent prompt as if you typed it.
5. Stops orchestrating. From that point you drive the agents in the
   terminal; agents talk to each other by writing files into peer inboxes
   exactly as the protocol describes.

## Settings UI

- **Gateway / Workspace** — workspace root, terminal choice, Python path.
- **Protocol Prompt** — the global template auto-injected to every agent.
  Available variables: `{{agent_name}}`, `{{inbox}}`, `{{outbox}}`,
  `{{shared_dir}}`, `{{workspace}}`, `{{peers_list}}`.
- **General** — auto-start, font size.

## Adding a new agent type

Open the **Agents** tab → **New** (or **Duplicate** an existing preset). The
profile is plain JSON:

```json
{
  "name": "my-agent",
  "displayName": "My Agent",
  "command": "my-cli",
  "args": ["--flag"],
  "env": { "MY_API_KEY": "..." },
  "cwd": "${workspace}/agents/${name}",
  "initialPrompt": "Per-agent role description appended after the protocol.",
  "readyDelayMs": 1500
}
```

Anything that reads stdin works — including `bash` itself, useful for testing.

## Troubleshooting

- *"iterm-driver did not become ready in time"* — open iTerm2 once, enable the
  Python API, and confirm `python3 -c "import iterm2"` succeeds in your shell.
- *Wrong Python* — set the interpreter in **Settings → Gateway / Workspace →
  Python interpreter** (e.g. `/opt/homebrew/bin/python3`).
- *Agent didn't receive the protocol* — increase that profile's
  `readyDelayMs`; some CLIs take a few seconds before they accept stdin.
