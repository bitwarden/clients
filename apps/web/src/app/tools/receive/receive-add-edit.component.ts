import { ChangeDetectionStrategy, Component, Inject, Optional } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ReceiveCreateInput } from "@bitwarden/common/tools/receive/models/receive-create-input";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BitActionDirective,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveViewComponent } from "./receive-view.component";

@Component({
  templateUrl: "./receive-add-edit.component.html",
  imports: [
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    SelectModule,
    ButtonModule,
    BitActionDirective,
    IconButtonModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveAddEditComponent {
  protected readonly expirationDayOptions: { label: string; value: number }[];
  protected readonly isEditMode: boolean;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ["", Validators.required],
    expirationDays: [7, Validators.required],
  });

  constructor(
    @Optional() @Inject(DIALOG_DATA) private readonly viewData: ReceiveView | null,
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly dialogRef: DialogRef,
    private readonly dialogService: DialogService,
    private readonly receiveService: ReceiveService,
    private readonly accountService: AccountService,
  ) {
    this.isEditMode = this.viewData != null;

    this.expirationDayOptions = [
      { label: this.i18nService.t("oneHour"), value: 1 / 24 },
      { label: this.i18nService.t("oneDay"), value: 1 },
      { label: this.i18nService.t("days", "2"), value: 2 },
      { label: this.i18nService.t("days", "3"), value: 3 },
      { label: this.i18nService.t("days", "7"), value: 7 },
      { label: this.i18nService.t("days", "14"), value: 14 },
      { label: this.i18nService.t("days", "30"), value: 30 },
    ];

    if (this.viewData) {
      this.form.patchValue({
        name: this.viewData.name,
      });
    }
  }

  readonly submit = async () => {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.value.name || !this.form.value.expirationDays) {
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (this.viewData) {
      await this.editReceive(userId);
      this.dialogRef.close();
    } else {
      const receiveView = await this.createReceive(userId);
      this.dialogRef.close();
      this.dialogService.openDrawer(ReceiveViewComponent, {
        data: receiveView,
        closeOnNavigation: true,
      });
    }
  };

  private async editReceive(userId: UserId) {
    if (this.viewData == null) {
      throw new Error("View data is required for editing a receive.");
    }

    const updatedView: ReceiveView = {
      ...this.viewData,
      name: this.form.value.name!,
      expirationDate: this.getExpirationDate(this.form.value.expirationDays!),
    };
    await this.receiveService.update(updatedView, userId);
  }

  private async createReceive(userId: UserId): Promise<ReceiveView> {
    const name = this.form.value.name!;
    const expirationDate = this.getExpirationDate(this.form.value.expirationDays!);
    const input: ReceiveCreateInput = {
      name,
      expirationDate,
    };
    return await this.receiveService.create(input, userId);
  }

  private getExpirationDate(expirationDays: number): Date {
    const expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + expirationDays * 24 * 60 * 60 * 1000);
    return expirationDate;
  }
}
