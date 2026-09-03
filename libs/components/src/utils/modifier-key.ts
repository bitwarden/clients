import { DOCUMENT } from "@angular/common";
import { computed, inject, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

/**
 * Returns a readonly signal tracking the platform modifier key label
 * ("Command" on Mac, "Ctrl" elsewhere).
 *
 * Returns a **signal** because the initial value is seeded from `navigator`
 * (a best-guess) and is refined to ground-truth on the first real Cmd/Ctrl
 * chord keydown. On a VM or unusual UA, the navigator-based guess may be
 * wrong; the first chord corrects it.
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
      if (event.key === "Meta" || event.key === "Control") {
        return;
      }
      if (event.metaKey && !event.ctrlKey) {
        modifierKey.set("Command");
      } else if (event.ctrlKey && !event.metaKey) {
        modifierKey.set("Ctrl");
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
