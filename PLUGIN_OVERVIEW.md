## What you get

A **Simulator** button in every thread header opens a side-panel tab with a
live, interactive iOS Simulator. Click to tap, drag to swipe, type to send
keys, and use serve-sim's own toolbar for home, screenshots, recording,
rotation, the device grid, logs and Safari Web Inspector.

Pick a device (booted ones are listed first) and press **Start simulator**.
The plugin runs [serve-sim](https://github.com/EvanBacon/serve-sim) in the
background and keeps it running while you switch threads; **Stop** in the
panel toolbar ends it.

## For agents

`bb serve-sim start|stop|status|devices|logs` controls the preview from a
shell, and the bundled skill shows agents how to drive the same device with
`npx serve-sim tap|type|button|gesture` while you watch.

## Requirements

An Apple Silicon Mac with Xcode, an iOS Simulator runtime and Node.js 20+.
The BB server must run on that Mac: the panel embeds serve-sim's preview at
`http://localhost:<port>`, so it works in BB Desktop, not from a remote web
client. No account or external service is needed; the first start downloads
serve-sim through npx.
