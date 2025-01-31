// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, map, Observable, Subject, switchMap } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { IconModule } from "@bitwarden/components";
import { ProviderPortalLogo } from "@bitwarden/web-vault/app/admin-console/icons/provider-portal-logo";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

@Component({
  selector: "providers-layout",
  templateUrl: "providers-layout.component.html",
  standalone: true,
  imports: [CommonModule, RouterModule, JslibModule, WebLayoutModule, IconModule],
})
export class ProvidersLayoutComponent implements OnInit, OnDestroy {
  protected readonly logo = ProviderPortalLogo;

  private destroy$ = new Subject<void>();
  protected provider$: Observable<Provider>;

  protected isBillable: Observable<boolean>;
  protected canAccessBilling$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private providerService: ProviderService,
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");

    this.provider$ = this.route.params.pipe(
      switchMap((params) => this.providerService.get$(params.providerId)),
      takeUntil(this.destroy$),
    );

    this.isBillable = this.provider$.pipe(
      map((provider) => provider?.providerStatus === ProviderStatusType.Billable),
      takeUntil(this.destroy$),
    );

    this.canAccessBilling$ = combineLatest([this.isBillable, this.provider$]).pipe(
      map(
        ([hasConsolidatedBilling, provider]) => hasConsolidatedBilling && provider.isProviderAdmin,
      ),
      takeUntil(this.destroy$),
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  showManageTab(provider: Provider) {
    return provider.canManageUsers || provider.canAccessEventLogs;
  }

  showSettingsTab(provider: Provider) {
    return provider.isProviderAdmin;
  }
}
