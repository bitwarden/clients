import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, map } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { PasswordHealthService } from "@bitwarden/bit-common/tools/reports/access-intelligence";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant, SearchModule, TableDataSource, TableModule } from "@bitwarden/components";
import { CardComponent } from "@bitwarden/tools-card";

import { HeaderModule } from "../../layouts/header/header.module";
// eslint-disable-next-line no-restricted-imports
import { SharedModule } from "../../shared";
import { OrganizationBadgeModule } from "../../vault/individual-vault/organization-badge/organization-badge.module";
// eslint-disable-next-line no-restricted-imports
import { PipesModule } from "../../vault/individual-vault/pipes/pipes.module";

import { NoPriorityAppsComponent } from "./no-priority-apps.component";

@Component({
  standalone: true,
  selector: "tools-password-health-members",
  templateUrl: "password-health-members.component.html",
  imports: [
    CardComponent,
    OrganizationBadgeModule,
    PipesModule,
    HeaderModule,
    SearchModule,
    FormsModule,
    NoPriorityAppsComponent,
    SharedModule,
    TableModule,
  ],
  providers: [PasswordHealthService],
})
export class PasswordHealthMembersComponent implements OnInit {
  passwordStrengthMap = new Map<string, [string, BadgeVariant]>();

  passwordUseMap = new Map<string, number>();

  exposedPasswordMap = new Map<string, number>();

  totalMembersMap = new Map<string, number>();

  dataSource = new TableDataSource<CipherView>();

  loading = true;

  protected searchControl = new FormControl("", { nonNullable: true });

  private destroyRef = inject(DestroyRef);

  constructor(
    protected cipherService: CipherService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

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
      organizationId,
    );

    await passwordHealthService.generateReport();

    this.dataSource.data = passwordHealthService.reportCiphers;

    this.exposedPasswordMap = passwordHealthService.exposedPasswordMap;
    this.passwordStrengthMap = passwordHealthService.passwordStrengthMap;
    this.passwordUseMap = passwordHealthService.passwordUseMap;
    this.totalMembersMap = passwordHealthService.totalMembersMap;
    this.loading = false;
  }
}
