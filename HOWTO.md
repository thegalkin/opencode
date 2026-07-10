# Patched opencode: TUI subagent indicator (sidecar)

Local build of opencode that shows running background subagents in the TUI
footer (e.g. `⏳ 2 subagents`).

## Why this is structured the way it is

The whole point of this patch is to be **dead-code-friendly when upstream
ships a fix**. If `anomalyco/opencode` (or anyone) eventually adds their
own subagent indicator — whether a `waiting` SessionStatus variant, a new
event, or a tree view — our local patch should become inert without
fights, not a permanent fork.

To achieve that, the patch follows three rules:

1. **No modifications to existing upstream types or interfaces.** Nothing in
   `packages/schema/src/session-status-event.ts`,
   `packages/core/src/background-job.ts`, or any existing service
   interface is touched. The `BackgroundJob.subscribe()` method we
   prototyped in v1 was removed.
2. **All new code lives in new files** under `packages/schema/src/local-*`
   and `packages/opencode/src/local/`. The `local.` prefix on the event
   type (`local.subagent.indicator`) is intentional — it cannot collide
   with anything upstream picks.
3. **Everything is gated by `experimental.localSubagentIndicator`** in
   `RuntimeFlags`. Off → sidecar is a no-op, no events fire, the TUI
   shows nothing from us. On → the sidecar runs.

The TUI checks both `session.status` (upstream's) and
`local_subagent_indicator` (ours). If upstream ships a `waiting` variant
with the same field, both indicators will agree. If upstream ships
something with a different shape, our footer just keeps reading from the
local channel; the user disables the flag and we're invisible.

## Architecture

```
   BackgroundJob.list()  ───  sidecar (polls every 1s)  ──>  EventV2.publish
                                                                   │
                                                                   ▼
   TUI event listener  ◄────  EventV2 stream  ◄────  "local.subagent.indicator"
         │
         ▼
   sync store: local_subagent_indicator[sessionID] = { count }
         │
         ▼
   Footer renders: "⏳ N subagent(s)" when count > 0
```

**Polling at 1 second** instead of subscribing to BackgroundJob events.
This is intentional: it requires zero changes to `core/background-job.ts`.
The cost is up to 1 second of staleness on the indicator — acceptable
for a footer counter.

## Files

- `packages/schema/src/local-subagent-indicator-event.ts` — new event
  def: `local.subagent.indicator` with `{ sessionID, info: { count } }`
- `packages/schema/src/event-manifest.ts` — adds the new event to the
  inventory (additive — only a new line)
- `packages/opencode/src/effect/runtime-flags.ts` — adds the
  `experimentalLocalSubagentIndicator` flag (additive — new line)
- `packages/opencode/src/local/subagent-indicator.ts` — **new file**,
  the sidecar service
- `packages/opencode/src/server/server.ts` — wires the sidecar into the
  server layer composition (one new `Layer.provideMerge` line)
- `packages/tui/src/context/sync.tsx` — adds the
  `local_subagent_indicator` field to the sync store (additive — new
  field, new line in initial state, new `event.on` listener)
- `packages/tui/src/routes/session/footer.tsx` — renders the indicator
  (additive — new `<Show>` block, no changes to existing code paths)

## Install / rebuild

The patched binary lives at:

```
/var/home/thegalkin/opencode-tui-subagent-indicator/packages/opencode/dist/opencode-linux-x64/bin/opencode
```

A symlink at `~/bin/opencode` already points at it and wins over the
linuxbrew version (`which opencode` confirms). To revert, just delete
the symlink — the linuxbrew opencode stays untouched.

To rebuild after editing source:

```sh
cd /var/home/thegalkin/opencode-tui-subagent-indicator
bun script/generate.ts                       # regen SDK
bunx bun@1.3.14 --bun packages/opencode/script/build.ts --single --skip-install --skip-embed-web-ui
```

## Enabling the indicator

Set the env var before launching opencode:

```sh
# Either: enable only this feature
export OPENCODE_EXPERIMENTAL_LOCAL_SUBAGENT_INDICATOR=true

# Or: enable the umbrella that turns on all experiments
export OPENCODE_EXPERIMENTAL=true
```

(These are read from `RuntimeFlags` via the standard `enabledByExperimental`
helper — the same mechanism used by `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`
and friends.)

When the flag is off, the sidecar layer is a no-op: no fiber starts, no
BackgroundJob polling, no events fire. The TUI sees an empty
`local_subagent_indicator` map and renders nothing extra.

## Upstream behavior

If/when `anomalyco/opencode` ships its own fix:

- They likely use a different flag name → our flag stays meaningful, no
  conflict, the user can keep using our local version
- They use the same flag name (`experimentalLocalSubagentIndicator`) → user
  turns our flag off, upstream's solution takes over
- They add a different mechanism entirely (a `waiting` SessionStatus
  variant, a tree view, etc.) → user can keep both: our footer indicator
  shows the count, upstream's view shows the tree
- They add a `local.subagent.indicator` event with a different payload
  shape → TS compile error on the TUI's `event.on("local.subagent.indicator", ...)`
  call. Fix: remove that line (or just disable the flag)

In the worst case, removing our patch is `git rm packages/opencode/src/local/
packages/schema/src/local-subagent-indicator-event.ts` and reverting the
~5 additive lines in `event-manifest.ts`, `runtime-flags.ts`, `server.ts`,
`sync.tsx`, `footer.tsx`.

## How to test

1. Set the env var: `export OPENCODE_EXPERIMENTAL_LOCAL_SUBAGENT_INDICATOR=true`
2. Open the TUI on any project: `opencode .`
3. Ask the main agent to spawn background subagents, e.g.:
   "Run 3 explore tasks in parallel in the background and tell me when each
   one finishes"
4. Watch the bottom-right of the TUI: `⏳ 3 subagents` appears, count
   drops as each subagent finishes, indicator disappears when all done

If nothing shows up, check:

- `opencode --version` returns `0.0.0-feat/tui-subagent-indicator-...`
- The env var is set in the same shell as `opencode`
- The main agent actually called the `task` tool with `background=true`
  (and `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` or the umbrella
  is set)
