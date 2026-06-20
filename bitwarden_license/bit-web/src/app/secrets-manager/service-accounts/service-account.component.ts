// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  Subject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  takeUntil,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { ServiceAccountCounts } from "../models/view/counts.view";
import { ServiceAccountView } from "../models/view/service-account.view";
import { AccessPolicyService } from "../shared/access-policies/access-policy.service";
import { CountService } from "../shared/counts/count.service";
import { organizationForRoute$ } from "../shared/sm-organization";

import { AccessService } from "./access/access.service";
import { AccessTokenCreateDialogComponent } from "./access/dialogs/access-token-create-dialog.component";
import { ServiceAccountService } from "./service-account.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-service-account",
  templateUrl: "./service-account.component.html",
  standalone: false,
})
export class ServiceAccountComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private serviceAccountId: string;

  private onChange$ = this.serviceAccountService.serviceAccount$.pipe(
    filter((sa) => sa?.id === this.serviceAccountId),
    startWith(null),
  );

  private serviceAccountView: ServiceAccountView;
  protected serviceAccount$ = combineLatest([this.route.params, this.onChange$]).pipe(
    switchMap(([params, _]) =>
      this.serviceAccountService.getByServiceAccountId(
        params.serviceAccountId,
        params.organizationId,
      ),
    ),
  );
  protected serviceAccountCounts: ServiceAccountCounts;

  private organizationEnabled: boolean;

  protected renaming = false;

  constructor(
    private route: ActivatedRoute,
    private serviceAccountService: ServiceAccountService,
    private accessPolicyService: AccessPolicyService,
    private accessService: AccessService,
    private dialogService: DialogService,
    private countService: CountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(
        map((p) => p.serviceAccountId),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((serviceAccountId) => {
        // Close the editor when switching accounts.
        this.serviceAccountId = serviceAccountId;
        this.renaming = false;
      });

    organizationForRoute$(this.route.params, this.accountService, this.organizationService)
      .pipe(takeUntil(this.destroy$))
      .subscribe((organization) => {
        this.organizationEnabled = organization?.enabled;
      });

    const serviceAccountCounts$ = combineLatest([
      this.route.params,
      this.accessPolicyService.accessPolicy$.pipe(startWith(null)),
      this.accessService.accessToken$.pipe(startWith(null)),
      this.onChange$,
    ]).pipe(
      switchMap(([params, _]) =>
        this.countService.getServiceAccountCounts(params.serviceAccountId),
      ),
    );

    combineLatest([this.serviceAccount$, serviceAccountCounts$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([serviceAccountView, serviceAccountCounts]) => {
        this.serviceAccountView = serviceAccountView;
        this.serviceAccountCounts = {
          projects: serviceAccountCounts.projects,
          people: serviceAccountCounts.people,
          accessTokens: serviceAccountCounts.accessTokens,
        };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected openNewAccessTokenDialog() {
    AccessTokenCreateDialogComponent.openNewAccessTokenDialog(
      this.dialogService,
      this.serviceAccountView,
    );
  }

  protected saveName = async (name: string): Promise<boolean> => {
    if (this.organizationEnabled === false) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("machineAccountsCannotEdit"),
      });
      return false;
    }

    // serviceAccountView may not be set yet (separate subscription), so read ids from the route.
    const { serviceAccountId, organizationId } = this.route.snapshot.params;

    const serviceAccountView = new ServiceAccountView();
    serviceAccountView.organizationId = organizationId;
    serviceAccountView.name = name;

    await this.serviceAccountService.update(serviceAccountId, organizationId, serviceAccountView);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("machineAccountUpdated"),
    });
    return true;
  };
}
