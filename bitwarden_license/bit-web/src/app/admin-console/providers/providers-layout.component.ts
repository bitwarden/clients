// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, map, Observable, Subject, switchMap } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType, ProviderType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Icon, IconModule } from "@bitwarden/components";
import { BusinessUnitPortalLogo } from "@bitwarden/web-vault/app/admin-console/icons/business-unit-portal-logo.icon";
import { ProviderPortalLogo } from "@bitwarden/web-vault/app/admin-console/icons/provider-portal-logo";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

import { ProviderWarningsService } from "../../billing/providers/services/provider-warnings.service";

@Component({
  selector: "providers-layout",
  templateUrl: "providers-layout.component.html",
  imports: [CommonModule, RouterModule, JslibModule, WebLayoutModule, IconModule],
  providers: [ProviderWarningsService],
})
export class ProvidersLayoutComponent implements OnInit, OnDestroy {
  protected readonly logo = ProviderPortalLogo;

  private destroy$ = new Subject<void>();
  protected provider$: Observable<Provider>;

  protected logo$: Observable<Icon>;

  protected isBillable: Observable<boolean>;
  protected canAccessBilling$: Observable<boolean>;

  protected clientsTranslationKey$: Observable<string>;
  protected managePaymentDetailsOutsideCheckout$: Observable<boolean>;
  protected providerPortalTakeover$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private providerService: ProviderService,
    private configService: ConfigService,
    private providerWarningsService: ProviderWarningsService,
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");

    const providerId$: Observable<string> = this.route.params.pipe(
      map((params) => params.providerId),
    );

    this.provider$ = providerId$.pipe(
      switchMap((providerId) => this.providerService.get$(providerId)),
      takeUntil(this.destroy$),
    );

    this.logo$ = this.provider$.pipe(
      map((provider) =>
        provider.providerType === ProviderType.BusinessUnit
          ? BusinessUnitPortalLogo
          : ProviderPortalLogo,
      ),
    );

    this.isBillable = this.provider$.pipe(
      map((provider) => provider?.providerStatus === ProviderStatusType.Billable),
    );

    this.canAccessBilling$ = combineLatest([this.isBillable, this.provider$]).pipe(
      map(
        ([hasConsolidatedBilling, provider]) => hasConsolidatedBilling && provider.isProviderAdmin,
      ),
    );

    this.clientsTranslationKey$ = this.provider$.pipe(
      map((provider) =>
        provider.providerType === ProviderType.BusinessUnit ? "businessUnits" : "clients",
      ),
    );

    this.managePaymentDetailsOutsideCheckout$ = this.configService.getFeatureFlag$(
      FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout,
    );

    providerId$
      .pipe(
        switchMap((providerId) =>
          this.providerWarningsService.showProviderSuspendedDialog$(providerId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.providerPortalTakeover$ = this.configService.getFeatureFlag$(
      FeatureFlag.PM21821_ProviderPortalTakeover,
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
