import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

import { reports, ReportType } from "../reports";
import { ReportEntry, ReportVariant } from "../shared";

@Component({
  selector: "app-reports-home",
  templateUrl: "reports-home.component.html",
})
export class ReportsHomeComponent implements OnInit {
  reports: ReportEntry[];

  constructor(private billingAccountProfileStateService: BillingAccountProfileStateService) {}

  async ngOnInit(): Promise<void> {
    const userHasPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$,
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
