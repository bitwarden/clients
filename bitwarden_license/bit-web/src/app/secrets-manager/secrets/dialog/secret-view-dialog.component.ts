import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";

import { SecretService } from "../secret.service";

export interface SecretViewDialogParams {
  organizationId: string;
  secretId: string;
}

@Component({
  templateUrl: "./secret-view-dialog.component.html",
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
