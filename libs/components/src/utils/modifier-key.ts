import { DOCUMENT } from "@angular/common";
import { inject, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

/**
 * Returns a readonly signal tracking the platform modifier key label
 * ("Command" on Mac, "Ctrl" elsewhere). Seeded from navigator at injection
 * time; refined to ground-truth on the first Cmd/Ctrl chord keydown (bare modifier presses are ignored).
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

function detectInitialModifier(document: Document): "Command" | "Ctrl" {
  const nav = document.defaultView?.navigator;
  const isMac = nav?.platform?.startsWith("Mac") || /Macintosh/.test(nav?.userAgent ?? "");
  return isMac ? "Command" : "Ctrl";
}
