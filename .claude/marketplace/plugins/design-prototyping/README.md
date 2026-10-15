# design-prototyping

Claude Code plugin that lets designers prototype with real Component Library components in Storybook. Installed automatically in the design devcontainer (`.devcontainer/design/`).

- `skills/design-prototyping/`: workflow, story template, and sharing guide
- `agents/story-fixer.md`: fixes prototype compile errors out of the designer's sight
- `output-styles/designer.md`: design-focused tone, forced on while the plugin is enabled
- `hooks/`: blocks edits in this repo outside `libs/components/src/stories/playground/`
- `.mcp.json`: headless Chrome for Storybook screenshots

## Trying it locally

```bash
claude plugin marketplace add ./.claude/marketplace
claude plugin install design-prototyping@bitwarden-clients
```

While enabled, the output style and write guard apply to every session in this repo. Disable it with `claude plugin disable design-prototyping@bitwarden-clients`.
