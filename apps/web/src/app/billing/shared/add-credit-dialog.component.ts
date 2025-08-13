// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ElementRef, Inject, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { BitPayInvoiceRequest } from "@bitwarden/common/billing/models/request/bit-pay-invoice.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";

export interface AddCreditDialogData {
  organizationId: string;
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AddCreditDialogResult {
  Added = "added",
  Cancelled = "cancelled",
}

export type PayPalConfig = {
  businessId?: string;
  buttonAction?: string;
};

@Component({
  templateUrl: "add-credit-dialog.component.html",
  standalone: false,
})
export class AddCreditDialogComponent implements OnInit {
  @ViewChild("ppButtonForm", { read: ElementRef, static: true }) ppButtonFormRef: ElementRef;

  paymentMethodType = PaymentMethodType;
  ppButtonFormAction: string;
  ppButtonBusinessId: string;
  ppButtonCustomField: string;
  ppLoading = false;
  subject: string;
  returnUrl: string;
  organizationId: string;

  private userId: string;
  private name: string;
  private email: string;
  private region: string;

  protected DialogResult = AddCreditDialogResult;
  protected formGroup = new FormGroup({
    method: new FormControl(PaymentMethodType.PayPal),
    creditAmount: new FormControl(null, [Validators.required]),
  });

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: AddCreditDialogData,
    private accountService: AccountService,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private organizationService: OrganizationService,
    private logService: LogService,
    private configService: ConfigService,
  ) {
    this.organizationId = data.organizationId;
    const payPalConfig = process.env.PAYPAL_CONFIG as PayPalConfig;
    this.ppButtonFormAction = payPalConfig.buttonAction;
    this.ppButtonBusinessId = payPalConfig.businessId;
  }

  async ngOnInit() {
    if (this.organizationId != null) {
      if (this.creditAmount == null) {
        this.creditAmount = "0.00";
      }
      this.ppButtonCustomField = "organization_id:" + this.organizationId;
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const org = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );
      if (org != null) {
        this.subject = org.name;
        this.name = org.name;
      }
    } else {
      if (this.creditAmount == null) {
        this.creditAmount = "0.00";
      }
      const [userId, email] = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => [a?.id, a?.email])),
      );
      this.userId = userId;
      this.subject = email;
      this.email = this.subject;
      this.ppButtonCustomField = "user_id:" + this.userId;
    }
    this.region = await firstValueFrom(this.configService.cloudRegion$);
    this.ppButtonCustomField += ",account_credit:1";
    this.ppButtonCustomField += `,region:${this.region}`;
    this.returnUrl = window.location.href;
  }

  get creditAmount() {
    return this.formGroup.value.creditAmount;
  }
  set creditAmount(value: string) {
    this.formGroup.get("creditAmount").setValue(value);
  }

  get method() {
    return this.formGroup.value.method;
  }

  submit = async () => {
    if (this.creditAmount == null || this.creditAmount === "") {
      return;
    }

    if (this.method === PaymentMethodType.PayPal) {
      this.ppButtonFormRef.nativeElement.submit();
      this.ppLoading = true;
      return;
    }
    if (this.method === PaymentMethodType.BitPay) {
      const req = new BitPayInvoiceRequest();
      req.email = this.email;
      req.name = this.name;
      req.credit = true;
      req.amount = this.creditAmountNumber;
      req.organizationId = this.organizationId;
      req.userId = this.userId;
      req.returnUrl = this.returnUrl;
      const bitPayUrl: string = await this.apiService.postBitPayInvoice(req);
      this.platformUtilsService.launchUri(bitPayUrl);
      return;
    }
    this.dialogRef.close(AddCreditDialogResult.Added);
  };

  formatAmount() {
    try {
      if (this.creditAmount != null && this.creditAmount !== "") {
        const floatAmount = Math.abs(parseFloat(this.creditAmount));
        if (floatAmount > 0) {
          this.creditAmount = parseFloat((Math.round(floatAmount * 100) / 100).toString())
            .toFixed(2)
            .toString();
          return;
        }
      }
    } catch (e) {
      this.logService.error(e);
    }
    this.creditAmount = "";
  }

  get creditAmountNumber(): number {
    if (this.creditAmount != null && this.creditAmount !== "") {
      try {
        return parseFloat(this.creditAmount);
      } catch (e) {
        this.logService.error(e);
      }
    }
    return null;
  }
}

/**
 * Strongly typed helper to open a AddCreditDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openAddCreditDialog(
  dialogService: DialogService,
  config: DialogConfig<AddCreditDialogData>,
) {
  return dialogService.open<AddCreditDialogResult>(AddCreditDialogComponent, config);
}
