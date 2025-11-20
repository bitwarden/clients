import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { Observable, of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ChipSelectComponent } from "@bitwarden/components";

import { SendListFiltersService } from "../services/send-list-filters.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-list-filters",
  templateUrl: "./send-list-filters.component.html",
  imports: [CommonModule, JslibModule, ChipSelectComponent, ReactiveFormsModule],
})
export class SendListFiltersComponent implements OnDestroy {
  protected filterForm = this.sendListFiltersService.filterForm;
  protected sendTypes = this.sendListFiltersService.sendTypes;
  protected canAccessPremium$: Observable<boolean>;

  constructor(
    private sendListFiltersService: SendListFiltersService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
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
