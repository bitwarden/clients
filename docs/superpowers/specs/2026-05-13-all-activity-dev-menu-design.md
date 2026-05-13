# Dev Hotkey Menu — AllActivityComponent

**Date:** 2026-05-13
**Scope:** `AllActivityComponent` only
**Purpose:** Speed up development testing by providing a keyboard-driven launcher for dialogs and methods, visible only in development mode.

---

## Overview

A centered modal overlay rendered exclusively when Angular's `isDevMode()` returns `true`. Pressing `Shift+?` toggles the menu open or closed. While the menu is visible, single-key hotkeys fire registered actions. Hotkeys do nothing when the menu is closed.

---

## Architecture

All changes live in two files:

- `bitwarden_license/bit-web/src/app/dirt/access-intelligence/activity/all-activity.component.ts`
- `bitwarden_license/bit-web/src/app/dirt/access-intelligence/activity/all-activity.component.html`

No new components, services, directives, or modules are introduced.

---

## Component Changes (`all-activity.component.ts`)

### Imports

Add `HostListener` and `isDevMode` to the existing `@angular/core` import:

```typescript
import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  input,
  isDevMode,
  OnInit,
} from "@angular/core";
```

### New fields

```typescript
protected readonly isDevMode = isDevMode();
protected devMenuOpen = false;

protected readonly devActions: { key: string; label: string; action: () => void }[] = [
  { key: 'D', label: 'Open review dialog', action: () => void this.onReviewNewApplications() },
];
```

`isDevMode` is evaluated once at construction time and exposed as a field so the template can reference it (Angular templates cannot call imported functions directly).

### Keyboard handler

```typescript
@HostListener('document:keydown', ['$event'])
onDevKeydown(event: KeyboardEvent): void {
  if (!isDevMode()) return;

  if (event.key === '?' && event.shiftKey) {
    this.devMenuOpen = !this.devMenuOpen;
    event.preventDefault();
    return;
  }

  if (event.key === 'Escape' && this.devMenuOpen) {
    this.devMenuOpen = false;
    return;
  }

  if (this.devMenuOpen) {
    const match = this.devActions.find(a => a.key === event.key.toUpperCase());
    if (match) {
      event.preventDefault();
      this.devMenuOpen = false;
      match.action();
    }
  }
}
```

The listener is registered on `document` so it fires regardless of which element has focus. The `isDevMode()` guard at the top ensures the handler exits immediately in production (belt-and-suspenders alongside the template gate).

---

## Template Changes (`all-activity.component.html`)

Added at the bottom of the file, outside the loading `@if` block:

```html
@if (isDevMode && devMenuOpen) {
<div
  class="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/50"
  (click)="devMenuOpen = false"
>
  <div
    class="tw-bg-slate-900 tw-border tw-border-slate-700 tw-rounded-xl tw-p-6 tw-min-w-64 tw-shadow-2xl"
    (click)="$event.stopPropagation()"
  >
    <p class="tw-text-slate-400 tw-text-xs tw-uppercase tw-tracking-widest tw-mb-4">⚙ Dev Tools</p>
    @for (action of devActions; track action.key) {
    <div class="tw-flex tw-items-center tw-gap-3 tw-mb-3">
      <kbd
        class="tw-bg-slate-700 tw-text-slate-100 tw-rounded tw-px-2 tw-py-0.5 tw-text-sm tw-font-mono"
      >
        {{ action.key }}
      </kbd>
      <span class="tw-text-slate-300 tw-text-sm">{{ action.label }}</span>
    </div>
    }
    <hr class="tw-border-slate-700 tw-my-3" />
    <div class="tw-flex tw-items-center tw-gap-3">
      <kbd
        class="tw-bg-slate-700 tw-text-slate-400 tw-rounded tw-px-2 tw-py-0.5 tw-text-sm tw-font-mono"
      >
        Esc
      </kbd>
      <span class="tw-text-slate-500 tw-text-sm">Close</span>
    </div>
  </div>
</div>
}
```

Clicking the backdrop closes the menu. `stopPropagation` on the inner panel prevents backdrop clicks from firing through the panel.

---

## Behavior Summary

| Input             | Effect                                            |
| ----------------- | ------------------------------------------------- |
| `Shift+?`         | Toggle menu open/closed                           |
| `Esc` (menu open) | Close menu                                        |
| `D` (menu open)   | Close menu, open `NewApplicationsDialogComponent` |
| Click backdrop    | Close menu                                        |
| Any other key     | No effect                                         |

Hotkeys are **inert when the menu is closed** — no accidental triggers during normal use.

---

## Extending Later

To add a new dev action, append one entry to `devActions`:

```typescript
{ key: 'X', label: 'Description of action', action: () => this.someMethod() }
```

No other changes required.

---

## What Is Not In Scope

- No extraction to a shared `DevMenuComponent` (can be done later if needed by other components)
- No persistence of menu state across page refreshes
- No production bundle impact beyond the `isDevMode()` checks (tree-shaking removes dead branches in production builds)
