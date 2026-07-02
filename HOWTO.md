# Patched opencode: TUI subagent indicator

Local build of opencode with a small TUI patch that shows running background
subagents in the footer (e.g. `⏳ 2 subagents`).

## What's different

When the parent session is idle but has background subagents running, the TUI
footer now shows a `⏳ N subagent(s)` indicator. Without this, the parent
session looks "idle" and it's unclear whether the main agent is still working
or whether it's actually waiting for subagents to finish.

When the parent is busy (running a model itself), the busy state wins.
When all subagents finish, the indicator disappears and the parent goes idle.

## Files touched

- `packages/schema/src/session-status-event.ts` — new `waiting` status variant
  with `subagents: number`
- `packages/core/src/background-job.ts` — PubSub-based lifecycle event bus
  (started / settled / cancelled)
- `packages/opencode/src/background/job.ts` — wire up the new `subscribe()`
  method
- `packages/opencode/src/session/run-state.ts` — subscriber that maintains a
  per-parent running count and transitions SessionStatus accordingly
- `packages/tui/src/routes/session/footer.tsx` — render the indicator

## Install / reinstall

The patched binary is at:

```
/var/home/thegalkin/opencode-tui-subagent-indicator/packages/opencode/dist/opencode-linux-x64/bin/opencode
```

A symlink in `~/bin/opencode` already points at it and wins over the
linuxbrew one (verified with `which opencode`).

To rebuild after editing source:

```sh
cd /var/home/thegalkin/opencode-tui-subagent-indicator
bunx bun@1.3.14 --bun packages/opencode/script/build.ts --single --skip-install --skip-embed-web-ui
```

The homebrew `opencode` is left untouched. To revert, just delete the symlink:

```sh
rm ~/bin/opencode
```

## Enable background subagents

This is a `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` feature. Set the
env var (in your shell rc, or per-invocation) when you want agents to be able
to call `task(background=true)`.

## Try it

1. Open the TUI on any project: `opencode .`
2. Ask the main agent to spawn background subagents (e.g. "run 3 explore tasks
   in parallel in the background and tell me when each one finishes")
3. Watch the bottom-right of the TUI: you'll see `⏳ 3 subagents` and the
   count will drop as each subagent finishes

## Upstream

The feature is requested in `anomalyco/opencode#23784`. A broader proposal
(`#32167`) was closed as too large. The patch on branch
`feat/tui-subagent-indicator` in `thegalkin/opencode` is a minimal slice of
that — schema-level waiting status + footer indicator only.

To send upstream: open a PR with the existing branch and reference
`#23784` in the description so maintainers can route it through design review.
