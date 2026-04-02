import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
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
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  Option,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveViewComponent } from "./receive-view.component";

@Component({
  templateUrl: "./receive-add-edit.component.html",
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    DialogModule,
    FormFieldModule,
    SelectModule,
    ButtonModule,
    IconButtonModule,
    CardComponent,
    I18nPipe,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveAddEditComponent {
  private readonly viewData = inject<ReceiveView | null>(DIALOG_DATA, { optional: true });
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly dialogRef = inject(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly receiveService = inject(ReceiveService);
  private readonly accountService = inject(AccountService);

  protected readonly isEditMode = this.viewData != null;

  protected readonly expirationDayOptions: Option<number>[] = [
    { label: this.i18nService.t("oneHour"), value: 1 / 24 },
    { label: this.i18nService.t("oneDay"), value: 1 },
    { label: this.i18nService.t("days", "2"), value: 2 },
    { label: this.i18nService.t("days", "3"), value: 3 },
    { label: this.i18nService.t("days", "7"), value: 7 },
    { label: this.i18nService.t("days", "14"), value: 14 },
    { label: this.i18nService.t("days", "30"), value: 30 },
  ];

  protected readonly form = this.formBuilder.nonNullable.group({
    name: [this.viewData?.name ?? "", Validators.required],
    expirationDays: [7, Validators.required],
  });

  protected readonly submit = async () => {
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
