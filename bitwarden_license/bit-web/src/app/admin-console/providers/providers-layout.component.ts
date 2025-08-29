// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, map, Observable, Subject, switchMap } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BusinessUnitPortalLogo, Icon, ProviderPortalLogo } from "@bitwarden/assets/svg";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType, ProviderType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { IconModule } from "@bitwarden/components";
import { NonIndividualSubscriber } from "@bitwarden/web-vault/app/billing/types";
import { TaxIdWarningComponent } from "@bitwarden/web-vault/app/billing/warnings/components";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

import { ProviderWarningsService } from "../../billing/providers/warnings/services";

@Component({
  selector: "providers-layout",
  templateUrl: "providers-layout.component.html",
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    WebLayoutModule,
    IconModule,
    TaxIdWarningComponent,
  ],
})
export class ProvidersLayoutComponent implements OnInit, OnDestroy {
  protected readonly logo = ProviderPortalLogo;

  private destroy$ = new Subject<void>();
  protected provider$: Observable<Provider>;

  protected logo$: Observable<Icon>;

  protected isBillable: Observable<boolean>;
  protected canAccessBilling$: Observable<boolean>;

  protected clientsTranslationKey$: Observable<string>;
  protected providerPortalTakeover$: Observable<boolean>;

  protected subscriber$: Observable<NonIndividualSubscriber>;
  protected getTaxIdWarning$: () => Observable<TaxIdWarningType>;

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

    this.provider$
      .pipe(
        switchMap((provider) =>
          this.providerWarningsService.showProviderSuspendedDialog$(provider),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.providerPortalTakeover$ = this.configService.getFeatureFlag$(
      FeatureFlag.PM21821_ProviderPortalTakeover,
    );

    this.subscriber$ = this.provider$.pipe(
      map((provider) => ({
        type: "provider",
        data: provider,
      })),
    );

    this.getTaxIdWarning$ = () =>
      this.provider$.pipe(
        switchMap((provider) => this.providerWarningsService.getTaxIdWarning$(provider)),
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

  refreshTaxIdWarning = () => this.providerWarningsService.refreshTaxIdWarning();
}
