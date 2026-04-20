import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from "rxjs";
import { take } from "rxjs/operators";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { OrganizationBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";

import {
  TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE,
  TrialPaymentDialogComponent,
} from "../../../shared/trial-payment-dialog/trial-payment-dialog.component";
import { openChangePlanDialog } from "../../change-plan-dialog.component";
import {
  OrganizationFreeTrialWarning,
  OrganizationResellerRenewalWarning,
  OrganizationWarningsResponse,
} from "../types";

const format = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

@Injectable({ providedIn: "root" })
export class OrganizationWarningsService {
  private cache$ = new Map<OrganizationId, Observable<OrganizationWarningsResponse>>();

  private refreshFreeTrialWarningTrigger = new Subject<void>();
  private refreshTaxIdWarningTrigger = new Subject<void>();
  private refreshInactiveSubscriptionWarningTrigger = new Subject<void>();

  private taxIdWarningRefreshedSubject = new BehaviorSubject<TaxIdWarningType | null>(null);
  taxIdWarningRefreshed$ = this.taxIdWarningRefreshedSubject.asObservable();

  constructor(
    private accountService: AccountService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationBillingClient: OrganizationBillingClient,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private tokenService: TokenService,
  ) {}

  getFreeTrialWarning$ = (
    organization: Organization,
    includeOrganizationNameInMessaging = false,
  ): Observable<OrganizationFreeTrialWarning | null> =>
    merge(
      this.getWarning$(organization, (response) => response.freeTrial),
      this.refreshFreeTrialWarningTrigger.pipe(
        switchMap(() => this.getWarning$(organization, (response) => response.freeTrial, true)),
      ),
    ).pipe(
      map((warning) => {
        if (!warning) {
          return null;
        }

        const { remainingTrialDays } = warning;

        if (remainingTrialDays >= 2) {
          return {
            organization,
            message: includeOrganizationNameInMessaging
              ? this.i18nService.t(
                  "freeTrialEndPromptMultipleDays",
                  organization.name,
                  remainingTrialDays,
                )
              : this.i18nService.t("freeTrialEndPromptCount", remainingTrialDays),
          };
        }

        if (remainingTrialDays == 1) {
          return {
            organization,
            message: includeOrganizationNameInMessaging
              ? this.i18nService.t("freeTrialEndPromptTomorrow", organization.name)
              : this.i18nService.t("freeTrialEndPromptTomorrowNoOrgName"),
          };
        }

        return {
          organization,
          message: includeOrganizationNameInMessaging
            ? this.i18nService.t("freeTrialEndPromptToday", organization.name)
            : this.i18nService.t("freeTrialEndingTodayWithoutOrgName"),
        };
      }),
    );

  getResellerRenewalWarning$ = (
    organization: Organization,
  ): Observable<OrganizationResellerRenewalWarning | null> =>
    this.getWarning$(organization, (response) => response.resellerRenewal).pipe(
      map((warning) => {
        if (!warning) {
          return null;
        }
        switch (warning.type) {
          case "upcoming": {
            return {
              type: "info",
              message: this.i18nService.t(
                "resellerRenewalWarningMsgV2",
                format(warning.upcoming!.renewalDate),
              ),
            };
          }
          case "issued": {
            return null;
          }
          case "past_due": {
            return {
              type: "info",
              message: this.i18nService.t(
                "resellerPastDueWarningMsgV2",
                format(warning.pastDue!.suspensionDate),
              ),
            };
          }
        }
      }),
    );

  getTaxIdWarning$ = (organization: Organization): Observable<TaxIdWarningType | null> =>
    merge(
      this.getWarning$(organization, (response) => response.taxId),
      this.refreshTaxIdWarningTrigger.pipe(
        switchMap(() =>
          this.getWarning$(organization, (response) => response.taxId, true).pipe(
            tap((warning) => this.taxIdWarningRefreshedSubject.next(warning ? warning.type : null)),
          ),
        ),
      ),
    ).pipe(map((warning) => (warning ? warning.type : null)));

  refreshFreeTrialWarning = () => this.refreshFreeTrialWarningTrigger.next();

  refreshInactiveSubscriptionWarning = () => this.refreshInactiveSubscriptionWarningTrigger.next();

  refreshTaxIdWarning = () => this.refreshTaxIdWarningTrigger.next();

  showInactiveSubscriptionDialog$ = (organization: Organization): Observable<void> =>
    merge(
      this.getWarning$(organization, (response) => response.inactiveSubscription),
      this.refreshInactiveSubscriptionWarningTrigger.pipe(
        switchMap(() =>
          this.getWarning$(organization, (response) => response.inactiveSubscription, true),
        ),
      ),
    ).pipe(
      switchMap(async (warning) => {
        if (!warning) {
          return;
        }

        switch (warning.resolution) {
          case "contact_provider": {
            await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: {
                key: "suspendedManagedOrgMessage",
                placeholders: [organization.providerName],
              },
              type: "danger",
              acceptButtonText: this.i18nService.t("close"),
              cancelButtonText: null,
            });
            break;
          }
          case "add_payment_method": {
            const confirmed = await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: { key: "suspendedOwnerOrgMessage" },
              type: "danger",
              acceptButtonText: this.i18nService.t("continue"),
              cancelButtonText: this.i18nService.t("close"),
            });
            if (confirmed) {
              await this.router.navigate(
                ["organizations", `${organization.id}`, "billing", "payment-details"],
                {
                  state: { launchPaymentModalAutomatically: true },
                },
              );
            }
            break;
          }
          case "resubscribe": {
            const subscription = await this.organizationApiService.getSubscription(organization.id);
            const dialogReference = openChangePlanDialog(this.dialogService, {
              data: {
                organizationId: organization.id,
                subscription: subscription,
                productTierType: organization.productTierType,
              },
            });
            await lastValueFrom(dialogReference.closed);
            break;
          }
          case "contact_owner": {
            await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: { key: "suspendedUserOrgMessage" },
              type: "danger",
              acceptButtonText: this.i18nService.t("close"),
              cancelButtonText: null,
            });
            break;
          }
        }
      }),
    );

  showSubscribeBeforeFreeTrialEndsDialog$ = (organization: Organization): Observable<void> =>
    this.getWarning$(organization, (response) => response.freeTrial).pipe(
      filter((warning) => warning !== null),
      switchMap(async () => {
        const organizationSubscriptionResponse = await this.organizationApiService.getSubscription(
          organization.id,
        );

        const dialogRef = TrialPaymentDialogComponent.open(this.dialogService, {
          data: {
            organizationId: organization.id,
            subscription: organizationSubscriptionResponse,
            productTierType: organization?.productTierType,
          },
        });
        const result = await lastValueFrom(dialogRef.closed);
        if (result === TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED) {
          this.refreshFreeTrialWarningTrigger.next();
        }
      }),
    );

  private readThroughWarnings$ = (
    organization: Organization,
    bypassCache: boolean = false,
  ): Observable<OrganizationWarningsResponse> => {
    const organizationId = organization.id as OrganizationId;
    const existing = this.cache$.get(organizationId);
    if (existing && !bypassCache) {
      return existing;
    }

    // PM-35369: The warnings endpoint authorizes via JWT org-membership claims. A stale
    // access token (e.g. freshly JIT-SSO-confirmed user) lacks the grant and 403s, which
    // ApiService treats as invalid-token and force-logs out from inside send() —
    // downstream error handling can't intercept it. We must preflight to avoid the logout.
    return from(this.hasAccessToWarnings(organization)).pipe(
      switchMap((hasAccess) => {
        if (!hasAccess) {
          // Intentionally do not cache — the access token refreshes on its own cadence,
          // and subsequent subscriptions (after a grant arrives) should hit the API.
          return of(new OrganizationWarningsResponse({}));
        }
        const response$ = from(this.organizationBillingClient.getWarnings(organizationId));
        this.cache$.set(organizationId, response$);
        return response$;
      }),
    );
  };

  private hasAccessToWarnings = async (organization: Organization): Promise<boolean> => {
    if (organization.isProviderUser) {
      // Provider users are authorized server-side via a DB lookup, not JWT claims. Their
      // JWT won't carry an org grant for a managed org, so we must not preflight them.
      return true;
    }
    const organizationId = organization.id as OrganizationId;

    // The next two checks cover benign teardown states (e.g. a subscription firing
    // after the user has signed out). Logging at info so expected teardown noise
    // doesn't drown out the real anomaly below.
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      this.logService.info(
        `[OrganizationWarningsService] Skipping warnings preflight for ${organizationId}: no active account`,
      );
      return false;
    }
    const hasToken = await firstValueFrom(this.tokenService.hasAccessToken$(activeAccount.id));
    if (!hasToken) {
      this.logService.info(
        `[OrganizationWarningsService] Skipping warnings preflight for ${organizationId}: active user has no access token`,
      );
      return false;
    }

    try {
      const decoded = (await this.tokenService.decodeAccessToken(activeAccount.id)) as Record<
        string,
        unknown
      >;
      const hasGrant = ["orgowner", "orgadmin", "orgcustom", "orguser"].some((key) => {
        // The server emits each org-role claim once per org the user holds that role in.
        // When a user has a single org for a given role, System.Text.Json serialises the
        // claim as a single string rather than a one-element array — so we have to
        // accept either shape.
        const claim = decoded[key];
        if (typeof claim === "string") {
          return claim === organizationId;
        }
        if (Array.isArray(claim)) {
          return claim.includes(organizationId);
        }
        return false;
      });
      if (!hasGrant) {
        // This is the PM-35369 case: authenticated user with a token that doesn't yet
        // carry the grant. Log at warning so an operator investigating "why are warnings
        // empty?" can see it in production log configurations that filter info.
        this.logService.warning(
          `[OrganizationWarningsService] Skipping warnings fetch for ${organizationId}: access token has no organization grant`,
        );
      }
      return hasGrant;
    } catch (e) {
      // A decode failure past the hasAccessToken$ gate is unusual enough that we'd
      // rather let the call proceed and surface the real problem server-side.
      this.logService.warning(
        `[OrganizationWarningsService] Could not decode access token during warnings preflight for ${organizationId}; letting the call proceed`,
        e,
      );
      return true;
    }
  };

  private getWarning$ = <T>(
    organization: Organization,
    extract: (response: OrganizationWarningsResponse) => T | null | undefined,
    bypassCache: boolean = false,
  ): Observable<T | null> => {
    if (this.platformUtilsService.isSelfHost()) {
      return of(null);
    }

    return this.readThroughWarnings$(organization, bypassCache).pipe(
      map((response) => {
        const value = extract(response);
        return value ? value : null;
      }),
      take(1),
    );
  };
}
