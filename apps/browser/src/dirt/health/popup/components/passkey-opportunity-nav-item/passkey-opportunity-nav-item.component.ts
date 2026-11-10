import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { VaultHealthReportStatus } from "@bitwarden/common/dirt/vault-health/models";
import { ButtonModule, IconComponent, IconTileComponent, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RiskCategoryNavItemComponent } from "../risk-category-nav-item/risk-category-nav-item.component";

/** Router path of the passkey opportunities detail page. */
export const HEALTH_PASSKEYS_ROUTE = "/health/passkeys";

/**
 * The Health Overview row for logins whose sites support passkeys. Once a
 * check has a result it is a regular category row; before that it shows its
 * own progress, and a retry when the passkey directory could not be fetched.
 *
 * Presentational — the parent owns the check.
 */
@Component({
  selector: "dirt-passkey-opportunity-nav-item",
  templateUrl: "./passkey-opportunity-nav-item.component.html",
  // display: contents so the item content, not this wrapper, is bit-item's flex child.
  host: { class: "tw-contents" },
  imports: [
    RiskCategoryNavItemComponent,
    ItemModule,
    IconTileComponent,
    IconComponent,
    ButtonModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasskeyOpportunityNavItemComponent {
  /** Where the passkey check is. */
  readonly status = input.required<VaultHealthReportStatus>();
  /**
   * Logins that could use a passkey, or null before any check has succeeded.
   * A count from an earlier check is kept on screen even if a later one failed.
   */
  readonly count = input.required<number | null>();
  /**
   * Whether Health details are locked behind Premium. Locked wins over every
   * other state: a free user is never checked, so there is no count to show.
   */
  readonly locked = input(false);

  /** The user asked to check again after a failure. */
  readonly retry = output<void>();

  protected readonly route = HEALTH_PASSKEYS_ROUTE;

  protected readonly state = computed<"locked" | "result" | "error" | "loading">(() => {
    if (this.locked()) {
      return "locked";
    }
    if (this.count() != null) {
      return "result";
    }
    return this.status() === VaultHealthReportStatus.Error ? "error" : "loading";
  });
}
