import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { lastValueFrom, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PasskeyDirectoryApiService } from "@bitwarden/common/dirt/services/abstractions/passkey-directory-api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  CalloutModule,
  ChipSelectComponent,
  ContainerComponent,
  DialogService,
  LinkModule,
  TableDataSource,
  TableModule,
  ToggleGroupModule,
} from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormConfigService,
  GetOrgNameFromIdPipe,
  OrganizationNameBadgeComponent,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { HeaderModule } from "../../../layouts/header/header.module";
import {
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "../../../vault/components/vault-item-dialog/vault-item-dialog.component";

import {
  PasskeyCipherRow,
  PasskeyReportAction,
  PasskeyReportService,
  PasskeyServiceEntry,
} from "./passkey-report.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-passkey-report",
  templateUrl: "passkey-report.component.html",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    HeaderModule,
    BadgeModule,
    CalloutModule,
    ChipSelectComponent,
    ContainerComponent,
    LinkModule,
    TableModule,
    ToggleGroupModule,
    GetOrgNameFromIdPipe,
    OrganizationNameBadgeComponent,
  ],
  providers: [PasskeyReportService],
})
export class PasskeyReportComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly cipherFormConfigService = inject(CipherFormConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly organizationService = inject(OrganizationService);
  private readonly passkeyDirectoryApiService = inject(PasskeyDirectoryApiService);
  private readonly passkeyReportService = inject(PasskeyReportService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly syncService = inject(SyncService);

  // Reactive state
  protected readonly loading = signal(false);
  protected readonly hasLoaded = signal(false);
  protected readonly ciphers = signal<PasskeyCipherRow[]>([]);
  protected readonly allCiphers = signal<PasskeyCipherRow[]>([]);
  protected readonly dataSource = new TableDataSource<PasskeyCipherRow>();

  // Filter state
  protected readonly filterStatus = signal<(number | string)[]>([0]);
  protected readonly showFilterToggle = signal(false);
  protected readonly vaultMsg = signal("vault");
  protected readonly chipSelectOptions = signal<{ label: string; value: string }[]>([]);
  protected readonly selectedFilterChip = "0";
  private readonly maxItemsToSwitchToChipSelect = 5;

  // Organization state
  protected readonly organizations = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
    ),
  );

  private readonly userIdNullable = toSignal(this.accountService.activeAccount$.pipe(getUserId));
  private readonly userId = computed(() => this.userIdNullable() as UserId);

  protected readonly currentFilterStatus = signal<number | string>(0);
  private readonly passkeyServices = signal<Map<string, PasskeyServiceEntry>>(new Map());

  constructor() {
    void this.init();
  }

  async setCiphers() {
    await this.loadPasskeyDirectory();
    if (this.passkeyServices().size === 0) {
      return;
    }

    const allCiphers = await this.cipherService.getAllDecrypted(this.userId());
    const rows = this.passkeyReportService.processCiphers(allCiphers, this.passkeyServices());

    this.filterStatus.set([0]);
    this.filterCiphersByOrg(rows);
  }

  protected async selectCipher(cipher: CipherView) {
    if (
      cipher.reprompt !== CipherRepromptType.None &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    const formConfig = await this.cipherFormConfigService.buildConfig(
      "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openVaultItemDialog("view", formConfig, cipher);
  }

  protected canManageCipher(_: CipherView): boolean {
    return true;
  }

  protected canDisplayToggleGroup(): boolean {
    return this.filterStatus().length <= this.maxItemsToSwitchToChipSelect;
  }

  protected getName(filterId: string | number): string {
    if (filterId === 0) {
      return this.i18nService.t("all");
    }
    if (filterId === 1) {
      return this.i18nService.t("me");
    }

    return this.organizations()?.find((org) => org.id === filterId)?.name ?? "";
  }

  protected getCount(filterId: string | number): number {
    if (filterId === 0) {
      return this.allCiphers().length;
    }
    if (filterId === 1) {
      return this.allCiphers().filter((r) => !r.cipher.organizationId).length;
    }
    return this.allCiphers().filter((r) => r.cipher.organizationId === filterId).length;
  }

  protected async filterOrgToggle(status: number | string) {
    this.currentFilterStatus.set(status);
    if (typeof status === "number" && status === 1) {
      this.dataSource.filter = (r: PasskeyCipherRow) => !r.cipher.organizationId;
    } else if (typeof status === "string") {
      const orgId = status as OrganizationId;
      this.dataSource.filter = (r: PasskeyCipherRow) => r.cipher.organizationId === orgId;
    } else {
      this.dataSource.filter = () => true;
    }
  }

  protected async filterOrgToggleChipSelect(filterId: string | null) {
    await this.filterOrgToggle(filterId ?? 0);
  }

  private async init() {
    this.loading.set(true);
    await this.syncService.fullSync(false);

    if (this.currentFilterStatus()) {
      if (this.ciphers().length > 2) {
        await this.filterOrgToggle(this.currentFilterStatus());
      } else {
        await this.filterOrgToggle(0);
      }
    } else {
      await this.setCiphers();
    }

    this.loading.set(false);
    this.hasLoaded.set(true);
  }

  private async loadPasskeyDirectory() {
    if (this.passkeyServices().size > 0) {
      return;
    }

    try {
      const entries = (await this.passkeyDirectoryApiService.getPasskeyDirectory(this.userId()))
        .filter((x) => x.domainName != null)
        .reduce(
          (map, entry) => map.set(entry.domainName, entry),
          new Map<string, PasskeyServiceEntry>(),
        );

      this.passkeyServices.set(entries);
    } catch (e) {
      this.logService.error("[PasskeyReportComponent] Failed to load passkeys", e);
    }
  }

  private async openVaultItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
    cipher: CipherView,
    activeCollectionId?: CollectionId,
  ) {
    const dialogRef = VaultItemDialogComponent.open(this.dialogService, {
      mode,
      formConfig,
      activeCollectionId,
      isAdminConsoleAction: false,
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result === VaultItemDialogResult.PremiumUpgrade) {
      return;
    }

    if (result === VaultItemDialogResult.Deleted || result === VaultItemDialogResult.Saved) {
      await this.refresh(result, cipher);
    }
  }

  private async refresh(result: VaultItemDialogResult, cipher: CipherView) {
    let updatedCipherView: CipherView | undefined;
    const action: PasskeyReportAction =
      result === VaultItemDialogResult.Deleted ? "deleted" : "saved";

    if (action === "saved") {
      const userId = this.userId();
      const updatedCipher = await this.cipherService.get(cipher.id, userId);
      updatedCipherView = await updatedCipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(updatedCipher, userId),
      );
    }

    const updatedRows = this.passkeyReportService.applyDialogResult(
      this.ciphers(),
      action,
      cipher,
      this.passkeyServices(),
      updatedCipherView,
    );

    this.filterCiphersByOrg(updatedRows);
  }

  private filterCiphersByOrg(rows: PasskeyCipherRow[]) {
    const statuses: (number | string)[] = [0];

    for (const row of rows) {
      if (row.cipher.organizationId != null && !statuses.includes(row.cipher.organizationId)) {
        statuses.push(row.cipher.organizationId);
      } else if (row.cipher.organizationId == null && !statuses.includes(1)) {
        statuses.splice(1, 0, 1);
      }
    }

    this.ciphers.set(rows);
    this.allCiphers.set([...rows]);
    this.dataSource.data = rows;
    this.filterStatus.set(statuses);

    if (statuses.length > 2) {
      this.showFilterToggle.set(true);
      this.vaultMsg.set("vaults");
    } else {
      this.showFilterToggle.set(false);
      this.vaultMsg.set("vault");
    }

    this.chipSelectOptions.set(this.setupChipSelectOptions(statuses));
  }

  private setupChipSelectOptions(filters: (number | string)[]): { label: string; value: string }[] {
    return filters.map((filterId) => {
      const name = this.getName(filterId);
      const count = this.getCount(filterId);
      const labelSuffix = count != null ? ` (${count})` : "";

      return {
        label: name + labelSuffix,
        value: String(filterId),
      };
    });
  }
}
