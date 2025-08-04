// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  AbstractControl,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

import { ProjectListView } from "../../models/view/project-list.view";
import {
  BulkOperationStatus,
  BulkStatusDetails,
  BulkStatusDialogComponent,
} from "../../shared/dialogs/bulk-status-dialog.component";
import { ProjectService } from "../project.service";

export interface ProjectDeleteOperation {
  projects: ProjectListView[];
}

@Component({
  templateUrl: "./project-delete-dialog.component.html",
  standalone: false,
})
export class ProjectDeleteDialogComponent implements OnInit {
  formGroup = new FormGroup({
    confirmDelete: new FormControl("", [this.matchConfirmationMessageValidator()]),
  });

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: ProjectDeleteOperation,
    private projectService: ProjectService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    if (!(this.data.projects?.length >= 1)) {
      this.dialogRef.close();
      throw new Error(
        "The project delete dialog was not called with the appropriate operation values.",
      );
    }
  }

  get title() {
    return this.data.projects.length === 1 ? "deleteProject" : "deleteProjects";
  }

  get dialogContent() {
    return this.data.projects.length === 1
      ? this.i18nService.t("deleteProjectDialogMessage", this.data.projects[0].name)
      : this.i18nService.t("deleteProjectsDialogMessage");
  }

  get dialogConfirmationLabel() {
    return this.i18nService.t("deleteProjectInputLabel", this.dialogConfirmationMessage);
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    await this.delete();
    this.dialogRef.close();
  };

  async delete() {
    const bulkResponses = await this.projectService.delete(this.data.projects);

    if (bulkResponses.find((response) => response.errorMessage)) {
      this.openBulkStatusDialog(bulkResponses.filter((response) => response.errorMessage));
      return;
    }

    const message = this.data.projects.length === 1 ? "deleteProjectToast" : "deleteProjectsToast";
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(message),
    });
  }

  openBulkStatusDialog(bulkStatusResults: BulkOperationStatus[]) {
    this.dialogService.open<unknown, BulkStatusDetails>(BulkStatusDialogComponent, {
      data: {
        title: "deleteProjects",
        subTitle: "projects",
        columnTitle: "projectName",
        message: "bulkDeleteProjectsErrorMessage",
        details: bulkStatusResults,
      },
    });
  }

  private get dialogConfirmationMessage() {
    return this.data.projects?.length === 1
      ? this.i18nService.t("deleteProjectConfirmMessage", this.data.projects[0].name)
      : this.i18nService.t("deleteProjectsConfirmMessage", this.data.projects?.length.toString());
  }

  private matchConfirmationMessageValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (this.dialogConfirmationMessage.toLowerCase() == control.value.toLowerCase()) {
        return null;
      } else {
        return {
          confirmationDoesntMatchError: {
            message: this.i18nService.t("smConfirmationRequired"),
          },
        };
      }
    };
  }
}
