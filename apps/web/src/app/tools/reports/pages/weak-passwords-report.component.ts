// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant, DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

type ReportScore = { label: string; badgeVariant: BadgeVariant };
type ReportResult = CipherView & { score: number; reportValue: ReportScore };

@Component({
  selector: "app-weak-passwords-report",
  templateUrl: "weak-passwords-report.component.html",
})
export class WeakPasswordsReportComponent extends CipherReportComponent implements OnInit {
  disabled = true;

  weakPasswordCiphers: ReportResult[] = [];

  constructor(
    protected cipherService: CipherService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected organizationService: OrganizationService,
    dialogService: DialogService,
    protected accountService: AccountService,
    passwordRepromptService: PasswordRepromptService,
    i18nService: I18nService,
    syncService: SyncService,
    cipherFormConfigService: CipherFormConfigService,
    adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
  ) {
    super(
      cipherService,
      dialogService,
      passwordRepromptService,
      organizationService,
      accountService,
      i18nService,
      syncService,
      cipherFormConfigService,
      adminConsoleCipherFormConfigService,
    );
  }

  async ngOnInit() {
    await super.load();
  }

  async setCiphers() {
    const allCiphers = await this.getAllCiphers();
    this.weakPasswordCiphers = [];
    this.filterStatus = [0];
    this.findWeakPasswords(allCiphers);
  }

  protected findWeakPasswords(ciphers: CipherView[]): void {
    ciphers.forEach((ciph) => {
      const { type, login, isDeleted, edit, viewPassword } = ciph;
      if (
        type !== CipherType.Login ||
        login.password == null ||
        login.password === "" ||
        isDeleted ||
        (!this.organization && !edit) ||
        !viewPassword
      ) {
        return;
      }

      const hasUserName = this.isUserNameNotEmpty(ciph);
      let userInput: string[] = [];
      if (hasUserName) {
        const atPosition = login.username.indexOf("@");
        if (atPosition > -1) {
          userInput = userInput
            .concat(
              login.username
                .substr(0, atPosition)
                .trim()
                .toLowerCase()
                .split(/[^A-Za-z0-9]/),
            )
            .filter((i) => i.length >= 3);
        } else {
          userInput = login.username
            .trim()
            .toLowerCase()
            .split(/[^A-Za-z0-9]/)
            .filter((i) => i.length >= 3);
        }
      }
      const result = this.passwordStrengthService.getPasswordStrength(
        login.password,
        null,
        userInput.length > 0 ? userInput : null,
      );

      if (result.score != null && result.score <= 2) {
        const scoreValue = this.scoreKey(result.score);
        const row = { ...ciph, score: result.score, reportValue: scoreValue } as ReportResult;
        this.weakPasswordCiphers.push(row);
      }
    });
    this.filterCiphersByOrg(this.weakPasswordCiphers);
  }

  protected canManageCipher(c: CipherView): boolean {
    // this will only ever be false from the org view;
    return true;
  }

  private isUserNameNotEmpty(c: CipherView): boolean {
    return !Utils.isNullOrWhitespace(c.login.username);
  }

  private scoreKey(score: number): ReportScore {
    switch (score) {
      case 4:
        return { label: "strong", badgeVariant: "success" };
      case 3:
        return { label: "good", badgeVariant: "primary" };
      case 2:
        return { label: "weak", badgeVariant: "warning" };
      default:
        return { label: "veryWeak", badgeVariant: "danger" };
    }
  }
}
