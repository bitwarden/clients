import { map, Observable } from "rxjs";

import { GlobalState, GlobalStateProvider, KeyDefinition, THEMING_DISK } from "../state";

export const ACCENT_COLOR_HEX = new KeyDefinition<string | null>(THEMING_DISK, "forkAccentHex", {
  deserializer: (s): string | null => {
    if (s == null || s === "") {
      return null;
    }
    return typeof s === "string" && /^#[0-9A-Fa-f]{6}$/.test(s) ? s.toLowerCase() : null;
  },
});

/** Persists optional global accent color override (fork feature). */
export abstract class AccentColorStateService {
  abstract accentColorHex$: Observable<string | null>;
  abstract setAccentColor(hex: string | null): Promise<void>;
}

export class DefaultAccentColorStateService implements AccentColorStateService {
  private readonly accentState: GlobalState<string | null>;
  accentColorHex$: Observable<string | null>;

  constructor(globalStateProvider: GlobalStateProvider) {
    this.accentState = globalStateProvider.get(ACCENT_COLOR_HEX);
    this.accentColorHex$ = this.accentState.state$.pipe(map((v) => v ?? null));
  }

  async setAccentColor(hex: string | null): Promise<void> {
    const validated =
      hex == null || hex === "" ? null : /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toLowerCase() : null;
    await this.accentState.update(() => validated);
  }
}
