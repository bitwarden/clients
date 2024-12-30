// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

import { reports, ReportType } from "../reports";
import { ReportEntry, ReportVariant } from "../shared";

@Component({
  selector: "app-reports-home",
  templateUrl: "reports-home.component.html",
})
export class ReportsHomeComponent implements OnInit {
  reports: ReportEntry[];

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    const userHasPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    );
    const reportRequiresPremium = userHasPremium
      ? ReportVariant.Enabled
      : ReportVariant.RequiresPremium;

    this.reports = [
      {
        ...reports[ReportType.ExposedPasswords],
        variant: reportRequiresPremium,
      },
      {
        ...reports[ReportType.ReusedPasswords],
        variant: reportRequiresPremium,
      },
      {
        ...reports[ReportType.WeakPasswords],
        variant: reportRequiresPremium,
      },
      {
        ...reports[ReportType.UnsecuredWebsites],
        variant: reportRequiresPremium,
      },
      {
        ...reports[ReportType.Inactive2fa],
        variant: reportRequiresPremium,
      },
      {
        ...reports[ReportType.DataBreach],
        variant: ReportVariant.Enabled,
      },
    ];
  }
}
