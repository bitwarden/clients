import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";

import { DIALOG_DATA } from "@bitwarden/components";

import { SecretService } from "../secret.service";

export interface SecretViewDialogParams {
  organizationId: string;
  secretId: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./secret-view-dialog.component.html",
  standalone: false,
})
export class SecretViewDialogComponent implements OnInit {
  protected loading = true;
  protected formGroup = new FormGroup({
    name: new FormControl(""),
    value: new FormControl(""),
    notes: new FormControl(""),
  });

  constructor(
    private secretService: SecretService,
    @Inject(DIALOG_DATA) private params: SecretViewDialogParams,
  ) {}

  async ngOnInit() {
    this.loading = true;
    const secret = await this.secretService.getBySecretId(this.params.secretId);
    this.formGroup.setValue({
      name: secret.name,
      value: secret.value,
      notes: secret.note,
    });
    this.formGroup.disable();
    this.loading = false;
  }
}
