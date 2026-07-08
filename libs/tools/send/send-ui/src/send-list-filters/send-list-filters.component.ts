import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule } from "@angular/forms";
import { Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { ChipFilterComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendListFiltersService } from "../services/send-list-filters.service";
import { SendPolicyService } from "../services/send-policy.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-list-filters",
  templateUrl: "./send-list-filters.component.html",
  imports: [CommonModule, I18nPipe, ChipFilterComponent, ReactiveFormsModule],
})
export class SendListFiltersComponent implements OnDestroy {
  protected filterForm = this.sendListFiltersService.filterForm;
  protected sendTypes = this.sendListFiltersService.sendTypes;
  protected canAccessPremium$: Observable<boolean>;
  readonly allowedSendTypes = toSignal(this.sendPolicyService.allowedSendTypes$, {
    initialValue: [SendType.Text, SendType.File],
  });

  constructor(
    private sendListFiltersService: SendListFiltersService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
    private sendPolicyService: SendPolicyService,
  ) {
    this.canAccessPremium$ = accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
          : of(false),
      ),
    );
  }

  ngOnDestroy(): void {
    this.sendListFiltersService.resetFilterForm();
  }
}
