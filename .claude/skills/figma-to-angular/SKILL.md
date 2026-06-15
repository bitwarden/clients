---
name: figma-to-angular
description: >
  Converts Figma designs into production Angular components with Storybook stories for the Bitwarden
  Clients monorepo. Use this skill whenever the user provides a Figma URL and wants to create an
  Angular component, or mentions "implement this design", "create a component from Figma",
  "build this from the design spec", or similar. Also trigger when the user pastes a Figma link
  and asks for a component, even if they don't say "Figma" explicitly.
---

# Figma to Angular Component

This skill turns a Figma design spec into a fully implemented Angular component with Storybook
stories in the Bitwarden Clients monorepo. The output should match the design visually while
following all codebase conventions.

## Workflow

### Phase 1: Extract the design

Call `get_design_context` from the Figma MCP server. Extract the fileKey and nodeId from the URL:

- `figma.com/design/:fileKey/:fileName?node-id=:nodeId` → convert `-` to `:` in nodeId
- Pass `clientFrameworks: "angular"` and `clientLanguages: "typescript,html,css"`

The response contains reference code (React+Tailwind), a screenshot, and design metadata. Treat the
code as a **structural reference only** — it must be fully converted to Angular.

### Phase 2: Explore the codebase

Before writing any code, understand the conventions of the target location. Use an Explore agent to
discover:

1. **Component file patterns** — look at 2–3 sibling components in the same directory. Note the
   file naming, module structure, barrel exports, and whether they use standalone components.
2. **Existing components to reuse** — search for components that match parts of the design (labels,
   buttons, inputs, icons). Reuse them instead of reimplementing.
3. **Tailwind configuration** — read the relevant `tailwind.config` to understand the prefix
   (commonly `tw-`), available design tokens, and color system.
4. **Storybook patterns** — check how sibling stories are structured: imports, `moduleMetadata`,
   `I18nMockService` usage, `argTypes`.
5. **i18n setup** — find the `I18nPipe` import path and the locale messages file to add new keys.

This exploration is critical. Skipping it leads to components that don't match the codebase and
require extensive rework.

### Phase 3: Map design tokens

Create a mapping from Figma's design values to the codebase's Tailwind tokens. The Figma response
includes raw CSS values (hex colors, px sizes). These must be translated to semantic tokens.

Common mappings for Bitwarden:

| Figma concept      | Where to look                                               |
| ------------------ | ----------------------------------------------------------- |
| Colors (hex)       | `tailwind.config` → `colors`, `bg`, `fg`, `border` sections |
| Font sizes         | `tailwind.config` → `extend.fontSize`                       |
| Spacing / padding  | Standard Tailwind scale with prefix                         |
| Border radius      | Standard Tailwind (`rounded-*`)                             |
| Component variants | Existing component source (e.g. `base-button.directive.ts`) |

Never use raw hex values. Always map to a semantic token. If no exact match exists, use the closest
available token and note the discrepancy.

### Phase 4: Plan the component

Before writing code, create a plan covering:

- **Selector** — follows the relevant prefix convention
- **Inputs and outputs** — use Angular signal-based `input()` and `output()` functions
- **Content projection** — identify slots for `<ng-content>` (labels, hints, actions)
- **Existing component reuse** — which existing components to import and use
- **i18n keys** — list all user-visible strings that need localization
- **Accessibility** — keyboard navigation, ARIA attributes, focus management

Present this plan to the user and get approval before writing files.

### Phase 5: Implement

Create these files following the patterns discovered in Phase 2:

#### Component TypeScript (`component-name.component.ts`)

```typescript
@Component({
  selector: "bit-component-name",
  templateUrl: "./component-name.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [/* discovered dependencies */],
  host: {
    class: "tw-block",
  },
})
```

Key conventions:

- `ChangeDetectionStrategy.OnPush` always
- Signal-based inputs: `input()`, `input.required<T>()`, `input(default, { transform: booleanAttribute })`
- Signal-based outputs: `output<T>()`
- Internal state with `signal()` and `viewChild()`
- Protected methods for template bindings, private for internal logic
- No TypeScript enums — use `Object.freeze({ ... } as const)` with a same-name type alias (ADR-0025).
  Even for simple string unions, prefer the const object pattern for consistency.

#### Component template (`component-name.component.html`)

- Use new Angular control flow: `@if`, `@for`, `@switch`
- Avoid deprecated attributes like `ngClass` and `ngStyle`, prefer `class` and `style`.
- All Tailwind classes use the library's prefix (check `tailwind.config`)
- All user-visible strings go through `{{ "key" | i18n }}` or `{{ "key" | i18n: param }}`
- Reuse existing components (`bit-label`, `bitButton`, `bit-hint`, etc.)

#### Barrel export (`index.ts`)

```typescript
export { ComponentNameComponent } from "./component-name.component";
```

#### Storybook stories (`component-name.stories.ts`)

Every component gets stories. Follow the exact patterns from sibling components:

```typescript
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "../utils/i18n-mock.service";

export default {
  title: "Component Library/ComponentName",
  component: ComponentNameComponent,
  decorators: [
    moduleMetadata({
      imports: [
        /* component + dependencies */
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              // All i18n keys used by the component
              // Use __$1__ for parameter placeholders
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "/* original Figma URL */",
    },
  },
} as Meta<ComponentNameComponent>;
```

Include stories for:

- Default state
- Key variant states (if applicable)
- Edge cases visible in the design (disabled, loading, empty, etc.)

#### Unit tests (`component-name.component.spec.ts`)

Write unit tests when the component has behavior that Storybook stories alone can't verify. Stories
cover visual rendering and variant appearance — don't duplicate that. Tests should focus on:

- **Computed state and logic** — e.g. a rating component rounding fractional values, a progress bar
  clamping percentages to 0–100, variant-to-class mappings
- **Event emission** — outputs fire with the correct payload (files selected, rating changed, toast
  dismissed)
- **Input validation / edge cases** — boundary values, empty inputs, invalid types rejected
- **Accessibility attributes** — correct `role`, `aria-label`, `aria-live` values change with state
- **Keyboard interaction** — Enter/Space triggers actions, arrow keys navigate

Skip tests for components that are purely presentational with no logic beyond displaying inputs
(e.g. a simple badge or divider). Look at sibling `*.spec.ts` files to match the test setup
patterns (TestBed configuration, imports, mock providers).

#### Update barrel exports

Add `export * from "./component-name";` to the parent directory's `index.ts`, inserted
alphabetically.

### Phase 6: Verify in Storybook

Use Playwright MCP tools to verify the component renders correctly:

1. Navigate to the story's iframe URL:
   `http://localhost:6006/iframe.html?id=component-library-component-name--default&viewMode=story`
2. Take a snapshot to confirm the component rendered without errors
3. Take a screenshot and compare it against the Figma design screenshot
4. Test interactive behavior:
   - Click buttons and interactive elements
   - Verify correct responses (dialogs, state changes, etc.)
5. Check the disabled story if applicable

If Storybook isn't running or Playwright isn't available, tell the user and suggest they verify
manually.

### Phase 7: Iterate

Present the screenshot to the user alongside the original Figma screenshot. Ask if adjustments are
needed. Common refinements:

- Token mismatches (wrong shade, spacing off)
- Missing hover/focus states
- Accessibility gaps
- i18n strings that need rewording

## Key principles

- **Never hardcode user-visible strings.** Every string goes through `I18nPipe`. This includes
  aria-labels and other accessibility text — they need localization too. Add keys to the locale file
  and provide mocks in stories.
- **Reuse existing components aggressively.** If the design has a button, use `bitButton`. If it
  has a label, use `bit-label`. Don't reimplement what exists.
- **Explore before you build.** The codebase exploration step prevents most rework. Patterns vary
  between apps and libraries — always check the specific target directory.
- **Semantic tokens over raw values.** Map every Figma color, spacing, and font size to the
  codebase's design token system. Raw hex values break theming.
- **Use native HTML patterns for file inputs.** For file upload components, use a `<label for>`
  element pointing at a hidden `<input type="file">` rather than programmatic `.click()`. The
  codebase has an `AriaDisabledClickCaptureService` that intercepts programmatic clicks on certain
  elements, causing silent failures.
- **No NgModules.** All new components must be standalone (`imports: [...]` in the `@Component`
  decorator). Do not create `*.module.ts` files. The codebase is moving away from NgModules.
- **Plan before you code.** The plan step catches API design issues early. It's cheaper to fix a
  plan than to rewrite files.
