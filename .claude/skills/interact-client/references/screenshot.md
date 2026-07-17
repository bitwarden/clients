# Screenshots & DOM snapshots

Two ways to observe the running app. Pick by intent: **snapshot to locate**, **screenshot to
show**. Use the correct MCP tool prefix for the active target (`mcp__electron-devtools__*` for
desktop, `mcp__chrome-devtools__*` for browser extension / web).

## DOM snapshot (preferred for locating elements)

`take_snapshot` returns an accessibility tree with element `uid`s. Those `uid`s are what the
interaction tools (`click`, `fill`, `fill_form`) operate on, so snapshot first whenever you need to
act on the UI.

```
take_snapshot          # accessibility tree + uids
```

The Bitwarden clients are single-page Angular apps — locate elements by their accessible name in
the snapshot, not by URL.

## Screenshot (for reporting visual state)

Use `take_screenshot` whenever the user asks to "see" or "show" the current state, or to verify the
result of a flow.

```
take_screenshot                  # current viewport
take_screenshot fullPage: true   # full window / page
```

## Guidance

- Prefer `take_snapshot` over `take_screenshot` for finding things to click; screenshots are for
  human-visible confirmation.
- After navigation or a transition, `wait_for` the expected text before snapshotting/screenshotting
  so you capture the settled state.
- In flows, take a screenshot after each meaningful step to document progress.
