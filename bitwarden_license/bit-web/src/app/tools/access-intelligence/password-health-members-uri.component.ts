// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  MemberCipherDetailsApiService,
  PasswordHealthService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  BadgeVariant,
  ContainerComponent,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  standalone: true,
  selector: "tools-password-health-members-uri",
  templateUrl: "password-health-members-uri.component.html",
  imports: [
    BadgeModule,
    CommonModule,
    ContainerComponent,
    PipesModule,
    JslibModule,
    HeaderModule,
    TableModule,
  ],
  providers: [PasswordHealthService, MemberCipherDetailsApiService],
})
export class PasswordHealthMembersURIComponent implements OnInit {
  passwordStrengthMap = new Map<string, [string, BadgeVariant]>();

  weakPasswordCiphers: CipherView[] = [];

  passwordUseMap = new Map<string, number>();

  exposedPasswordMap = new Map<string, number>();

  totalMembersMap = new Map<string, number>();

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
    protected memberCipherDetailsApiService: MemberCipherDetailsApiService,
  ) {}

  ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(async (params) => {
          const organizationId = params.get("organizationId");
          await this.setCiphers(organizationId);
        }),
      )
      .subscribe();
  }

  async setCiphers(organizationId: string) {
    const passwordHealthService = new PasswordHealthService(
      this.passwordStrengthService,
      this.auditService,
      this.cipherService,
      this.memberCipherDetailsApiService,
      organizationId,
    );

    await passwordHealthService.generateReport();

    this.dataSource.data = passwordHealthService.groupCiphersByLoginUri();
    this.exposedPasswordMap = passwordHealthService.exposedPasswordMap;
    this.passwordStrengthMap = passwordHealthService.passwordStrengthMap;
    this.passwordUseMap = passwordHealthService.passwordUseMap;
    this.totalMembersMap = passwordHealthService.totalMembersMap;
    this.loading = false;
  }
}
