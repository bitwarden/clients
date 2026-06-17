import { inject, Injectable } from "@angular/core";
import { CopyBridgeService, LockBridgeService, VaultViewModelService } from "@klappstuhl/ui-bridge";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

interface QuickAccessResult {
  id: string;
  title: string;
  subtitle?: string;
  kind: string;
  iconUrl?: string;
}

type QuickAccessAction = "password" | "username" | "totp" | "openfill";

interface QuickAccessActivation {
  id: string;
  action: QuickAccessAction;
}

interface QuickAccessActionOption {
  action: QuickAccessAction;
  label: string;
}

interface QuickAccessLabels {
  placeholder: string;
  copyPassword: string;
  moreOptions: string;
  copy: string;
  back: string;
  close: string;
  noMatches: string;
  nothingToCopy: string;
}

interface QuickAccessLockState {
  locked: boolean;
  canBiometricUnlock: boolean;
}

interface QuickAccessSuggestions {
  context: string;
  items: QuickAccessResult[];
}

interface QuickAccessBridge {
  onSearch: (cb: (query: string) => void) => () => void;
  sendResults: (results: QuickAccessResult[]) => void;
  onActionsRequest: (cb: (id: string) => void) => () => void;
  sendActions: (payload: { id: string; actions: QuickAccessActionOption[] }) => void;
  onActivate: (cb: (activation: QuickAccessActivation) => void) => () => void;
  sendLabels: (labels: QuickAccessLabels) => void;
  onLockStateRequest: (cb: () => void) => () => void;
  sendLockState: (state: QuickAccessLockState) => void;
  onUnlockRequest: (cb: () => void) => () => void;
  onContext: (cb: (title: string) => void) => () => void;
  sendSuggestions: (payload: QuickAccessSuggestions) => void;
}

const MAX_RESULTS = 8;
const MAX_SUGGESTIONS = 5;

// Trailing browser-name suffixes stripped from a window title to derive a short
// context label (e.g. "Amazon.de — Google Chrome" → "Amazon.de").
const BROWSER_SUFFIX =
  /\s+[-—|]\s+(?:Google Chrome|Mozilla Firefox|Microsoft\s?Edge|Brave|Opera|Vivaldi|Safari|Chromium|Zen Browser)\s*$/i;

// Words too generic to anchor a context match on.
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "www",
  "com",
  "net",
  "org",
  "login",
  "log",
  "sign",
  "home",
  "page",
  "new",
  "tab",
  "more",
  "pages",
]);

/**
 * FORK (klappstuhl): renderer side of the Quick Access spotlight.
 *
 * The decrypted vault lives here, so this service answers the spotlight's search
 * requests (returning display-only fields) and performs copies through the
 * existing CopyBridgeService (clipboard auto-clear, no secrets leave the
 * renderer). Wired up from the app root (AppComponent) so it answers the
 * spotlight even while the vault is locked and the redesign shell isn't mounted
 * — that lets the spotlight trigger a biometric unlock without opening the app.
 */
@Injectable({ providedIn: "root" })
export class QuickAccessRendererService {
  private readonly vaultService = inject(VaultViewModelService);
  private readonly copyService = inject(CopyBridgeService);
  private readonly lockService = inject(LockBridgeService);
  private readonly logService = inject(LogService);
  private initialized = false;
  private bridge: QuickAccessBridge | null = null;

  /** Idempotent — safe to call from the shell constructor. */
  init(): void {
    if (this.initialized) {
      return;
    }
    const bridge = (globalThis as { ipc?: { klsQuickAccess?: QuickAccessBridge } }).ipc
      ?.klsQuickAccess;
    if (bridge == null) {
      // Not running under Electron (e.g. Storybook/web) — nothing to wire.
      return;
    }
    this.initialized = true;
    this.bridge = bridge;

    bridge.onSearch((query) => bridge.sendResults(this.search(query)));
    bridge.onActionsRequest((id) => void this.sendActions(bridge, id));
    bridge.onActivate((activation) => void this.activate(activation));
    bridge.onLockStateRequest(() => void this.sendLockState());
    bridge.onUnlockRequest(() => void this.unlock());
    bridge.onContext((title) => bridge.sendSuggestions(this.buildSuggestions(title)));
    bridge.sendLabels(this.buildLabels());
  }

  /**
   * Match the foreground app/page title against the vault and return the closest
   * items (shown as suggestions in the spotlight's empty state). Token-based to
   * avoid loose substring false-positives (e.g. "Apple" in "Pineapple").
   */
  private buildSuggestions(rawTitle: string): QuickAccessSuggestions {
    const context = rawTitle.replace(BROWSER_SUFFIX, "").trim();
    const titleTokens = this.tokenize(rawTitle);
    const vault = this.vaultService.items();
    if (titleTokens.size === 0) {
      this.logService.info("[QuickAccess] context had no usable tokens; no suggestions.");
      return { context, items: [] };
    }

    const scored = vault
      .map((i) => ({ item: i, score: this.contextScore(rawTitle, titleTokens, i) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => ({
        id: s.item.id,
        title: s.item.title,
        subtitle: s.item.subtitle,
        kind: s.item.kind,
        iconUrl: s.item.iconUrl,
      }));

    this.logService.info(
      `[QuickAccess] context suggestions: ${scored.length} of ${vault.length} items matched.`,
    );
    return { context, items: scored };
  }

  private tokenize(value: string): Set<string> {
    const tokens = new Set<string>();
    for (const raw of value.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length >= 3 && !STOPWORDS.has(raw)) {
        tokens.add(raw);
      }
    }
    return tokens;
  }

  private contextScore(
    rawTitle: string,
    titleTokens: Set<string>,
    item: { title: string; subtitle?: string },
  ): number {
    const haystack = rawTitle.toLowerCase();
    const name = item.title.trim().toLowerCase();

    // Whole item name appearing in the title is the strongest signal.
    if (name.length >= 3 && haystack.includes(name)) {
      return 4;
    }

    let score = 0;
    // Item-name tokens that also appear as title tokens.
    for (const token of this.tokenize(item.title)) {
      if (titleTokens.has(token)) {
        score += 2;
      }
    }
    // Domain-ish tokens from the subtitle (e.g. a stored URL/host).
    if (item.subtitle) {
      for (const token of this.tokenize(item.subtitle)) {
        if (titleTokens.has(token)) {
          score += 1;
        }
      }
    }
    return score;
  }

  /** Report whether the vault is locked (and if biometrics can unlock it). */
  private async sendLockState(): Promise<void> {
    if (this.bridge == null) {
      return;
    }
    try {
      const locked = await this.lockService.isLocked();
      const canBiometricUnlock = locked ? await this.lockService.canUnlockWithBiometrics() : false;
      this.bridge.sendLockState({ locked, canBiometricUnlock });
    } catch {
      this.bridge.sendLockState({ locked: false, canBiometricUnlock: false });
    }
  }

  /** Trigger a biometric unlock (e.g. Windows Hello), then re-report state. */
  private async unlock(): Promise<void> {
    let unlocked = false;
    try {
      unlocked = await this.lockService.unlockWithBiometrics();
    } catch {
      unlocked = false;
    }
    // On success, report unlocked directly — the auth status stream may not have
    // propagated yet, and re-deriving could briefly report a stale "locked".
    if (unlocked) {
      this.bridge?.sendLockState({ locked: false, canBiometricUnlock: false });
    } else {
      await this.sendLockState();
    }
  }

  /** Translate with a fallback (i18n.t may return "" or the key when missing). */
  private t(key: string, fallback: string): string {
    const value = this.vaultService.t(key);
    return value && value !== key ? value : fallback;
  }

  private buildLabels(): QuickAccessLabels {
    return {
      placeholder: `${this.t("searchVault", "Search your vault")}…`,
      copyPassword: this.t("copyPassword", "copy password"),
      moreOptions: this.t("options", "more options"),
      copy: this.t("copy", "copy"),
      back: this.t("back", "back"),
      close: this.t("close", "close"),
      noMatches: this.t("noItemsToShow", "No matches"),
      nothingToCopy: this.t("noItemsToShow", "Nothing to copy"),
    };
  }

  private async sendActions(bridge: QuickAccessBridge, id: string): Promise<void> {
    const actions: QuickAccessActionOption[] = [];
    try {
      const detail = await this.vaultService.getDetail(id);
      if (detail.username) {
        actions.push({ action: "username", label: this.t("copyUsername", "Copy username") });
      }
      if (detail.password) {
        actions.push({ action: "password", label: this.t("copyPassword", "Copy password") });
      }
      if (detail.totpAvailable) {
        actions.push({
          action: "totp",
          label: this.t("copyVerificationCode", "Copy 2FA code"),
        });
      }
      if (detail.uris && detail.uris.length > 0) {
        actions.push({ action: "openfill", label: this.t("launch", "Open & fill") });
      }
    } catch {
      // Item vanished or failed to decrypt — send whatever we have (possibly empty).
    }
    bridge.sendActions({ id, actions });
  }

  private search(query: string): QuickAccessResult[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return this.vaultService
      .items()
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) || (i.subtitle?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, MAX_RESULTS)
      .map((i) => ({
        id: i.id,
        title: i.title,
        subtitle: i.subtitle,
        kind: i.kind,
        iconUrl: i.iconUrl,
      }));
  }

  private async activate(activation: QuickAccessActivation): Promise<void> {
    switch (activation.action) {
      case "username":
        await this.copyService.copyUsername(activation.id);
        break;
      case "totp":
        await this.copyService.copyTotp(activation.id);
        break;
      case "openfill":
        await this.copyService.openAndFill(activation.id);
        break;
      default:
        await this.copyService.copyPassword(activation.id);
        break;
    }
  }
}
