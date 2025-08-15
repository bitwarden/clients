import { Injectable } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, from, lastValueFrom, Observable, switchMap } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService } from "@bitwarden/components";
import { RequirePaymentMethodDialogComponent } from "@bitwarden/web-vault/app/billing/payment/components";

@Injectable()
export class ProviderWarningsService {
  constructor(
    private activatedRoute: ActivatedRoute,
    private billingApiService: BillingApiServiceAbstraction,
    private configService: ConfigService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private providerService: ProviderService,
    private router: Router,
    private syncService: SyncService,
  ) {}

  showProviderSuspendedDialog$ = (providerId: string): Observable<void> =>
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM21821_ProviderPortalTakeover),
      this.providerService.get$(providerId),
      from(this.billingApiService.getProviderSubscription(providerId)),
    ]).pipe(
      switchMap(async ([providerPortalTakeover, provider, subscription]) => {
        if (!providerPortalTakeover || provider.enabled) {
          return;
        }

        if (subscription.status === "unpaid") {
          switch (provider.type) {
            case ProviderUserType.ProviderAdmin: {
              const cancelAt = subscription.cancelAt
                ? new Date(subscription.cancelAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })
                : null;

              const dialogRef = RequirePaymentMethodDialogComponent.open(this.dialogService, {
                data: {
                  owner: {
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
            case ProviderUserType.ServiceUser: {
              await this.dialogService.openSimpleDialog({
                type: "danger",
                title: this.i18nService.t("unpaidInvoices"),
                content: this.i18nService.t("unpaidInvoicesForServiceUser"),
                disableClose: true,
              });
              break;
            }
          }
        } else {
          await this.dialogService.openSimpleDialog({
            type: "danger",
            title: this.i18nService.t("providerSuspended", provider.name),
            content: this.i18nService.t("restoreProviderPortalAccessViaCustomerSupport"),
            disableClose: false,
            acceptButtonText: this.i18nService.t("contactSupportShort"),
            cancelButtonText: null,
            acceptAction: async () => {
              window.open("https://bitwarden.com/contact/", "_blank");
              return Promise.resolve();
            },
          });
        }
      }),
    );
}
