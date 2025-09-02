import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationFreeTrialWarningComponent } from "@bitwarden/web-vault/app/billing/organizations/warnings/components";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import {
  ChangePaymentMethodDialogComponent,
  DisplayAccountCreditComponent,
  DisplayBillingAddressComponent,
  DisplayPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";
import {
  BillingAddress,
  MaskedPaymentMethod,
} from "@bitwarden/web-vault/app/billing/payment/types";
import {
  BitwardenSubscriber,
  mapOrganizationToSubscriber,
} from "@bitwarden/web-vault/app/billing/types";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

class RedirectError {
  constructor(
    public path: string[],
    public relativeTo: ActivatedRoute,
  ) {}
}

type View = {
  organization: BitwardenSubscriber;
  paymentMethod: MaskedPaymentMethod | null;
  billingAddress: BillingAddress | null;
  credit: number | null;
  taxIdWarning: TaxIdWarningType | null;
};

@Component({
  templateUrl: "./organization-payment-details.component.html",
  standalone: true,
  imports: [
    DisplayAccountCreditComponent,
    DisplayBillingAddressComponent,
    DisplayPaymentMethodComponent,
    HeaderModule,
    OrganizationFreeTrialWarningComponent,
    SharedModule,
  ],
})
export class OrganizationPaymentDetailsComponent implements OnInit, OnDestroy {
  private viewState$ = new BehaviorSubject<View | null>(null);

  protected organization$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.activatedRoute.snapshot.params.organizationId)),
    ),
    filter((organization): organization is Organization => !!organization),
  );

  private load$: Observable<View> = this.organization$.pipe(
    switchMap((organization) =>
      this.configService
        .getFeatureFlag$(FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout)
        .pipe(
          map((managePaymentDetailsOutsideCheckout) => {
            if (!managePaymentDetailsOutsideCheckout) {
              throw new RedirectError(["../payment-method"], this.activatedRoute);
            }
            return organization;
          }),
        ),
    ),
    mapOrganizationToSubscriber,
    switchMap(async (organization) => {
      const getTaxIdWarning = firstValueFrom(
        this.organizationWarningsService.getTaxIdWarning$(organization.data as Organization),
      );

      const [paymentMethod, billingAddress, credit, taxIdWarning] = await Promise.all([
        this.subscriberBillingClient.getPaymentMethod(organization),
        this.subscriberBillingClient.getBillingAddress(organization),
        this.subscriberBillingClient.getCredit(organization),
        getTaxIdWarning,
      ]);

      return {
        organization,
        paymentMethod,
        billingAddress,
        credit,
        taxIdWarning,
      };
    }),
    catchError((error: unknown) => {
      if (error instanceof RedirectError) {
        return from(this.router.navigate(error.path, { relativeTo: error.relativeTo })).pipe(
          switchMap(() => EMPTY),
        );
      }
      throw error;
    }),
  );

  view$: Observable<View> = merge(
    this.load$.pipe(tap((view) => this.viewState$.next(view))),
    this.viewState$.pipe(filter((view): view is View => view !== null)),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  private destroy$ = new Subject<void>();

  protected enableTaxIdWarning!: boolean;

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private configService: ConfigService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private organizationWarningsService: OrganizationWarningsService,
    private router: Router,
    private subscriberBillingClient: SubscriberBillingClient,
  ) {}

  async ngOnInit() {
    const openChangePaymentMethodDialogOnStart =
      (history.state?.launchPaymentModalAutomatically as boolean) ?? false;

    if (openChangePaymentMethodDialogOnStart) {
      history.replaceState({ ...history.state, launchPaymentModalAutomatically: false }, "");
      await this.changePaymentMethod();
    }

    this.enableTaxIdWarning = await this.configService.getFeatureFlag(
      FeatureFlag.PM22415_TaxIDWarnings,
    );

    if (this.enableTaxIdWarning) {
      this.organizationWarningsService.taxIdWarningRefreshed$
        .pipe(
          switchMap((warning) =>
            combineLatest([
              of(warning),
              this.organization$.pipe(take(1)).pipe(
                mapOrganizationToSubscriber,
                switchMap((organization) =>
                  this.subscriberBillingClient.getBillingAddress(organization),
                ),
              ),
            ]),
          ),
          takeUntil(this.destroy$),
        )
        .subscribe(([taxIdWarning, billingAddress]) => {
          if (this.viewState$.value) {
            this.viewState$.next({
              ...this.viewState$.value,
              taxIdWarning,
              billingAddress,
            });
          }
        });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  changePaymentMethod = async () => {
    const view = await firstValueFrom(this.view$);
    const dialogRef = ChangePaymentMethodDialogComponent.open(this.dialogService, {
      data: {
        subscriber: view.organization,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result?.type === "success") {
      await this.setPaymentMethod(result.paymentMethod);
    }
  };

  setBillingAddress = (billingAddress: BillingAddress) => {
    if (this.viewState$.value) {
      if (
        this.enableTaxIdWarning &&
        this.viewState$.value.billingAddress?.taxId !== billingAddress.taxId
      ) {
        this.organizationWarningsService.refreshTaxIdWarning();
      }
      this.viewState$.next({
        ...this.viewState$.value,
        billingAddress,
      });
    }
  };

  setPaymentMethod = async (paymentMethod: MaskedPaymentMethod) => {
    if (this.viewState$.value) {
      if (!this.viewState$.value.paymentMethod) {
        this.organizationWarningsService.refreshFreeTrialWarning();
      }

      const billingAddress =
        this.viewState$.value.billingAddress ??
        (await this.subscriberBillingClient.getBillingAddress(this.viewState$.value.organization));

      this.viewState$.next({
        ...this.viewState$.value,
        paymentMethod,
        billingAddress,
      });
    }
  };
}
