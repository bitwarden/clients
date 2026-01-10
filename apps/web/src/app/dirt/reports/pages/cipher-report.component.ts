import { Directive, OnDestroy } from "@angular/core";
import {
  BehaviorSubject,
  lastValueFrom,
  Observable,
  Subject,
  firstValueFrom,
  switchMap,
  takeUntil,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, TableDataSource, DialogService } from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormConfigService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import {
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "../../../vault/components/vault-item-dialog/vault-item-dialog.component";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

@Directive()
export abstract class CipherReportComponent implements OnDestroy {
  isAdminConsoleActive = false;

  loading = false;
  hasLoaded = false;
  ciphers: CipherView[] = [];
  allCiphers: CipherView[] = [];
  dataSource = new TableDataSource<CipherView>();
  organization: Organization | undefined = undefined;
  organizations: Organization[] = [];
  organizations$: Observable<Organization[]>;

  filterStatus: any = [0];
  showFilterToggle: boolean = false;
  vaultMsg: string = "vault";
  currentFilterStatus: number | string = 0;
  protected filterOrgStatus$ = new BehaviorSubject<number | string>(0);
  protected destroyed$: Subject<void> = new Subject();
  private vaultItemDialogRef?: DialogRef<VaultItemDialogResult> | undefined;

  constructor(
    protected cipherService: CipherService,
    private dialogService: DialogService,
    protected passwordRepromptService: PasswordRepromptService,
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
    protected i18nService: I18nService,
    private syncService: SyncService,
    private cipherFormConfigService: CipherFormConfigService,
    protected adminConsoleCipherFormConfigService: AdminConsoleCipherFormConfigService,
  ) {
    this.organizations$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
    );

    this.organizations$.pipe(takeUntil(this.destroyed$)).subscribe((orgs) => {
      this.organizations = orgs;
    });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getName(filterId: string | number) {
    let orgName: any;

    if (filterId === 0) {
      orgName = this.i18nService.t("all");
    } else if (filterId === 1) {
      orgName = this.i18nService.t("me");
    } else {
      this.organizations.filter((org: Organization) => {
        if (org.id === filterId) {
          orgName = org.name;
          return org;
        }
      });
    }
    return orgName;
  }

  getCount(filterId: string | number) {
    let orgFilterStatus: any;
    let cipherCount;

    if (filterId === 0) {
      cipherCount = this.allCiphers.length;
    } else if (filterId === 1) {
      cipherCount = this.allCiphers.filter((c) => !c.organizationId).length;
    } else {
      this.organizations.filter((org: Organization) => {
        if (org.id === filterId) {
          orgFilterStatus = org.id;
          return org;
        }
      });
      cipherCount = this.allCiphers.filter((c) => c.organizationId === orgFilterStatus).length;
    }
    return cipherCount;
  }

  async filterOrgToggle(status: any) {
    let filter = (c: CipherView) => true;
    if (typeof status === "number" && status === 1) {
      filter = (c: CipherView) => !c.organizationId;
    } else if (typeof status === "string") {
      const orgId = status as OrganizationId;
      filter = (c: CipherView) => c.organizationId === orgId;
    }
    this.dataSource.filter = filter;
  }

  async load() {
    this.loading = true;
    await this.syncService.fullSync(false);
    // when a user fixes an item in a report we want to persist the filter they had
    // if they fix the last item of that filter we will go back to the "All" filter
    if (this.currentFilterStatus) {
      if (this.ciphers.length > 2) {
        this.filterOrgStatus$.next(this.currentFilterStatus);
        await this.filterOrgToggle(this.currentFilterStatus);
      } else {
        this.filterOrgStatus$.next(0);
        await this.filterOrgToggle(0);
      }
    } else {
      await this.setCiphers();
    }
    this.loading = false;
    this.hasLoaded = true;
  }
  async selectCipher(cipher: CipherView) {
    if (!(await this.repromptCipher(cipher))) {
      return;
    }

    if (this.organization) {
      const adminCipherFormConfig = await this.adminConsoleCipherFormConfigService.buildConfig(
        "edit",
        cipher.id as CipherId,
        cipher.type,
      );

      await this.openVaultItemDialog("view", adminCipherFormConfig, cipher);
    } else {
      const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
        "edit",
        cipher.id as CipherId,
        cipher.type,
      );
      await this.openVaultItemDialog("view", cipherFormConfig, cipher);
    }
  }

  /**
   * Open the combined view / edit dialog for a cipher.
   * @param mode - Starting mode of the dialog.
   * @param formConfig - Configuration for the form when editing/adding a cipher.
   * @param activeCollectionId - The active collection ID.
   */
  async openVaultItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
    cipher: CipherView,
    activeCollectionId?: CollectionId,
  ) {
    const disableForm = cipher ? !cipher.edit && !this.organization?.canEditAllCiphers : false;

    this.vaultItemDialogRef = VaultItemDialogComponent.open(this.dialogService, {
      mode,
      formConfig,
      activeCollectionId,
      disableForm,
    });

    const result = await lastValueFrom(this.vaultItemDialogRef.closed);
    this.vaultItemDialogRef = undefined;

    // When the dialog is closed for a premium upgrade, return early as the user
    // should be navigated to the subscription settings elsewhere
    if (result === VaultItemDialogResult.PremiumUpgrade) {
      return;
    }

    // If the dialog was closed by deleting the cipher, refresh the report.
    if (result === VaultItemDialogResult.Deleted || result === VaultItemDialogResult.Saved) {
      await this.refresh(result, cipher);
    }
  }

  protected async setCiphers() {
    this.allCiphers = [];
  }

  async refresh(result: VaultItemDialogResult, cipher: CipherView) {
    if (result === VaultItemDialogResult.Deleted) {
      // update downstream report status if the cipher was deleted
      await this.determinedUpdatedCipherReportStatus(result, cipher);

      // the cipher was deleted, filter it out from the report.
      this.ciphers = this.ciphers.filter((ciph) => ciph.id !== cipher.id);
      this.filterCiphersByOrg(this.ciphers);
      return;
    }

    if (result == VaultItemDialogResult.Saved) {
      // Ensure we have the latest cipher data after saving.
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      let updatedCipher = await this.cipherService.get(cipher.id, activeUserId);

      if (this.isAdminConsoleActive) {
        updatedCipher =
          (await this.adminConsoleCipherFormConfigService.getCipher(
            cipher.id as CipherId,
            this.organization!,
          )) ?? updatedCipher;
      }

      // convert cipher to cipher view model
      const updatedCipherView = await updatedCipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(updatedCipher, activeUserId),
      );

      // request downstream report status if the cipher was updated
      // this will return a null if the updated cipher does not meet the criteria for the report
      const updatedReportResult = await this.determinedUpdatedCipherReportStatus(
        result,
        updatedCipherView,
      );

      // determine the index of the updated cipher in the report
      const index = this.ciphers.findIndex((c) => c.id === updatedCipherView.id);

      // the updated cipher does not meet the criteria for the report, it returns a null
      if (updatedReportResult === null) {
        this.ciphers.splice(index, 1);
      }

      // the cipher is already in the report, update it.
      if (updatedReportResult !== null && index > -1) {
        this.ciphers[index] = updatedReportResult;
      }

      // apply filters and set the data source
      this.filterCiphersByOrg(this.ciphers);
    }
  }

  async determinedUpdatedCipherReportStatus(
    result: VaultItemDialogResult,
    updatedCipherView: CipherView,
  ): Promise<CipherView | null> {
    // Implement the logic to determine if the updated cipher is still in the report.
    // This could be checking if the password is still weak or exposed, etc.
    // For now, we will return the updated cipher view as is.
    // Replace this with your actual logic in the child classes.
    return updatedCipherView;
  }

  protected async repromptCipher(c: CipherView) {
    return (
      c.reprompt === CipherRepromptType.None ||
      (await this.passwordRepromptService.showPasswordPrompt())
    );
  }

  protected async getAllCiphers(): Promise<CipherView[]> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await this.cipherService.getAllDecrypted(activeUserId);
  }

  protected filterCiphersByOrg(ciphersList: CipherView[]) {
    this.allCiphers = [...ciphersList];

    this.ciphers = ciphersList.map((ciph) => {
      if (this.filterStatus.indexOf(ciph.organizationId) === -1 && ciph.organizationId != null) {
        this.filterStatus.push(ciph.organizationId);
      } else if (this.filterStatus.indexOf(1) === -1 && ciph.organizationId == null) {
        this.filterStatus.splice(1, 0, 1);
      }
      return ciph;
    });
    this.dataSource.data = this.ciphers;

    if (this.filterStatus.length > 2) {
      this.showFilterToggle = true;
      this.vaultMsg = "vaults";
    } else {
      // If a user fixes an item and there is only one item left remove the filter toggle and change the vault message to singular
      this.showFilterToggle = false;
      this.vaultMsg = "vault";
    }
  }
}
