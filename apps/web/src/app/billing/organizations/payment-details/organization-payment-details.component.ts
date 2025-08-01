import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  catchError,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  merge,
  Observable,
  shareReplay,
  switchMap,
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

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import {
  ChangePaymentMethodDialogComponent,
  DisplayAccountCreditComponent,
  DisplayBillingAddressComponent,
  DisplayPaymentMethodComponent,
} from "../../payment/components";
import { BillingAddress, MaskedPaymentMethod } from "../../payment/types";
import { SubscriberBillingClient } from "../../services";
import { BitwardenSubscriber, mapOrganizationToSubscriber } from "../../types";
import { OrganizationFreeTrialWarningComponent } from "../../warnings/components";

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
};

@Component({
  templateUrl: "./organization-payment-details.component.html",
  standalone: true,
  imports: [
    DisplayBillingAddressComponent,
    DisplayAccountCreditComponent,
    DisplayPaymentMethodComponent,
    HeaderModule,
    OrganizationFreeTrialWarningComponent,
    SharedModule,
  ],
  providers: [SubscriberBillingClient],
})
export class OrganizationPaymentDetailsComponent implements OnInit {
  @ViewChild(OrganizationFreeTrialWarningComponent)
  organizationFreeTrialWarningComponent!: OrganizationFreeTrialWarningComponent;

  private viewState$ = new BehaviorSubject<View | null>(null);

  private load$: Observable<View> = this.accountService.activeAccount$
    .pipe(
      getUserId,
      switchMap((userId) =>
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.activatedRoute.snapshot.params.organizationId)),
      ),
    )
    .pipe(
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
        const [paymentMethod, billingAddress, credit] = await Promise.all([
          this.billingClient.getPaymentMethod(organization),
          this.billingClient.getBillingAddress(organization),
          this.billingClient.getCredit(organization),
        ]);

        return {
          organization,
          paymentMethod,
          billingAddress,
          credit,
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

  organization$ = this.view$.pipe(map((view) => view.organization.data as Organization));

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private billingClient: SubscriberBillingClient,
    private configService: ConfigService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private router: Router,
  ) {}

  async ngOnInit() {
    const openChangePaymentMethodDialogOnStart =
      (history.state?.launchPaymentModalAutomatically as boolean) ?? false;

    if (openChangePaymentMethodDialogOnStart) {
      history.replaceState({ ...history.state, launchPaymentModalAutomatically: false }, "");
      await this.changePaymentMethod();
    }
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
      this.organizationFreeTrialWarningComponent.refresh();
    }
  };

  setBillingAddress = (billingAddress: BillingAddress) => {
    if (this.viewState$.value) {
      this.viewState$.next({
        ...this.viewState$.value,
        billingAddress,
      });
    }
  };

  setPaymentMethod = async (paymentMethod: MaskedPaymentMethod) => {
    if (this.viewState$.value) {
      const billingAddress =
        this.viewState$.value.billingAddress ??
        (await this.billingClient.getBillingAddress(this.viewState$.value.organization));

      this.viewState$.next({
        ...this.viewState$.value,
        paymentMethod,
        billingAddress,
      });
    }
  };
}
