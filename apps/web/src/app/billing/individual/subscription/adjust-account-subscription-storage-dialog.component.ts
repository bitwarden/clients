import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { SubscriptionCadence } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { Maybe } from "@bitwarden/pricing";
import { MAX_STORAGE_GB } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";
import { AccountBillingClient } from "@bitwarden/web-vault/app/billing/clients";

type RemoveStorage = {
  type: "remove";
  existing: number;
};

type AddStorage = {
  type: "add";
  price: number;
  provided: number;
  cadence: SubscriptionCadence;
  existing?: number;
};

export type AdjustAccountSubscriptionStorageDialogParams = RemoveStorage | AddStorage;

type AdjustAccountSubscriptionStorageDialogResult = "closed" | "submitted";

@Component({
  templateUrl: "./adjust-account-subscription-storage-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccountBillingClient],
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CurrencyPipe,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class AdjustAccountSubscriptionStorageDialogComponent {
  private readonly accountBillingClient = inject(AccountBillingClient);
  private readonly dialogParams = inject<AdjustAccountSubscriptionStorageDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<AdjustAccountSubscriptionStorageDialogResult>);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  readonly action = computed<"add" | "remove">(() => this.dialogParams.type);

  readonly price = computed<Maybe<number>>(() => {
    if (this.dialogParams.type === "add") {
      return this.dialogParams.price;
    }
  });

  readonly provided = computed<Maybe<number>>(() => {
    if (this.dialogParams.type === "add") {
      return this.dialogParams.provided;
    }
  });

  readonly term = computed<Maybe<string>>(() => {
    if (this.dialogParams.type === "add") {
      switch (this.dialogParams.cadence) {
        case "annually":
          return this.i18nService.t("year");
        case "monthly":
          return this.i18nService.t("month");
      }
    }
  });

  readonly existing = computed<Maybe<number>>(() => this.dialogParams.existing);

  readonly content = computed<{
    title: string;
    body: string;
    label: string;
  }>(() => {
    const action = this.action();
    switch (action) {
      case "add":
        return {
          title: this.i18nService.t("addStorage"),
          body: this.i18nService.t("storageAddNote"),
          label: this.i18nService.t("gbStorageAdd"),
        };
      case "remove":
        return {
          title: this.i18nService.t("removeStorage"),
          body: this.i18nService.t("whenYouRemoveStorage"),
          label: this.i18nService.t("gbStorageRemove"),
        };
    }
  });

  readonly maxPurchasable = computed<Maybe<number>>(() => {
    const provided = this.provided();
    if (provided) {
      return MAX_STORAGE_GB - provided;
    }
  });

  readonly maxValidatorValue = computed<number>(() => {
    const maxPurchasable = this.maxPurchasable() ?? MAX_STORAGE_GB;
    const existing = this.existing();
    const action = this.action();

    switch (action) {
      case "add": {
        return existing ? maxPurchasable - existing : maxPurchasable;
      }
      case "remove": {
        return existing ? existing : 0;
      }
    }
  });

  formGroup = new FormGroup({
    amount: new FormControl<number>(1, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(this.maxValidatorValue()),
      ],
    }),
  });

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid || !this.formGroup.value.amount) {
      return;
    }

    const action = this.action();
    const existing = this.existing();
    const amount = this.formGroup.value.amount;

    switch (action) {
      case "add": {
        await this.accountBillingClient.updateSubscriptionStorage(amount + (existing ?? 0));
        break;
      }
      case "remove": {
        await this.accountBillingClient.updateSubscriptionStorage(existing! - amount);
      }
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("adjustedStorage", amount),
    });

    this.dialogRef.close("submitted");
  };

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<AdjustAccountSubscriptionStorageDialogParams>,
  ) =>
    dialogService.open<AdjustAccountSubscriptionStorageDialogResult>(
      AdjustAccountSubscriptionStorageDialogComponent,
      dialogConfig,
    );
}
