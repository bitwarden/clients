import { DOCUMENT } from "@angular/common";
import { computed, inject, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

/**
 * Returns a readonly signal tracking the platform modifier key label
 * ("Command" on Mac, "Ctrl" elsewhere).
 *
 * Returns a **signal** because the initial value is seeded from `navigator`
 * (a best-guess) and a later Cmd chord refines it to ground truth.
 *
 * Refinement is one-way: Cmd is Apple-exclusive, but a Ctrl chord proves
 * nothing — the macOS caret bindings (Ctrl+A/E/K/D) fire while typing.
 *
 * Must be called in an injection context (e.g. a component field initializer
 * or constructor).
 */
export function injectModifierKey(): Signal<"Command" | "Ctrl"> {
  const document = inject(DOCUMENT);
  const modifierKey = signal<"Command" | "Ctrl">(detectInitialModifier(document));

  fromEvent<KeyboardEvent>(document, "keydown")
    .pipe(takeUntilDestroyed())
    .subscribe((event) => {
      // The Windows key also reports as "Meta", so a bare modifier press is not evidence either.
      if (event.key === "Meta" || event.key === "Control") {
        return;
      }
      if (event.metaKey && !event.ctrlKey) {
        modifierKey.set("Command");
      }
    });

  return modifierKey.asReadonly();
}

/**
 * Returns a readonly signal of the platform modifier key display glyph
 * ("⌘" on Mac, "Ctrl" elsewhere). Wraps {@link injectModifierKey}.
 *
 * Must be called in an injection context.
 */
export function injectModifierGlyph(): Signal<string> {
  const key = injectModifierKey();
  return computed(() => (key() === "Command" ? "⌘" : "Ctrl"));
}

function detectInitialModifier(document: Document): "Command" | "Ctrl" {
  const nav = document.defaultView?.navigator;
  const isMac = nav?.platform?.startsWith("Mac") || /Macintosh/.test(nav?.userAgent ?? "");
  return isMac ? "Command" : "Ctrl";
}
