import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { EmergencyAccessService } from "../../emergency-access";
import { EmergencyAccessType } from "../../emergency-access/enums/emergency-access-type";

export type EmergencyAccessAddEditDialogData = {
  /** display name of the account requesting emergency access */
  name: string;
  /** traces a unique emergency request  */
  emergencyAccessId: string;
  /** A boolean indicating whether the emergency access request is in read-only mode (true for view-only, false for editing). */
  readOnly: boolean;
};

export enum EmergencyAccessAddEditDialogResult {
  Saved = "saved",
  Canceled = "canceled",
  Deleted = "deleted",
}
@Component({
  selector: "emergency-access-add-edit",
  templateUrl: "emergency-access-add-edit.component.html",
})
export class EmergencyAccessAddEditComponent implements OnInit {
  loading = true;
  readOnly = false;
  editMode = false;
  title: string;
  type: EmergencyAccessType = EmergencyAccessType.View;

  emergencyAccessType = EmergencyAccessType;
  waitTimes: { name: string; value: number }[];

  addEditForm = this.formBuilder.group({
    email: ["", [Validators.email, Validators.required]],
    emergencyAccessType: [this.emergencyAccessType.View],
    waitTime: [{ value: null, disabled: this.readOnly }, [Validators.required]],
  });
  constructor(
    @Inject(DIALOG_DATA) protected params: EmergencyAccessAddEditDialogData,
    private formBuilder: FormBuilder,
    private emergencyAccessService: EmergencyAccessService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private dialogRef: DialogRef<EmergencyAccessAddEditDialogResult>,
  ) {}
  async ngOnInit() {
    this.editMode = this.loading = this.params.emergencyAccessId != null;
    this.waitTimes = [
      { name: this.i18nService.t("oneDay"), value: 1 },
      { name: this.i18nService.t("days", "2"), value: 2 },
      { name: this.i18nService.t("days", "7"), value: 7 },
      { name: this.i18nService.t("days", "14"), value: 14 },
      { name: this.i18nService.t("days", "30"), value: 30 },
      { name: this.i18nService.t("days", "90"), value: 90 },
    ];

    if (this.editMode) {
      this.title = this.i18nService.t("editEmergencyContact");
      try {
        const emergencyAccess = await this.emergencyAccessService.getEmergencyAccess(
          this.params.emergencyAccessId,
        );
        this.addEditForm.patchValue({
          email: emergencyAccess.email,
          waitTime: emergencyAccess.waitTimeDays,
          emergencyAccessType: emergencyAccess.type,
        });
      } catch (e) {
        this.logService.error(e);
      }
    } else {
      this.title = this.i18nService.t("inviteEmergencyContact");
      this.addEditForm.patchValue({ waitTime: this.waitTimes[2].value });
    }

    this.loading = false;
  }

  submit = async () => {
    if (this.addEditForm.invalid) {
      this.addEditForm.markAllAsTouched();
      return;
    }
    try {
      if (this.editMode) {
        await this.emergencyAccessService.update(
          this.params.emergencyAccessId,
          this.addEditForm.value.emergencyAccessType,
          this.addEditForm.value.waitTime,
        );
      } else {
        await this.emergencyAccessService.invite(
          this.addEditForm.value.email,
          this.addEditForm.value.emergencyAccessType,
          this.addEditForm.value.waitTime,
        );
      }
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.editMode ? "editedUserId" : "invitedUsers", this.params.name),
      );
      this.dialogRef.close(EmergencyAccessAddEditDialogResult.Saved);
    } catch (e) {
      this.logService.error(e);
    }
  };

  delete = async () => {
    this.dialogRef.close(EmergencyAccessAddEditDialogResult.Deleted);
  };
  /**
   * Strongly typed helper to open a EmergencyAccessAddEditComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    config: DialogConfig<EmergencyAccessAddEditDialogData>,
  ) => {
    return dialogService.open<EmergencyAccessAddEditDialogResult>(
      EmergencyAccessAddEditComponent,
      config,
    );
  };
}
