import { ReactiveController, ReactiveControllerHost } from "lit";

export type ModifierKey = "Command" | "Ctrl";

function detectInitialModifier(): ModifierKey {
  const isMac = navigator.platform?.startsWith("Mac") || /Macintosh/.test(navigator.userAgent);
  return isMac ? "Command" : "Ctrl";
}

/**
 * Tracks the platform modifier key label ("Command" on Mac, "Ctrl" elsewhere).
 *
 * Seeded from `navigator` (a best guess) and refined by a later Cmd chord. Refinement is one-way:
 * Cmd is Apple-exclusive, but a Ctrl chord proves nothing — the macOS caret bindings (Ctrl+A/E/K/D)
 * fire while typing.
 */
export class ModifierKeyTracker implements ReactiveController {
  value: ModifierKey = detectInitialModifier();

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected() {
    document.addEventListener("keydown", this.onKeydown);
  }

  hostDisconnected() {
    document.removeEventListener("keydown", this.onKeydown);
  }

  private onKeydown = (event: KeyboardEvent) => {
    // The Windows key also reports as "Meta", so a bare modifier press is not evidence either.
    if (event.key === "Meta" || event.key === "Control") {
      return;
    }
    if (event.metaKey && !event.ctrlKey && this.value !== "Command") {
      this.value = "Command";
      this.host.requestUpdate();
    }
  };
}
