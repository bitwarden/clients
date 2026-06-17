import { inject, Injectable } from "@angular/core";
import { CopyBridgeService, VaultViewModelService } from "@klappstuhl/ui-bridge";

interface QuickAccessResult {
  id: string;
  title: string;
  subtitle?: string;
  kind: string;
  iconUrl?: string;
}

type QuickAccessAction = "password" | "username" | "totp";

interface QuickAccessActivation {
  id: string;
  action: QuickAccessAction;
}

interface QuickAccessActionOption {
  action: QuickAccessAction;
  label: string;
}

interface QuickAccessBridge {
  onSearch: (cb: (query: string) => void) => () => void;
  sendResults: (results: QuickAccessResult[]) => void;
  onActionsRequest: (cb: (id: string) => void) => () => void;
  sendActions: (payload: { id: string; actions: QuickAccessActionOption[] }) => void;
  onActivate: (cb: (activation: QuickAccessActivation) => void) => () => void;
}

const MAX_RESULTS = 8;

/**
 * FORK (klappstuhl): renderer side of the Quick Access spotlight.
 *
 * The decrypted vault lives here, so this service answers the spotlight's search
 * requests (returning display-only fields) and performs copies through the
 * existing CopyBridgeService (clipboard auto-clear, no secrets leave the
 * renderer). Wired up by injecting it from the redesign shell.
 */
@Injectable({ providedIn: "root" })
export class QuickAccessRendererService {
  private readonly vaultService = inject(VaultViewModelService);
  private readonly copyService = inject(CopyBridgeService);
  private initialized = false;

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

    bridge.onSearch((query) => bridge.sendResults(this.search(query)));
    bridge.onActionsRequest((id) => void this.sendActions(bridge, id));
    bridge.onActivate((activation) => void this.activate(activation));
  }

  private async sendActions(bridge: QuickAccessBridge, id: string): Promise<void> {
    const actions: QuickAccessActionOption[] = [];
    try {
      const detail = await this.vaultService.getDetail(id);
      if (detail.username) {
        actions.push({ action: "username", label: "Copy username" });
      }
      if (detail.password) {
        actions.push({ action: "password", label: "Copy password" });
      }
      if (detail.totpAvailable) {
        actions.push({ action: "totp", label: "Copy 2FA code" });
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
      default:
        await this.copyService.copyPassword(activation.id);
        break;
    }
  }
}
