// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, map } from "rxjs";

import {
  MemberCipherDetailsApiService,
  PasswordHealthService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeVariant,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  standalone: true,
  selector: "tools-password-health-members",
  templateUrl: "password-health-members.component.html",
  imports: [PipesModule, HeaderModule, SearchModule, FormsModule, SharedModule, TableModule],
  providers: [PasswordHealthService, MemberCipherDetailsApiService],
})
export class PasswordHealthMembersComponent implements OnInit {
  passwordStrengthMap = new Map<string, [string, BadgeVariant]>();

  passwordUseMap = new Map<string, number>();

  exposedPasswordMap = new Map<string, number>();

  totalMembersMap = new Map<string, number>();

  dataSource = new TableDataSource<CipherView>();

  loading = true;

  selectedIds: Set<number> = new Set<number>();

  protected searchControl = new FormControl("", { nonNullable: true });

  private destroyRef = inject(DestroyRef);

  constructor(
    protected cipherService: CipherService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected memberCipherDetailsApiService: MemberCipherDetailsApiService,
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
      this.memberCipherDetailsApiService,
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

  markAppsAsCritical = async () => {
    // TODO: Send to API once implemented
    return new Promise((resolve) => {
      setTimeout(() => {
        this.selectedIds.clear();
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("appsMarkedAsCritical"),
        });
        resolve(true);
      }, 1000);
    });
  };

  trackByFunction(_: number, item: CipherView) {
    return item.id;
  }

  onCheckboxChange(id: number, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }
}
