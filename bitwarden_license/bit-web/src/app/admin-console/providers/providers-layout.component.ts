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
import { ProviderType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { IconModule } from "@bitwarden/components";
import { NonIndividualSubscriber } from "@bitwarden/web-vault/app/billing/types";
import { TaxIdWarningComponent } from "@bitwarden/web-vault/app/billing/warnings/components";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

import { ProviderWarningsService } from "../../billing/providers/warnings/services";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");

    const providerId$: Observable<string> = this.route.params.pipe(
      map((params) => params.providerId),
    );

    this.provider$ = combineLatest([
      providerId$,
      this.accountService.activeAccount$.pipe(getUserId),
    ]).pipe(
      switchMap(([providerId, userId]) => this.providerService.get$(providerId, userId)),
      takeUntil(this.destroy$),
    );

    this.logo$ = this.provider$.pipe(
      map((provider) =>
        provider.providerType === ProviderType.BusinessUnit
          ? BusinessUnitPortalLogo
          : ProviderPortalLogo,
      ),
    );

    this.canAccessBilling$ = this.provider$.pipe(map((provider) => provider.isProviderAdmin));

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
