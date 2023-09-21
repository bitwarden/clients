import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatestWith,
  map,
  Observable,
  share,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";
import { SelectItemView } from "@bitwarden/components/src/multi-select/models/select-item-view";

import {
  GroupServiceAccountAccessPolicyView,
  ServiceAccountAccessPoliciesView,
  UserServiceAccountAccessPolicyView,
} from "../../models/view/access-policy.view";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import {
  AccessSelectorComponent,
  AccessSelectorRowView,
} from "../../shared/access-policies/access-selector.component";
import {
  AccessRemovalDetails,
  AccessRemovalDialogComponent,
} from "../../shared/access-policies/dialogs/access-removal-dialog.component";

@Component({
  selector: "sm-service-account-people",
  templateUrl: "./service-account-people.component.html",
})
export class ServiceAccountPeopleComponent {
  private destroy$ = new Subject<void>();
  private serviceAccountId: string;
  private organizationId: string;
  private rows: AccessSelectorRowView[];

  protected rows$: Observable<AccessSelectorRowView[]> =
    this.accessPolicyService.serviceAccountAccessPolicyChanges$.pipe(
      startWith(null),
      combineLatestWith(this.route.params),
      switchMap(([_, params]) =>
        this.accessPolicyService.getServiceAccountAccessPolicies(params.serviceAccountId)
      ),
      map((policies) => {
        const rows: AccessSelectorRowView[] = [];
        policies.userAccessPolicies.forEach((policy) => {
          rows.push({
            type: "user",
            name: policy.organizationUserName,
            id: policy.organizationUserId,
            accessPolicyId: policy.id,
            read: policy.read,
            write: policy.write,
            userId: policy.userId,
            icon: AccessSelectorComponent.userIcon,
            static: true,
          });
        });

        policies.groupAccessPolicies.forEach((policy) => {
          rows.push({
            type: "group",
            name: policy.groupName,
            id: policy.groupId,
            accessPolicyId: policy.id,
            read: policy.read,
            write: policy.write,
            currentUserInGroup: policy.currentUserInGroup,
            icon: AccessSelectorComponent.groupIcon,
            static: true,
          });
        });

        return rows;
      }),
      share()
    );

  protected handleCreateAccessPolicies(selected: SelectItemView[]) {
    const serviceAccountAccessPoliciesView = new ServiceAccountAccessPoliciesView();
    serviceAccountAccessPoliciesView.userAccessPolicies = selected
      .filter((selection) => AccessSelectorComponent.getAccessItemType(selection) === "user")
      .map((filtered) => {
        const view = new UserServiceAccountAccessPolicyView();
        view.grantedServiceAccountId = this.serviceAccountId;
        view.organizationUserId = filtered.id;
        view.read = true;
        view.write = true;
        return view;
      });

    serviceAccountAccessPoliciesView.groupAccessPolicies = selected
      .filter((selection) => AccessSelectorComponent.getAccessItemType(selection) === "group")
      .map((filtered) => {
        const view = new GroupServiceAccountAccessPolicyView();
        view.grantedServiceAccountId = this.serviceAccountId;
        view.groupId = filtered.id;
        view.read = true;
        view.write = true;
        return view;
      });

    return this.accessPolicyService.createServiceAccountAccessPolicies(
      this.serviceAccountId,
      serviceAccountAccessPoliciesView
    );
  }

  protected async handleDeleteAccessPolicy(policy: AccessSelectorRowView) {
    if (
      await this.accessPolicyService.needToShowAccessRemovalWarning(
        this.organizationId,
        policy,
        this.rows
      )
    ) {
      this.launchDeleteWarningDialog(policy);
      return;
    }

    try {
      await this.accessPolicyService.deleteAccessPolicy(policy.accessPolicyId);
      const simpleDialogOpts: SimpleDialogOptions = {
        title: this.i18nService.t("saPeopleWarningTitle"),
        content: this.i18nService.t("saPeopleWarningMessage"),
        type: "warning",
        acceptButtonText: { key: "close" },
        cancelButtonText: null,
      };
      this.dialogService.openSimpleDialogRef(simpleDialogOpts);
    } catch (e) {
      this.validationService.showError(e);
    }
  }

  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.serviceAccountId = params.serviceAccountId;
      this.organizationId = params.organizationId;
    });

    this.rows$.pipe(takeUntil(this.destroy$)).subscribe((rows) => {
      this.rows = rows;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private launchDeleteWarningDialog(policy: AccessSelectorRowView) {
    this.dialogService.open<unknown, AccessRemovalDetails>(AccessRemovalDialogComponent, {
      data: {
        title: "smAccessRemovalWarningSaTitle",
        message: "smAccessRemovalWarningSaMessage",
        operation: "delete",
        type: "service-account",
        returnRoute: ["sm", this.organizationId, "service-accounts"],
        policy,
      },
    });
  }
}
