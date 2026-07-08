import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { Observable } from "rxjs";

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
  protected readonly showFillAssistActiveBanner$: Observable<boolean> =
    this.vaultPopupAutofillService.showFillAssistActiveBanner$;

  /**
   * Session-only dismissal. Lives on the component instance and is not persisted, so it
   * resets each time the popup is reopened.
   */
  protected readonly dismissed = signal(false);

  constructor(private readonly vaultPopupAutofillService: VaultPopupAutofillService) {}

  protected onDismiss() {
    this.dismissed.set(true);
  }
}
