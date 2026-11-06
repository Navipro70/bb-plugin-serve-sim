# Simulator (serve-sim) for BB

Stream a live, interactive iOS Simulator into the [BB](https://getbb.app)
thread side panel, powered by Evan Bacon's
[serve-sim](https://github.com/EvanBacon/serve-sim).

- **Simulator (serve-sim)** button in the thread header toggles a side-panel tab.
- Choose a device and press **Start simulator**; the plugin runs serve-sim in
  the background and embeds its full preview (H.264 stream, touch and keyboard
  input, home / screenshot / record / rotate, device grid, logs, Web Inspector).
- `bb serve-sim` CLI and an agent skill, so agents can start the preview and
  drive the same device while you watch.

## Requirements

- macOS on Apple Silicon, Xcode with an iOS Simulator runtime.
- Node.js 20+ on your login-shell `PATH` (serve-sim runs through `npx`).
- BB 0.48+ with its server on the same Mac (BB Desktop). The panel embeds
  `http://localhost:<port>`, so remote web clients cannot show it.

## Install

```sh
bb plugin install git:https://github.com/Navipro70/bb-plugin-serve-sim.git
```

From a checkout:

```sh
npm install --include=dev
bb plugin build
bb plugin install .
```

## CLI

```sh
bb serve-sim status            # running at http://localhost:3200 (iPhone 17 Pro) — pid …
bb serve-sim devices           # available simulators, booted first
bb serve-sim start [device]    # device name or UDID; waits for the preview URL
bb serve-sim stop
bb serve-sim logs              # recent serve-sim output
```

Every command accepts `--json`.

## Settings

`bb plugin config serve-sim` or Settings → Simulator (serve-sim):

| Setting | Default | Meaning |
|---|---|---|
| `command` | `npx --yes serve-sim@0.1.49` | Command used to start serve-sim (runs in your login shell). Point it at a local build or global install. |
| `port` | `3200` | Preview port. At 3200 serve-sim scans upward when busy; any other value is pinned. |
| `extraArgs` | – | Extra flags, e.g. `--codec mjpeg`, `--theme dark`, `--fit`. |

## How it works

`server.ts` spawns serve-sim in its own process group through your login
shell, reads the `Local: http://localhost:<port>` line, and publishes status
over BB realtime. `app.tsx` registers the side-panel tab and header button and
embeds serve-sim's preview page in an iframe. That page talks to serve-sim's
same-origin WebSocket for input, so nothing is re-implemented. Reloading,
disabling or removing the plugin stops serve-sim.

## License

Apache-2.0. serve-sim is © Evan Bacon, Apache-2.0, and is downloaded at run
time, not bundled.
