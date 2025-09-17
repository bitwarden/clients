import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { RiskInsightsDataService } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { AtRiskApplicationDetail } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/password-health";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ApplicationsLoadingComponent } from "./risk-insights-loading.component";

@Component({
  selector: "tools-all-activity",
  imports: [ApplicationsLoadingComponent, SharedModule],
  templateUrl: "./all-activity.component.html",
})
export class AllActivityComponent implements OnInit {
  isLoading$: Observable<boolean> = this.dataService.isLoading$;
  atRiskAppDetails: AtRiskApplicationDetail[] = [];
  organization: Organization | null = null;

  async ngOnInit(): Promise<void> {
    const organizationId = this.activatedRoute.snapshot.paramMap.get("organizationId");
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (organizationId) {
      this.organization =
        (await firstValueFrom(
          this.organizationService.organizations$(userId).pipe(getById(organizationId)),
        )) ?? null;

      this.atRiskAppDetails = this.dataService.atRiskAppDetails ?? [];
    }
  }

  constructor(
    protected activatedRoute: ActivatedRoute,
    private accountService: AccountService,
    protected organizationService: OrganizationService,
    protected dataService: RiskInsightsDataService,
  ) {}
}
