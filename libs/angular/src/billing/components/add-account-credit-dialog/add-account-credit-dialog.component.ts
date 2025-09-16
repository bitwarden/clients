// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ElementRef, Inject, OnInit, ViewChild } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService, AccountInfo } from "@bitwarden/common/auth/abstractions/account.service";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { BitPayInvoiceRequest } from "@bitwarden/common/billing/models/request/bit-pay-invoice.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";

export type AddAccountCreditDialogParams = {
  organizationId?: string;
  providerId?: string;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AddAccountCreditDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

export const openAddAccountCreditDialog = (
  dialogService: DialogService,
  dialogConfig: DialogConfig<AddAccountCreditDialogParams>,
) =>
  dialogService.open<AddAccountCreditDialogResultType, AddAccountCreditDialogParams>(
    AddAccountCreditDialogComponent,
    dialogConfig,
  );

type PayPalConfig = {
  businessId?: string;
  buttonAction?: string;
  returnUrl?: string;
  customField?: string;
  subject?: string;
};

@Component({
  templateUrl: "./add-account-credit-dialog.component.html",
  standalone: false,
})
export class AddAccountCreditDialogComponent implements OnInit {
  @ViewChild("payPalForm", { read: ElementRef, static: true }) payPalForm: ElementRef;
  protected formGroup = new FormGroup({
    paymentMethod: new FormControl<PaymentMethodType>(PaymentMethodType.PayPal),
    creditAmount: new FormControl<number>(null, [Validators.required, Validators.min(0.01)]),
  });
  protected payPalConfig: PayPalConfig;
  protected ResultType = AddAccountCreditDialogResultType;

  private organization?: Organization;
  private provider?: Provider;
  private user?: { id: UserId } & AccountInfo;

  constructor(
    private accountService: AccountService,
    private apiService: ApiService,
    private configService: ConfigService,
    @Inject(DIALOG_DATA) private dialogParams: AddAccountCreditDialogParams,
    private dialogRef: DialogRef<AddAccountCreditDialogResultType>,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private providerService: ProviderService,
  ) {
    this.payPalConfig = process.env.PAYPAL_CONFIG as PayPalConfig;
  }

  protected readonly paymentMethodType = PaymentMethodType;

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    if (this.formGroup.value.paymentMethod === PaymentMethodType.PayPal) {
      this.payPalForm.nativeElement.submit();
      return;
    }

    if (this.formGroup.value.paymentMethod === PaymentMethodType.BitPay) {
      const request = this.getBitPayInvoiceRequest();
      const bitPayUrl = await this.apiService.postBitPayInvoice(request);
      this.platformUtilsService.launchUri(bitPayUrl);
      return;
    }

    this.dialogRef.close(AddAccountCreditDialogResultType.Submitted);
  };

  async ngOnInit(): Promise<void> {
    let payPalCustomField: string;

    if (this.dialogParams.organizationId) {
      this.formGroup.patchValue({
        creditAmount: 20.0,
      });
      this.user = await firstValueFrom(this.accountService.activeAccount$);
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(this.user.id)
          .pipe(
            map((organizations) =>
              organizations.find((org) => org.id === this.dialogParams.organizationId),
            ),
          ),
      );
      payPalCustomField = "organization_id:" + this.organization.id;
      this.payPalConfig.subject = this.organization.name;
    } else if (this.dialogParams.providerId) {
      this.formGroup.patchValue({
        creditAmount: 20.0,
      });
      this.provider = await firstValueFrom(
        this.providerService.get$(this.dialogParams.providerId, this.user.id),
      );
      payPalCustomField = "provider_id:" + this.provider.id;
      this.payPalConfig.subject = this.provider.name;
    } else {
      this.formGroup.patchValue({
        creditAmount: 10.0,
      });
      payPalCustomField = "user_id:" + this.user.id;
      this.payPalConfig.subject = this.user.email;
    }

    const region = await firstValueFrom(this.configService.cloudRegion$);

    payPalCustomField += ",account_credit:1";
    payPalCustomField += `,region:${region}`;

    this.payPalConfig.customField = payPalCustomField;
    this.payPalConfig.returnUrl = window.location.href;
  }

  getBitPayInvoiceRequest(): BitPayInvoiceRequest {
    const request = new BitPayInvoiceRequest();
    if (this.organization) {
      request.name = this.organization.name;
      request.organizationId = this.organization.id;
    } else if (this.provider) {
      request.name = this.provider.name;
      request.providerId = this.provider.id;
    } else {
      request.email = this.user.email;
      request.userId = this.user.id;
    }

    request.credit = true;
    request.amount = this.formGroup.value.creditAmount;
    request.returnUrl = window.location.href;

    return request;
  }
}
