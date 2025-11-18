import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map, takeUntil } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { RoutedVaultFilterBridgeService } from "../../../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
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
  standalone: false,
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
      ?.pipe(takeUntil(this.destroyed$))
      // eslint-disable-next-line rxjs/no-async-subscribe
      .subscribe(async (params) => {
        const userId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(map((a) => a?.id)),
        );

        if (userId) {
          this.organization = await firstValueFrom(
            this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
          );
          this.manageableCiphers = await this.cipherService.getAll(userId);
          await super.ngOnInit();
        }
        this.changeDetectorRef.markForCheck();
      });
  }

  async getAllCiphers(): Promise<CipherView[]> {
    const baseCiphers = await super.getAllCiphers();
    let orgCiphers: CipherView[] = [];
    if (this.organization) {
      orgCiphers =
        (await this.cipherService.getAllFromApiForOrganization(this.organization.id, true)) ?? [];
    }

    // super.getallCiphers() gets ciphers the user has access to via collections
    // getAllFromApiForOrganization gets all org ciphers
    // Merge the two lists, removing duplicates
    const cipherMap = new Map<string, CipherView>();
    [...baseCiphers, ...orgCiphers].forEach((cipher) => cipherMap.set(cipher.id, cipher));
    return Array.from(cipherMap.values());
  }

  protected canManageCipher(c: CipherView): boolean {
    if (c.collectionIds.length === 0) {
      return true;
    }
    return this.manageableCiphers.some((x) => x.id === c.id);
  }
}
