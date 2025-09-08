// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, BitValidators, ToastService } from "@bitwarden/components";

import { ProjectView } from "../../models/view/project.view";
import { ProjectService } from "../../projects/project.service";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum OperationType {
  Add,
  Edit,
}

export interface ProjectOperation {
  organizationId: string;
  operation: OperationType;
  organizationEnabled: boolean;
  projectId?: string;
}

@Component({
  templateUrl: "./project-dialog.component.html",
  standalone: false,
})
export class ProjectDialogComponent implements OnInit {
  protected formGroup = new FormGroup({
    name: new FormControl("", {
      validators: [Validators.required, Validators.maxLength(500), BitValidators.trimValidator],
      updateOn: "submit",
    }),
  });
  protected loading = false;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: ProjectOperation,
    private projectService: ProjectService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    if (this.data.operation === OperationType.Edit && this.data.projectId) {
      await this.loadData();
    } else if (this.data.operation !== OperationType.Add) {
      this.dialogRef.close();
      throw new Error(`The project dialog was not called with the appropriate operation values.`);
    }
  }

  async loadData() {
    this.loading = true;
    const project: ProjectView = await this.projectService.getByProjectId(
      this.data.projectId,
      true,
    );
    this.loading = false;
    this.formGroup.setValue({ name: project.name });
  }

  get title() {
    return this.data.operation === OperationType.Add ? "newProject" : "editProject";
  }

  submit = async () => {
    if (!this.data.organizationEnabled) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("projectsCannotCreate"),
      });
      return;
    }

    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const projectView = this.getProjectView();
    if (this.data.operation === OperationType.Add) {
      const newProject = await this.createProject(projectView);
      await this.router.navigate(["sm", this.data.organizationId, "projects", newProject.id]);
    } else {
      projectView.id = this.data.projectId;
      await this.updateProject(projectView);
    }
    this.dialogRef.close();
  };

  private async createProject(projectView: ProjectView) {
    const newProject = await this.projectService.create(this.data.organizationId, projectView);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("projectCreated"),
    });
    return newProject;
  }

  private async updateProject(projectView: ProjectView) {
    await this.projectService.update(this.data.organizationId, projectView);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("projectSaved"),
    });
  }

  private getProjectView() {
    const projectView = new ProjectView();
    projectView.organizationId = this.data.organizationId;
    projectView.name = this.formGroup.value.name;
    return projectView;
  }
}
