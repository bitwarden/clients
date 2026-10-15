---
name: design-prototyping
description: Prototype screens and UI ideas for a designer using real Bitwarden Component Library components, rendered live in Storybook. Use whenever a designer asks to build, mock up, prototype, tweak, or share a screen, layout, flow, or component arrangement, or asks what components exist.
---

# Design Prototyping

You help a designer prototype with real `libs/components` pieces. Each prototype is a Storybook story in the playground. The designer watches it live in Storybook while you iterate together.

## Ground rules

- **Compose, don't create.** Build from existing Component Library components and Tailwind utilities. Never edit library or app source; a hook enforces this. If something is missing, use the closest existing option and tell the designer.
- **Only write in the playground:** `libs/components/src/stories/playground/<prototype-name>/`.
- **Tailwind classes use the `tw-` prefix** and the semantic color tokens the library uses (e.g. `tw-bg-bg-primary`, `tw-text-fg-heading`). Unprefixed classes silently do nothing.
- **Keep code out of the conversation.** See the Designer output style.

## Workflow

### 1. Make sure Storybook is running

Check `http://localhost:6006`. In the design Codespace it starts automatically and logs to `/tmp/storybook.log`; first boot takes a few minutes. If it isn't running, start it in the background with `npm run storybook > /tmp/storybook.log 2>&1` and tell the designer it's warming up. Reuse a running server; never start a second one.

### 2. Understand the request and discover components

- Ask at most one or two clarifying questions, in design terms, if the request is ambiguous. Otherwise make a reasonable first pass; iterating is cheap.
- Find candidate components in `libs/components/src/<component>/`. Each has a `.mdx` doc (usage guidance) and `.stories.ts` (working examples and inputs). Read these before using a component you haven't used in this session.
- `libs/components/src/stories/kitchen-sink/` shows many components composed into full pages (layout, navigation, tables, dialogs, forms). Use it as the reference for page-level prototypes.
- When the designer shares a Figma link and the Figma MCP is available, read the design for structure and content, then map it onto library components.

### 3. Build the story

Follow [references/story-template.md](references/story-template.md). One folder per prototype; one story per meaningful variant or state the designer cares about.

### 4. Verify, then show

- Storybook hot-reloads. Watch `/tmp/storybook.log` (or the Storybook terminal) for compile errors after each change. Fix them yourself; delegate stubborn compile errors to the `story-fixer` subagent. The designer should never see them.
- Screenshot the story with the `storybook-browser` tools at `http://localhost:6006/iframe.html?id=<story-id>&viewMode=story` to check your own work: layout, spacing, overflow, empty or broken areas. Story IDs are the kebab-cased title and export name, e.g. title `Playground / Vault Empty State`, export `Default` → `playground-vault-empty-state--default`.
- Tell the designer where to look: the story's sidebar path, or the full URL `http://localhost:6006/?path=/story/<story-id>`.
- Share screenshots only when they help: comparing light vs dark (`&globals=theme:dark`), or narrow vs wide viewports (resize the page).

### 5. Iterate

Apply the designer's feedback in small steps and summarize each change in a sentence. Offer relevant states the designer might not have considered (empty, loading, error, long content, narrow screen), but don't build them unasked.

### 6. Share or hand off

When the designer wants to share, follow [references/sharing.md](references/sharing.md).

## Boundaries

- Don't run lint, type-check, or unit tests unless the designer asks for a handoff-quality version.
- Don't add i18n keys, services, or app wiring. Use literal strings and the mocks in the template.
- Don't commit, push, or open PRs except through the sharing flow, and always confirm first.
