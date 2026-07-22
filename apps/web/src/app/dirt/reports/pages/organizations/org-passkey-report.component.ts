import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { filter, lastValueFrom, shareReplay, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { CipherId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  CalloutComponent,
  ContainerComponent,
  DialogService,
  IconComponent,
  LinkComponent,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormConfigService,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { AdminConsoleCipherFormConfigService } from "../../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import {
  PasskeyCipherRow,
  PasskeyReportAction,
  PasskeyReportService,
  PasskeyServiceEntry,
} from "../passkey-report.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-org-passkey-report",
  templateUrl: "org-passkey-report.component.html",
  standalone: true,
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: AdminConsoleCipherFormConfigService,
    },
    AdminConsoleCipherFormConfigService,
    RoutedVaultFilterService,
    RoutedVaultFilterBridgeService,
    PasskeyReportService,
  ],
  imports: [
    CommonModule,
    JslibModule,
    HeaderModule,
    CalloutComponent,
    ContainerComponent,
    IconComponent,
    LinkComponent,
    TableModule,
    BadgeComponent,
  ],
})
export class OrgPasskeyReportComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);
  private readonly passkeyReportService = inject(PasskeyReportService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly syncService = inject(SyncService);
  private readonly adminConsoleCipherFormConfigService = inject(
    AdminConsoleCipherFormConfigService,
  );

  // Reactive state
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly ciphers = signal<PasskeyCipherRow[]>([]);
  protected readonly dataSource = new TableDataSource<PasskeyCipherRow>();

  // Private state
  private readonly userId = toSignal(this.accountService.activeAccount$.pipe(getUserId), {
    requireSync: true,
  });

  private readonly orgAndCiphers = toSignal(
    this.route.params.pipe(
      switchMap((params) =>
        this.organizationService.organizations$(this.userId()).pipe(
          getById(params.organizationId),
          filter((org): org is Organization => org != null),
          switchMap((org) =>
            this.cipherService
              .getAll(this.userId())
              .then((ciphers) => ({ organization: org, ciphers })),
          ),
        ),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    ),
  );
  private readonly organization = computed(() => this.orgAndCiphers()?.organization);
  private readonly manageableCiphers = computed(() => this.orgAndCiphers()?.ciphers ?? []);

  private readonly passkeyServices = signal<Map<string, PasskeyServiceEntry>>(new Map());

  constructor() {
    effect(() => {
      const organization = this.organization();

      if (organization == null) {
        return;
      }

      untracked(() => {
        void this.load(organization);
      });
    });
  }

  protected async selectCipher(cipher: CipherView) {
    if (
      cipher.reprompt !== CipherRepromptType.None &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    const formConfig = await this.adminConsoleCipherFormConfigService.buildConfig(
      "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    await this.openVaultItemDialog("view", formConfig, cipher);
  }

  protected canManageCipher(c: CipherView): boolean {
    if (c.collectionIds.length === 0) {
      return true;
    }
    if (this.organization()?.allowAdminAccessToAllCollectionItems) {
      return true;
    }
    return this.manageableCiphers().some((x) => x.id === c.id);
  }

  private async load(org: Organization) {
    this.loading.set(true);
    this.error.set(false);
    try {
      await this.syncService.fullSync(false);
      await this.setCiphers(org);
    } catch (e) {
      this.logService.error("[OrgPasskeyReportComponent] Failed to load report", e);
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async setCiphers(org: Organization) {
    await this.loadPasskeyDirectory();
    if (this.passkeyServices().size === 0) {
      return;
    }

    const allCiphers = await this.cipherService.getAllFromApiForOrganization(org.id, true);
    const rows = this.passkeyReportService.processCiphers(allCiphers, this.passkeyServices());

    this.ciphers.set(rows);
    this.dataSource.data = rows;
  }

  private async loadPasskeyDirectory() {
    if (this.passkeyServices().size > 0) {
      return;
    }

    const entries = await this.passkeyReportService.loadPasskeyDirectory(this.userId());
    this.passkeyServices.set(entries);
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
      isAdminConsoleAction: true,
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
    const org = this.organization();
    if (org == null) {
      return;
    }

    let updatedCipherView: CipherView | undefined;
    const action: PasskeyReportAction =
      result === VaultItemDialogResult.Deleted ? "deleted" : "saved";

    if (action === "saved") {
      const updatedCipher =
        (await this.adminConsoleCipherFormConfigService.getCipher(cipher.id as CipherId, org)) ??
        (await this.cipherService.get(cipher.id, this.userId()));

      updatedCipherView = await updatedCipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(updatedCipher, this.userId()),
      );
    }

    const updatedRows = this.passkeyReportService.applyDialogResult(
      this.ciphers(),
      action,
      cipher,
      this.passkeyServices(),
      updatedCipherView,
    );

    this.ciphers.set(updatedRows);
    this.dataSource.data = updatedRows;
  }
}
