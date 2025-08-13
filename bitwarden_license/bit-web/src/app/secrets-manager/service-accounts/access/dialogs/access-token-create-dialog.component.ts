// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { DialogRef, DIALOG_DATA, DialogService, BitValidators } from "@bitwarden/components";

import { ServiceAccountView } from "../../../models/view/service-account.view";
import { AccessTokenView } from "../../models/view/access-token.view";
import { AccessService } from "../access.service";

import { AccessTokenDetails, AccessTokenDialogComponent } from "./access-token-dialog.component";

export interface AccessTokenOperation {
  serviceAccountView: ServiceAccountView;
}

@Component({
  templateUrl: "./access-token-create-dialog.component.html",
  standalone: false,
})
export class AccessTokenCreateDialogComponent implements OnInit {
  protected formGroup = new FormGroup({
    name: new FormControl("", {
      validators: [Validators.required, Validators.maxLength(80), BitValidators.trimValidator],
      updateOn: "submit",
    }),
    expirationDateControl: new FormControl(null),
  });
  protected loading = false;

  expirationDayOptions = [7, 30, 60];

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: AccessTokenOperation,
    private dialogService: DialogService,
    private accessService: AccessService,
  ) {}

  async ngOnInit() {
    if (!this.data.serviceAccountView) {
      this.dialogRef.close();
      throw new Error(
        `The access token create dialog was not called with the appropriate operation values.`,
      );
    }
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const accessTokenView = new AccessTokenView();
    accessTokenView.name = this.formGroup.value.name;
    accessTokenView.expireAt = this.formGroup.value.expirationDateControl;
    const accessToken = await this.accessService.createAccessToken(
      this.data.serviceAccountView.organizationId,
      this.data.serviceAccountView.id,
      accessTokenView,
    );
    this.openAccessTokenDialog(
      this.data.serviceAccountView.name,
      accessToken,
      accessTokenView.expireAt,
    );
    this.dialogRef.close();
  };

  private openAccessTokenDialog(
    serviceAccountName: string,
    accessToken: string,
    expirationDate?: Date,
  ) {
    this.dialogService.open<unknown, AccessTokenDetails>(AccessTokenDialogComponent, {
      data: {
        subTitle: serviceAccountName,
        expirationDate: expirationDate,
        accessToken: accessToken,
      },
    });
  }

  static openNewAccessTokenDialog(
    dialogService: DialogService,
    serviceAccountView: ServiceAccountView,
  ) {
    return dialogService.open<unknown, AccessTokenOperation>(AccessTokenCreateDialogComponent, {
      data: {
        serviceAccountView,
      },
    });
  }
}
