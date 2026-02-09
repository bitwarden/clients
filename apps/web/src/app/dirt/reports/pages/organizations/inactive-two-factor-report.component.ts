import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, takeUntil, tap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ChipSelectComponent, DialogService } from "@bitwarden/components";
import {
  CipherFormConfigService,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
} from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { SharedModule } from "../../../../shared";
import { OrganizationBadgeModule } from "../../../../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../../../vault/individual-vault/pipes/pipes.module";
import { AdminConsoleCipherFormConfigService } from "../../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { InactiveTwoFactorReportComponent as BaseInactiveTwoFactorReportComponent } from "../inactive-two-factor-report.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-inactive-two-factor-report",
  templateUrl: "../inactive-two-factor-report.component.html",
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: AdminConsoleCipherFormConfigService,
    },
    AdminConsoleCipherFormConfigService,
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
  ],
  imports: [SharedModule, HeaderModule, OrganizationBadgeModule, PipesModule, ChipSelectComponent],
})
export class InactiveTwoFactorReportComponent
  extends BaseInactiveTwoFactorReportComponent
  implements OnInit
{
  // Contains a list of ciphers, the user running the report, can manage
  private manageableCiphers: Cipher[] = [];

  constructor(
    cipherService: CipherService,
    dialogService: DialogService,
    private route: ActivatedRoute,
    logService: LogService,
    passwordRepromptService: PasswordRepromptService,
    organizationService: OrganizationService,
    accountService: AccountService,
    i18nService: I18nService,
    syncService: SyncService,
    cipherFormConfigService: CipherFormConfigService,
    adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
    protected changeDetectorRef: ChangeDetectorRef,
  ) {
    super(
      cipherService,
      organizationService,
      dialogService,
      accountService,
      logService,
      passwordRepromptService,
      i18nService,
      syncService,
      cipherFormConfigService,
      adminConsoleCipherFormConfigService,
      changeDetectorRef,
    );
  }

  async ngOnInit() {
    this.isAdminConsoleActive = true;

    this.route.parent?.parent?.params
      .pipe(
        tap(async (params) => {
          const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
          this.organization = await firstValueFrom(
            this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
          );
          this.manageableCiphers = await this.cipherService.getAll(userId);
          await super.ngOnInit();
          this.changeDetectorRef.markForCheck();
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe();
  }

  async getAllCiphers(): Promise<CipherView[]> {
    if (this.organization) {
      return this.cipherService.getAllFromApiForOrganization(this.organization.id, true);
    }
    return [];
  }

  protected canManageCipher(c: CipherView): boolean {
    if (c.collectionIds.length === 0) {
      return true;
    }
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}
