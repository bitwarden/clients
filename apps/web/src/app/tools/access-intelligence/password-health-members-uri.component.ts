import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { from, map, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  BadgeVariant,
  ContainerComponent,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

// eslint-disable-next-line no-restricted-imports
import { HeaderModule } from "../../layouts/header/header.module";
// eslint-disable-next-line no-restricted-imports
import { OrganizationBadgeModule } from "../../vault/individual-vault/organization-badge/organization-badge.module";
// eslint-disable-next-line no-restricted-imports
import { PipesModule } from "../../vault/individual-vault/pipes/pipes.module";

@Component({
  standalone: true,
  selector: "tools-password-health-members-uri",
  templateUrl: "password-health-members-uri.component.html",
  imports: [
    BadgeModule,
    OrganizationBadgeModule,
    CommonModule,
    ContainerComponent,
    PipesModule,
    JslibModule,
    HeaderModule,
    TableModule,
  ],
})
export class PasswordHealthMembersURIComponent implements OnInit {
  passwordStrengthMap = new Map<string, [string, BadgeVariant]>();

  weakPasswordCiphers: CipherView[] = [];

  passwordUseMap = new Map<string, number>();

  exposedPasswordMap = new Map<string, number>();

  dataSource = new TableDataSource<CipherView>();

  reportCiphers: (CipherView & { hostURI: string })[] = [];
  reportCipherURIs: string[] = [];

  organization: Organization;

  loading = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    protected cipherService: CipherService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected organizationService: OrganizationService,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((params) => params.get("organizationId")),
        switchMap((organizationId) => {
          return from(this.organizationService.get(organizationId));
        }),
        tap((organization) => {
          this.organization = organization;
        }),
        switchMap(() => from(this.setCiphers())),
      )
      .subscribe();
  }

  async setCiphers() {
    const allCiphers = await this.cipherService.getAllFromApiForOrganization(this.organization.id);
    // const allCiphers = cipherData;
    allCiphers.forEach(async (cipher) => {
      this.findWeakPassword(cipher);
      this.findReusedPassword(cipher);
      await this.findExposedPassword(cipher);
    });
    this.dataSource.data = this.reportCiphers;
    this.loading = false;

    // const reportIssues = allCiphers.map((c) => {
    //   if (this.passwordStrengthMap.has(c.id)) {
    //     return c;
    //   }

    //   if (this.passwordUseMap.has(c.id)) {
    //     return c;
    //   }

    //   if (this.exposedPasswordMap.has(c.id)) {
    //     return c;
    //   }
    // });
  }

  protected checkForExistingCipher(ciph: CipherView) {
    ciph.trimmedURIs.forEach((uri: string) => {
      if (!this.reportCipherURIs.includes(uri)) {
        this.reportCiphers.push({ ...ciph, hostURI: uri } as CipherView & { hostURI: string });
      }
    });
  }

  protected async findExposedPassword(cipher: CipherView) {
    const { type, login, isDeleted, edit, viewPassword, id } = cipher;
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

    const exposedCount = await this.auditService.passwordLeaked(login.password);
    if (exposedCount > 0) {
      this.exposedPasswordMap.set(id, exposedCount);
      this.checkForExistingCipher(cipher);
    }
  }

  protected findReusedPassword(cipher: CipherView) {
    const { type, login, isDeleted, edit, viewPassword } = cipher;
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

    if (this.passwordUseMap.has(login.password)) {
      this.passwordUseMap.set(login.password, this.passwordUseMap.get(login.password) || 0 + 1);
    } else {
      this.passwordUseMap.set(login.password, 1);
    }

    this.checkForExistingCipher(cipher);
  }

  protected findWeakPassword(cipher: CipherView): void {
    const { type, login, isDeleted, edit, viewPassword } = cipher;
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

    const hasUserName = this.isUserNameNotEmpty(cipher);
    let userInput: string[] = [];
    if (hasUserName) {
      const atPosition = login.username.indexOf("@");
      if (atPosition > -1) {
        userInput = userInput
          .concat(
            login.username
              .substring(0, atPosition)
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
    const { score } = this.passwordStrengthService.getPasswordStrength(
      login.password,
      null,
      userInput.length > 0 ? userInput : null,
    );

    if (score != null && score <= 2) {
      this.passwordStrengthMap.set(cipher.id, this.scoreKey(score));
      this.checkForExistingCipher(cipher);
    }
  }

  private isUserNameNotEmpty(c: CipherView): boolean {
    return !Utils.isNullOrWhitespace(c.login.username);
  }

  private scoreKey(score: number): [string, BadgeVariant] {
    switch (score) {
      case 4:
        return ["strong", "success"];
      case 3:
        return ["good", "primary"];
      case 2:
        return ["weak", "warning"];
      default:
        return ["veryWeak", "danger"];
    }
  }
}
