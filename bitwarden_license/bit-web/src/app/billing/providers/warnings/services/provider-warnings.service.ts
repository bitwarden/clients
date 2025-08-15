import { Injectable } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  Subject,
  switchMap,
  take,
  tap,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ProviderId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { RequirePaymentMethodDialogComponent } from "@bitwarden/web-vault/app/billing/payment/components";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";

import { ProviderWarningsResponse } from "../types/provider-warnings";

@Injectable()
export class ProviderWarningsService {
  private cache$ = new Map<ProviderId, Observable<ProviderWarningsResponse>>();

  private refreshTaxIdWarningTrigger = new Subject<void>();

  private taxIdWarningRefreshedSubject = new BehaviorSubject<TaxIdWarningType | null>(null);
  taxIdWarningRefreshed$ = this.taxIdWarningRefreshedSubject.asObservable();

  constructor(
    private activatedRoute: ActivatedRoute,
    private apiService: ApiService,
    private configService: ConfigService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private router: Router,
    private syncService: SyncService,
  ) {}

  getTaxIdWarning$ = (provider: Provider): Observable<TaxIdWarningType | null> =>
    merge(
      this.getWarning$(provider, (response) => response.taxId),
      this.refreshTaxIdWarningTrigger.pipe(
        switchMap(() =>
          this.getWarning$(provider, (response) => response.taxId, true).pipe(
            tap((warning) => this.taxIdWarningRefreshedSubject.next(warning ? warning.type : null)),
          ),
        ),
      ),
    ).pipe(map((warning) => (warning ? warning.type : null)));

  refreshTaxIdWarning = () => this.refreshTaxIdWarningTrigger.next();

  showProviderSuspendedDialog$ = (provider: Provider): Observable<void> =>
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM21821_ProviderPortalTakeover),
      this.getWarning$(provider, (response) => response.suspension),
    ]).pipe(
      switchMap(async ([providerPortalTakeover, warning]) => {
        if (!providerPortalTakeover || !warning) {
          return;
        }

        switch (warning.resolution) {
          case "add_payment_method": {
            const cancelAt = warning.subscriptionCancelsAt
              ? new Date(warning.subscriptionCancelsAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })
              : null;

            const dialogRef = RequirePaymentMethodDialogComponent.open(this.dialogService, {
              data: {
                subscriber: {
                  type: "provider",
                  data: provider,
                },
                callout: {
                  type: "danger",
                  title: this.i18nService.t("unpaidInvoices"),
                  message: this.i18nService.t(
                    "restoreProviderPortalAccessViaPaymentMethod",
                    cancelAt ?? undefined,
                  ),
                },
              },
            });

            const result = await lastValueFrom(dialogRef.closed);

            if (result?.type === "success") {
              await this.syncService.fullSync(true);
              await this.router.navigate(["."], {
                relativeTo: this.activatedRoute,
                onSameUrlNavigation: "reload",
              });
            }
            break;
          }
          case "contact_administrator": {
            await this.dialogService.openSimpleDialog({
              type: "danger",
              title: this.i18nService.t("unpaidInvoices"),
              content: this.i18nService.t("unpaidInvoicesForServiceUser"),
              disableClose: true,
            });
            break;
          }
          case "contact_support": {
            await this.dialogService.openSimpleDialog({
              type: "danger",
              title: this.i18nService.t("providerSuspended", provider.name),
              content: this.i18nService.t("restoreProviderPortalAccessViaCustomerSupport"),
              acceptButtonText: this.i18nService.t("contactSupportShort"),
              cancelButtonText: null,
              acceptAction: async () => {
                window.open("https://bitwarden.com/contact/", "_blank");
                return Promise.resolve();
              },
            });
          }
        }
      }),
    );

  fetchWarnings = async (providerId: ProviderId): Promise<ProviderWarningsResponse> => {
    const response = await this.apiService.send(
      "GET",
      `/providers/${providerId}/billing/vnext/warnings`,
      null,
      true,
      true,
    );

    return new ProviderWarningsResponse(response);
  };

  private readThroughWarnings$ = (
    provider: Provider,
    bypassCache: boolean = false,
  ): Observable<ProviderWarningsResponse> => {
    const providerId = provider.id as ProviderId;
    const existing = this.cache$.get(providerId);
    if (existing && !bypassCache) {
      return existing;
    }
    const response$ = from(this.fetchWarnings(providerId));
    this.cache$.set(providerId, response$);
    return response$;
  };

  private getWarning$ = <T>(
    provider: Provider,
    extract: (response: ProviderWarningsResponse) => T | null | undefined,
    bypassCache: boolean = false,
  ): Observable<T | null> =>
    this.readThroughWarnings$(provider, bypassCache).pipe(
      map((response) => {
        const value = extract(response);
        return value ? value : null;
      }),
      take(1),
    );
}
