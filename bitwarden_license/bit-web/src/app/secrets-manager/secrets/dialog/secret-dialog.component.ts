// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom, lastValueFrom, Subject, takeUntil } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  DialogRef,
  DIALOG_DATA,
  DialogService,
  BitValidators,
  ToastService,
  CenterPositionStrategy,
} from "@bitwarden/components";

import { SecretAccessPoliciesView } from "../../models/view/access-policies/secret-access-policies.view";
import { ProjectListView } from "../../models/view/project-list.view";
import { ProjectView } from "../../models/view/project.view";
import { SecretListView } from "../../models/view/secret-list.view";
import { SecretProjectView } from "../../models/view/secret-project.view";
import { SecretView } from "../../models/view/secret.view";
import { ProjectService } from "../../projects/project.service";
import { AccessPolicySelectorService } from "../../shared/access-policies/access-policy-selector/access-policy-selector.service";
import {
  ApItemValueType,
  convertToSecretAccessPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-value.type";
import {
  ApItemViewType,
  convertPotentialGranteesToApItemViewType,
  convertSecretAccessPoliciesToApItemViews,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-view.type";
import { ApItemEnum } from "../../shared/access-policies/access-policy-selector/models/enums/ap-item.enum";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import { SecretService } from "../secret.service";

import { SecretDeleteDialogComponent, SecretDeleteOperation } from "./secret-delete.component";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum OperationType {
  Add,
  Edit,
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SecretDialogTabType {
  NameValuePair = 0,
  People = 1,
  ServiceAccounts = 2,
}

export interface SecretOperation {
  organizationId: string;
  operation: OperationType;
  projectId?: string;
  secretId?: string;
  organizationEnabled: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./secret-dialog.component.html",
  standalone: false,
})
export class SecretDialogComponent implements OnInit, OnDestroy {
  loading = true;
  projects: ProjectListView[];
  addNewProject = false;
  newProjectGuid = Utils.newGuid();
  tabIndex: SecretDialogTabType = SecretDialogTabType.NameValuePair;

  protected formGroup = new FormGroup({
    name: new FormControl("", {
      validators: [Validators.required, Validators.maxLength(500), BitValidators.trimValidator],
      updateOn: "submit",
    }),
    value: new FormControl("", [Validators.required, Validators.maxLength(25000)]),
    notes: new FormControl("", {
      validators: [Validators.maxLength(7000), BitValidators.trimValidator],
      updateOn: "submit",
    }),
    project: new FormControl("", [Validators.required]),
    newProjectName: new FormControl("", {
      validators: [Validators.maxLength(500), BitValidators.trimValidator],
      updateOn: "submit",
    }),
    peopleAccessPolicies: new FormControl([] as ApItemValueType[]),
    serviceAccountAccessPolicies: new FormControl([] as ApItemValueType[]),
  });
  protected peopleAccessPolicyItems: ApItemViewType[];
  protected serviceAccountAccessPolicyItems: ApItemViewType[];

  private destroy$ = new Subject<void>();
  private currentPeopleAccessPolicies: ApItemViewType[];

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: SecretOperation,
    private secretService: SecretService,
    private changeDetectorRef: ChangeDetectorRef,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private projectService: ProjectService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private accessPolicyService: AccessPolicyService,
    private accessPolicySelectorService: AccessPolicySelectorService,
    private toastService: ToastService,
  ) {}

  get title() {
    return this.data.operation === OperationType.Add ? "newSecret" : "editSecret";
  }

  get subtitle(): string | undefined {
    if (this.data.operation === OperationType.Edit) {
      return this.formGroup.get("name").value;
    }
  }

  get deleteButtonIsVisible(): boolean {
    return this.data.operation === OperationType.Edit;
  }

  async ngOnInit() {
    this.loading = true;
    if (this.data.operation === OperationType.Edit && this.data.secretId) {
      await this.loadEditDialog();
    } else if (this.data.operation !== OperationType.Add) {
      this.dialogRef.close();
      throw new Error(`The secret dialog was not called with the appropriate operation values.`);
    } else if (this.data.operation === OperationType.Add) {
      await this.loadAddDialog();
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    if (
      (
        await firstValueFrom(
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(this.data.organizationId)),
        )
      )?.isAdmin
    ) {
      this.formGroup.get("project").removeValidators(Validators.required);
      this.formGroup.get("project").updateValueAndValidity();
    }

    this.loading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    if (!this.data.organizationEnabled) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("secretsCannotCreate"),
      });
      return;
    }

    if (this.isFormInvalid()) {
      return;
    }

    const secretView = this.getSecretView();
    const secretAccessPoliciesView = convertToSecretAccessPoliciesView([
      ...this.formGroup.value.peopleAccessPolicies,
      ...this.formGroup.value.serviceAccountAccessPolicies,
    ]);

    const showAccessRemovalWarning =
      this.data.operation === OperationType.Edit &&
      (await this.accessPolicySelectorService.showSecretAccessRemovalWarning(
        this.data.organizationId,
        this.currentPeopleAccessPolicies,
        this.formGroup.value.peopleAccessPolicies,
      ));

    if (showAccessRemovalWarning) {
      const confirmed = await this.showWarning();
      if (!confirmed) {
        return;
      }
    }

    if (this.addNewProject) {
      const newProject = await this.createProject(this.getNewProjectView());
      secretView.projects = [newProject];
    }

    if (this.data.operation === OperationType.Add) {
      await this.createSecret(secretView, secretAccessPoliciesView);
    } else {
      secretView.id = this.data.secretId;
      await this.updateSecret(secretView, secretAccessPoliciesView);
    }
    this.dialogRef.close();
  };

  delete = async () => {
    const secretListView: SecretListView[] = this.getSecretListView();

    const dialogRef = this.dialogService.open<unknown, SecretDeleteOperation>(
      SecretDeleteDialogComponent,
      {
        data: {
          secrets: secretListView,
        },
        positionStrategy: new CenterPositionStrategy(),
      },
    );

    await lastValueFrom(dialogRef.closed).then(
      (closeData) => closeData !== undefined && this.dialogRef.close(),
    );
  };

  private async loadEditDialog() {
    const secret = await this.secretService.getBySecretId(this.data.secretId);
    await this.loadProjects(secret.projects);

    const currentAccessPolicies = await this.getCurrentAccessPolicies(
      this.data.organizationId,
      this.data.secretId,
    );
    this.currentPeopleAccessPolicies = currentAccessPolicies.filter(
      (p) => p.type === ApItemEnum.User || p.type === ApItemEnum.Group,
    );
    const currentServiceAccountPolicies = currentAccessPolicies.filter(
      (p) => p.type === ApItemEnum.ServiceAccount,
    );

    this.peopleAccessPolicyItems = await this.getPeoplePotentialGrantees(this.data.organizationId);
    this.serviceAccountAccessPolicyItems = await this.getServiceAccountItems(
      this.data.organizationId,
      currentServiceAccountPolicies,
    );

    // Must detect changes so that AccessSelector @Inputs() are aware of the latest
    // potentialGrantees, otherwise no selected values will be patched below
    this.changeDetectorRef.detectChanges();

    this.formGroup.patchValue({
      name: secret.name,
      value: secret.value,
      notes: secret.note,
      project: secret.projects[0]?.id ?? "",
      newProjectName: "",
      peopleAccessPolicies: this.currentPeopleAccessPolicies.map((m) => ({
        type: m.type,
        id: m.id,
        permission: m.permission,
        currentUser: m.type === ApItemEnum.User ? m.currentUser : null,
        currentUserInGroup: m.type === ApItemEnum.Group ? m.currentUserInGroup : null,
      })),
      serviceAccountAccessPolicies: currentServiceAccountPolicies.map((m) => ({
        type: m.type,
        id: m.id,
        permission: m.permission,
      })),
    });
  }

  private async loadAddDialog() {
    await this.loadProjects();
    this.peopleAccessPolicyItems = await this.getPeoplePotentialGrantees(this.data.organizationId);
    this.serviceAccountAccessPolicyItems = await this.getServiceAccountItems(
      this.data.organizationId,
    );

    if (
      this.data.projectId === null ||
      this.data.projectId === "" ||
      this.data.projectId === undefined
    ) {
      this.addNewProjectOptionToProjectsDropDown();
    }

    if (this.data.projectId) {
      this.formGroup.get("project").setValue(this.data.projectId);
    }
  }

  private async loadProjects(currentProjects?: SecretProjectView[]) {
    this.projects = await this.projectService
      .getProjects(this.data.organizationId)
      .then((projects) => projects.filter((p) => p.write));

    if (currentProjects?.length > 0) {
      const currentProject = currentProjects?.[0];
      if (this.projects.find((p) => p.id === currentProject.id) === undefined) {
        const listView = new ProjectListView();
        listView.id = currentProject.id;
        listView.name = currentProject.name;
        this.projects.push(listView);
      }
    }

    this.projects = this.projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  private addNewProjectOptionToProjectsDropDown() {
    this.formGroup
      .get("project")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((val: string) => {
        this.dropDownSelected(val);
      });

    const addNewProject = new ProjectListView();
    addNewProject.name = this.i18nService.t("newProject");
    addNewProject.id = this.newProjectGuid;
    this.projects.unshift(addNewProject);
  }

  private dropDownSelected(val: string) {
    this.addNewProject = val == this.newProjectGuid;

    if (this.addNewProject) {
      this.formGroup.get("newProjectName").addValidators([Validators.required]);
    } else {
      this.formGroup.get("newProjectName").clearValidators();
    }

    this.formGroup.get("newProjectName").updateValueAndValidity();
  }

  private async createProject(projectView: ProjectView) {
    return await this.projectService.create(this.data.organizationId, projectView);
  }

  private async createSecret(
    secretView: SecretView,
    secretAccessPoliciesView: SecretAccessPoliciesView,
  ) {
    await this.secretService.create(this.data.organizationId, secretView, secretAccessPoliciesView);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("secretCreated"),
    });
  }

  private getNewProjectView() {
    const projectView = new ProjectView();
    projectView.organizationId = this.data.organizationId;
    projectView.name = this.formGroup.value.newProjectName;
    return projectView;
  }

  private async updateSecret(
    secretView: SecretView,
    secretAccessPoliciesView: SecretAccessPoliciesView,
  ) {
    await this.secretService.update(this.data.organizationId, secretView, secretAccessPoliciesView);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("secretEdited"),
    });
  }

  private getSecretView() {
    const secretView = new SecretView();
    secretView.organizationId = this.data.organizationId;
    secretView.name = this.formGroup.value.name;
    secretView.value = this.formGroup.value.value;
    secretView.note = this.formGroup.value.notes;

    const project = this.projects.find((p) => p.id == this.formGroup.value.project);
    secretView.projects = project != undefined ? [project] : [];

    return secretView;
  }

  private getSecretListView() {
    const secretListViews: SecretListView[] = [];
    const emptyProjects: SecretProjectView[] = [];

    const secretListView = new SecretListView();

    if (this.formGroup.value.project) {
      secretListView.projects = [this.projects.find((p) => p.id == this.formGroup.value.project)];
    } else {
      secretListView.projects = emptyProjects;
    }

    secretListView.organizationId = this.data.organizationId;
    secretListView.id = this.data.secretId;
    secretListView.name = this.formGroup.value.name;
    secretListViews.push(secretListView);
    return secretListViews;
  }

  private async getCurrentAccessPolicies(
    organizationId: string,
    secretId: string,
  ): Promise<ApItemViewType[]> {
    return convertSecretAccessPoliciesToApItemViews(
      await this.accessPolicyService.getSecretAccessPolicies(organizationId, secretId),
    );
  }

  private async getPeoplePotentialGrantees(organizationId: string): Promise<ApItemViewType[]> {
    return convertPotentialGranteesToApItemViewType(
      await this.accessPolicyService.getPeoplePotentialGrantees(organizationId),
    );
  }

  private async getServiceAccountItems(
    organizationId: string,
    currentAccessPolicies?: ApItemViewType[],
  ): Promise<ApItemViewType[]> {
    const potentialGrantees = convertPotentialGranteesToApItemViewType(
      await this.accessPolicyService.getServiceAccountsPotentialGrantees(organizationId),
    );
    const items = [...potentialGrantees];
    if (currentAccessPolicies) {
      for (const policy of currentAccessPolicies) {
        const exists = potentialGrantees.some((grantee) => grantee.id === policy.id);
        if (!exists) {
          items.push(policy);
        }
      }
    }
    return items;
  }

  private async showWarning(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "smAccessRemovalWarningSecretTitle" },
      content: { key: "smAccessRemovalSecretMessage" },
      acceptButtonText: { key: "removeAccess" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    return confirmed;
  }

  private isFormInvalid(): boolean {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid && this.tabIndex !== SecretDialogTabType.NameValuePair) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t(
          "fieldOnTabRequiresAttention",
          this.i18nService.t("nameValuePair"),
        ),
      });
    }

    return this.formGroup.invalid;
  }
}
