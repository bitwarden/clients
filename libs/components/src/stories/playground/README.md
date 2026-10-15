# Design Playground

Prototype stories created by designers with the `design-prototyping` Claude Code plugin. They compose existing Component Library pieces and appear in Storybook under **Playground**.

These are prototypes, not production code:

- Each prototype lives in its own folder: `playground/<prototype-name>/<prototype-name>.stories.ts`.
- Stories set `chromatic: { disableSnapshot: true }` so they publish to Chromatic without visual snapshots.
- Prototypes are committed only on `design/*` branches and shared through draft PRs. Don't merge them to `main`.
