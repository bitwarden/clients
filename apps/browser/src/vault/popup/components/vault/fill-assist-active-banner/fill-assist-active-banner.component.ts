import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BannerModule } from "@bitwarden/components";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerModule, CommonModule, JslibModule],
  selector: "fill-assist-active-banner",
  templateUrl: "fill-assist-active-banner.component.html",
})
export class FillAssistActiveBannerComponent {
  /**
   * Flag indicating that Fill Assist targeting rules are in effect for the current tab.
   */
  private readonly fillAssistActive = toSignal(
    this.vaultPopupAutofillService.showFillAssistActiveBanner$,
    { initialValue: false },
  );

  /**
   * Session-only dismissal. Lives on the component instance and is not persisted, so it
   * resets each time the popup is reopened.
   */
  protected readonly dismissed = signal(false);

  /**
   * The banner is shown while Fill Assist is active and the user has not dismissed it this session.
   */
  protected readonly showBanner = computed(() => this.fillAssistActive() && !this.dismissed());

  constructor(private readonly vaultPopupAutofillService: VaultPopupAutofillService) {}

  protected onDismiss() {
    this.dismissed.set(true);
  }
}
