import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, filter, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BusinessUnitPortalLogo, BitSvg, ProviderPortalLogo } from "@bitwarden/assets/svg";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { IconComponent, SvgModule } from "@bitwarden/components";
import { NonIndividualSubscriber } from "@bitwarden/web-vault/app/billing/types";
import { TaxIdWarningComponent } from "@bitwarden/web-vault/app/billing/warnings/components";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";

import { ProviderWarningsService } from "../billing/providers/warnings/services";

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
    SvgModule,
    IconComponent,
    TaxIdWarningComponent,
  ],
})
export class ProvidersLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly providerService = inject(ProviderService);
  private readonly providerWarningsService = inject(ProviderWarningsService);
  private readonly accountService = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly logo = ProviderPortalLogo;

  protected readonly provider$: Observable<Provider> = combineLatest([
    this.route.params.pipe(map((params): string => params.providerId)),
    this.accountService.activeAccount$.pipe(getUserId),
  ]).pipe(
    switchMap(([providerId, userId]) => this.providerService.get$(providerId, userId)),
    filter((provider): provider is Provider => provider != null),
  );

  protected readonly logo$: Observable<BitSvg> = this.provider$.pipe(
    map((provider) =>
      provider.providerType === ProviderType.BusinessUnit
        ? BusinessUnitPortalLogo
        : ProviderPortalLogo,
    ),
  );

  protected readonly canAccessBilling$: Observable<boolean> = this.provider$.pipe(
    map((provider) => provider.isProviderAdmin),
  );

  protected readonly clientsTranslationKey$: Observable<string> = this.provider$.pipe(
    map((provider) =>
      provider.providerType === ProviderType.BusinessUnit ? "businessUnits" : "clients",
    ),
  );

  protected readonly subscriber$: Observable<NonIndividualSubscriber> = this.provider$.pipe(
    map((provider) => ({
      type: "provider",
      data: provider,
    })),
  );

  protected readonly getTaxIdWarning$ = (): Observable<TaxIdWarningType | null> =>
    this.provider$.pipe(
      switchMap((provider) => this.providerWarningsService.getTaxIdWarning$(provider)),
    );

  ngOnInit() {
    document.body.classList.remove("layout_frontend");

    this.provider$
      .pipe(
        switchMap((provider) =>
          this.providerWarningsService.showProviderSuspendedDialog$(provider),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected showManageTab(provider: Provider) {
    return provider.canManageUsers || provider.canAccessEventLogs;
  }

  protected showSettingsTab(provider: Provider) {
    return provider.isProviderAdmin;
  }

  protected readonly refreshTaxIdWarning = () => this.providerWarningsService.refreshTaxIdWarning();
}
