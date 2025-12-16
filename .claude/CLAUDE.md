# Bitwarden Clients - Claude Code Configuration

## Project Context Files

**Read these files before reviewing to ensure that you fully understand the project and contributing guidelines**

1. @README.md
2. @CONTRIBUTING.md
3. @.github/PULL_REQUEST_TEMPLATE.md

## Critical Rules

- **NEVER** use code regions: If complexity suggests regions, refactor for better readability

- **CRITICAL**: new encryption logic should not be added to this repo.

- **NEVER** send unencrypted vault data to API services

- **NEVER** commit secrets, credentials, or sensitive information.

- **NEVER** log decrypted data, encryption keys, or PII
  - No vault data in error messages or console logs

- **ALWAYS** Respect configuration files at the root and within each app/library (e.g., `eslint.config.mjs`, `jest.config.js`, `tsconfig.json`).

## Mono-Repo Architecture

This repository is organized as a **monorepo** containing multiple applications and libraries. The
main directories are:

- `apps/` – Contains all application projects (e.g., browser, cli, desktop, web). Each app is
  self-contained with its own configuration, source code, and tests.
- `libs/` – Contains shared libraries and modules used across multiple apps. Libraries are organized
  by team name, domain, functionality (e.g., common, ui, platform, key-management).

**Strict boundaries** must be maintained between apps and libraries. Do not introduce
cross-dependencies that violate the intended modular structure. Always consult and respect the
dependency rules defined in `eslint.config.mjs`, `nx.json`, and other configuration files.

## Angular Architecture Patterns

**Observable Data Services (ADR-0003):**

- Services expose RxJS Observable streams for state management
- Components subscribe using `async` pipe (NOT explicit subscriptions in most cases)
  Pattern:

```typescript
// Service
private _folders = new BehaviorSubject<Folder[]>([]);
readonly folders$ = this._folders.asObservable();

// Component
folders$ = this.folderService.folders$;
// Template: <div *ngFor="let folder of folders$ | async">
```

For explicit subscriptions, MUST use `takeUntilDestroyed()`:

```typescript
constructor() {
  this.observable$.pipe(takeUntilDestroyed()).subscribe(...);
}
```

**Angular Signals (ADR-0027):**

Encourage the use of Signals **only** in Angular components and presentational services.

Use **RxJS** for:

- Services used across Angular and non-Angular clients
- Complex reactive workflows
- Interop with existing Observable-based code

**NO TypeScript Enums (ADR-0025):**

- Use const objects with type aliases instead
- Legacy enums exist but don't add new ones

Pattern:

```typescript
// ✅ DO
export const CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
} as const);
export type CipherType = (typeof CipherType)[keyof typeof CipherType];

// ❌ DON'T
enum CipherType {
  Login = 1,
  SecureNote = 2,
}
```

Example: `/libs/common/src/vault/enums/cipher-type.ts`

## Color System & Theming

The project uses a **three-tier color token architecture**:

1. **Primitive Colors** - Raw color values from Figma design system
2. **Semantic Tokens** - Meaningful names that reference primitives
3. **Tailwind Utilities** - CSS classes for components

### Color Token Structure

**Location:** `libs/components/src/tw-theme.css`

**Primitive Colors (Hex format):**

- 10 color families: `brand`, `gray`, `red`, `orange`, `yellow`, `green`, `pink`, `coral`, `teal`, `purple`
- 11 shades each: `050`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`
- Format: `--color-{family}-{shade}` (e.g., `--color-brand-600`)
- **Do not use primitives directly in components**

**Semantic Foreground Tokens:**

- Neutral: `fg-white`, `fg-dark`, `fg-contrast`, `fg-heading`, `fg-body`, `fg-body-subtle`, `fg-disabled`
- Brand: `fg-brand-soft`, `fg-brand`, `fg-brand-strong`
- Status: `fg-success`, `fg-success-strong`, `fg-danger`, `fg-danger-strong`, `fg-warning`, `fg-warning-strong`, `fg-sensitive`
- Accent: `fg-accent-primary`, `fg-accent-secondary`, `fg-accent-tertiary` (with `-soft` and `-strong` variants)
- Format: `--color-fg-{name}`

**Semantic Background Tokens:**

- Neutral: `bg-white`, `bg-dark`, `bg-contrast`, `bg-contrast-strong`, `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-quaternary`, `bg-gray`, `bg-disabled`
- Brand: `bg-brand-softer`, `bg-brand-soft`, `bg-brand-medium`, `bg-brand`, `bg-brand-strong`
- Status: `bg-success-soft`, `bg-success-medium`, `bg-success`, `bg-success-strong`, `bg-danger-soft`, `bg-danger-medium`, `bg-danger`, `bg-danger-strong`, `bg-warning-soft`, `bg-warning-medium`, `bg-warning`, `bg-warning-strong`
- Accent: `bg-accent-primary-soft`, `bg-accent-primary-medium`, `bg-accent-primary`, `bg-accent-secondary-soft`, `bg-accent-secondary-medium`, `bg-accent-secondary`, `bg-accent-tertiary-soft`, `bg-accent-tertiary-medium`, `bg-accent-tertiary`
- Special: `bg-hover`, `bg-overlay`
- Format: `--color-bg-{name}`

**Semantic Border Tokens:**

- Neutral: `border-muted`, `border-light`, `border-base`, `border-strong`, `border-buffer`
- Brand: `border-brand-soft`, `border-brand`, `border-brand-strong`
- Status: `border-success-soft`, `border-success`, `border-success-strong`, `border-danger-soft`, `border-danger`, `border-danger-strong`, `border-warning-soft`, `border-warning`, `border-warning-strong`
- Accent: `border-accent-primary-soft`, `border-accent-primary`, `border-accent-secondary-soft`, `border-accent-secondary`, `border-accent-tertiary-soft`, `border-accent-tertiary`
- Focus: `border-focus`
- Format: `--color-border-{name}`

### Usage in Components

**✅ DO - Use semantic tokens via Tailwind:**

```html
<!-- Text colors -->
<h1 class="tw-text-fg-heading">Heading text</h1>
<p class="tw-text-fg-body">Body text</p>
<button class="tw-text-fg-brand">Brand action</button>
<span class="tw-text-fg-danger">Error message</span>

<!-- Background colors -->
<div class="tw-bg-bg-primary">Primary background</div>
<div class="tw-bg-bg-secondary">Secondary background</div>
<button class="tw-bg-bg-brand tw-text-fg-white">Brand button</button>
<div class="tw-bg-bg-danger-soft tw-text-fg-danger">Danger alert</div>

<!-- Border colors -->
<div class="tw-border tw-border-border-base">Base border</div>
<input class="tw-border tw-border-border-light focus:tw-border-border-focus" />
<div class="tw-border-2 tw-border-border-brand">Brand border</div>
<button class="tw-border tw-border-border-danger">Danger border</button>

<!-- Combined examples -->
<div
  class="tw-bg-bg-success-soft tw-text-fg-success tw-border tw-border-border-success-soft tw-rounded tw-p-4"
>
  Success alert with matching colors
</div>

<!-- Hover states -->
<div class="hover:tw-bg-bg-hover">Hover effect</div>

<!-- Overlays -->
<div class="tw-bg-bg-overlay">Modal overlay</div>
```

**❌ DON'T - Use primitives directly:**

```html
<!-- Bad: Using primitive colors -->
<p class="tw-text-brand-900">Text</p>
<div class="tw-bg-brand-600">Background</div>
<div class="tw-border tw-border-brand-700">Border</div>
<span style="color: var(--color-brand-600)">Text</span>
```

### Legacy Colors

**Legacy colors (RGB format)** still exist for backwards compatibility:

- `primary-*`, `secondary-*`, `success-*`, `danger-*`, `warning-*`, etc.
- Use these only when updating existing components
- Migrate to new semantic tokens when refactoring

### Dark Mode

- Semantic tokens automatically adapt to dark mode via `.theme_dark` class
- No component changes needed when theme switches
- The same semantic token name works in both light and dark themes

### Migration Strategy

1. **New components:** Use semantic `fg-*` tokens exclusively
2. **Existing components:** Keep legacy tokens until refactoring
3. **When refactoring:** Replace legacy tokens with semantic equivalents

## References

- [Web Clients Architecture](https://contributing.bitwarden.com/architecture/clients)
- [Architectural Decision Records (ADRs)](https://contributing.bitwarden.com/architecture/adr/)
- [Contributing Guide](https://contributing.bitwarden.com/)
- [Web Clients Setup Guide](https://contributing.bitwarden.com/getting-started/clients/)
- [Code Style](https://contributing.bitwarden.com/contributing/code-style/)
- [Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/)
- [Security Definitions](https://contributing.bitwarden.com/architecture/security/definitions)
