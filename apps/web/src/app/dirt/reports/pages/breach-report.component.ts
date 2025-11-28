// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BreachAccountResponse } from "@bitwarden/common/dirt/models/response/breach-account.response";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-breach-report",
  templateUrl: "breach-report.component.html",
  standalone: false,
})
export class BreachReportComponent implements OnInit {
  loading = false;
  error = false;
  checkedUsername: string;
  breachedAccounts: BreachAccountResponse[] = [];
  formGroup = this.formBuilder.group({
    username: ["", { validators: [Validators.required], updateOn: "change" }],
  });

  constructor(
    private auditService: AuditService,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
  ) {}

  async ngOnInit() {
    this.formGroup
      .get("username")
      .setValue(
        await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.email))),
      );
  }

  submit = async () => {
    this.formGroup.markAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    this.error = false;
    this.loading = true;
    const username = this.formGroup.value.username.toLowerCase();
    try {
      this.breachedAccounts = await this.auditService.breachedAccounts(username);
    } catch {
      this.error = true;
    } finally {
      this.loading = false;
    }

    this.checkedUsername = username;
  };
}
