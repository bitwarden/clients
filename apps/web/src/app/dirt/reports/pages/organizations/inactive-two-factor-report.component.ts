// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, takeUntil, tap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BerryComponent,
  ChipActionComponent,
  ChipFilterComponent,
  DialogService,
} from "@bitwarden/components";
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
  imports: [
    SharedModule,
    HeaderModule,
    OrganizationBadgeModule,
    PipesModule,
    ChipFilterComponent,
    ChipActionComponent,
    BerryComponent,
  ],
})
export class InactiveTwoFactorReportComponent
  extends BaseInactiveTwoFactorReportComponent
  implements OnInit
{
  private manageableCipherIds = new Set<string>();
  private sharedCollectionIds = new Set<string>();

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
    private collectionService: CollectionService,
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
          const manageableCiphers = await this.cipherService.getAll(userId);
          this.manageableCipherIds = new Set(manageableCiphers.map((c) => c.id));
          const collections = await firstValueFrom(
            this.collectionService.decryptedCollections$(userId),
          );
          this.sharedCollectionIds = new Set(
            collections
              .filter((c) => !c.isDefaultCollection && c.organizationId === this.organization?.id)
              .map((c) => c.id as string),
          );
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
    if (
      CipherViewLikeUtils.isUnassigned(c) ||
      !c.collectionIds?.some((id) => this.sharedCollectionIds.has(id))
    ) {
      return false;
    }
    if (this.organization?.allowAdminAccessToAllCollectionItems) {
      return true;
    }
    return this.manageableCipherIds.has(c.id);
  }
}
