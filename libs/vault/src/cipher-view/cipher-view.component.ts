import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";
import { firstValueFrom, Observable, Subject, takeUntil } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { isCardExpired } from "@bitwarden/common/autofill/utils";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getByIds } from "@bitwarden/common/platform/misc";
import { CipherId, EmergencyAccessId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { AnchorLinkDirective, CalloutModule, SearchModule } from "@bitwarden/components";

import { ChangeLoginPasswordService } from "../abstractions/change-login-password.service";

import { AdditionalOptionsComponent } from "./additional-options/additional-options.component";
import { AttachmentsV2ViewComponent } from "./attachments/attachments-v2-view.component";
import { AutofillOptionsViewComponent } from "./autofill-options/autofill-options-view.component";
import { CardDetailsComponent } from "./card-details/card-details-view.component";
import { CustomFieldV2Component } from "./custom-fields/custom-fields-v2.component";
import { ItemDetailsV2Component } from "./item-details/item-details-v2.component";
import { ItemHistoryV2Component } from "./item-history/item-history-v2.component";
import { LoginCredentialsViewComponent } from "./login-credentials/login-credentials-view.component";
import { SshKeyViewComponent } from "./sshkey-sections/sshkey-view.component";
import { ViewIdentitySectionsComponent } from "./view-identity-sections/view-identity-sections.component";

@Component({
  selector: "app-cipher-view",
  templateUrl: "cipher-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalloutModule,
    CommonModule,
    SearchModule,
    JslibModule,
    ItemDetailsV2Component,
    AdditionalOptionsComponent,
    AttachmentsV2ViewComponent,
    ItemHistoryV2Component,
    CustomFieldV2Component,
    CardDetailsComponent,
    SshKeyViewComponent,
    ViewIdentitySectionsComponent,
    LoginCredentialsViewComponent,
    AutofillOptionsViewComponent,
    AnchorLinkDirective,
  ],
})
export class CipherViewComponent implements OnDestroy {
  readonly cipher = input.required<CipherView>();

  // Required for fetching attachment data when viewed from cipher via emergency access
  readonly emergencyAccessId = input<EmergencyAccessId | undefined>();

  activeUserId$ = getUserId(this.accountService.activeAccount$);

  /**
   * Optional list of collections the cipher is assigned to. If none are provided, they will be fetched using the
   * `CipherService` and the `collectionIds` property of the cipher.
   */
  readonly collections = input<CollectionView[] | undefined>(undefined);

  /** Should be set to true when the component is used within the Admin Console */
  readonly isAdminConsole = input<boolean>(false);

  organization$: Observable<Organization | undefined> | undefined;
  folder$: Observable<FolderView | undefined> | undefined;
  private destroyed$: Subject<void> = new Subject();
  readonly cardIsExpired = signal<boolean>(false);
  readonly hadPendingChangePasswordTask = signal<boolean>(false);
  private readonly loadedCollections = signal<CollectionView[] | undefined>(undefined);

  constructor(
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private folderService: FolderService,
    private accountService: AccountService,
    private defaultTaskService: TaskService,
    private platformUtilsService: PlatformUtilsService,
    private changeLoginPasswordService: ChangeLoginPasswordService,
    private cipherService: CipherService,
    private logService: LogService,
  ) {
    effect(() => {
      const cipher = this.cipher();
      if (cipher == null) {
        return;
      }

      void this.loadCipherData();
      this.cardIsExpired.set(isCardExpired(cipher.card));
    });
  }

  readonly resolvedCollections = computed(() => {
    // Use provided collections input if available, otherwise use loaded collections
    return this.collections() ?? this.loadedCollections();
  });

  readonly hasCard = computed(() => {
    const cipher = this.cipher();
    if (!cipher) {
      return false;
    }

    const { cardholderName, code, expMonth, expYear, number } = cipher.card;
    return cardholderName || code || expMonth || expYear || number;
  });

  readonly hasLogin = computed(() => {
    const cipher = this.cipher();
    if (!cipher) {
      return false;
    }

    const { username, password, totp, fido2Credentials } = cipher.login;

    return username || password || totp || fido2Credentials?.length > 0;
  });

  readonly hasAutofill = computed(() => {
    const cipher = this.cipher();
    const uris = cipher?.login?.uris.length ?? 0;

    return uris > 0;
  });

  readonly hasSshKey = computed(() => {
    const cipher = this.cipher();
    return !!cipher?.sshKey?.privateKey;
  });

  readonly hasLoginUri = computed(() => {
    const cipher = this.cipher();
    return cipher?.login?.hasUris;
  });

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private async loadCipherData() {
    const cipher = this.cipher();
    if (!cipher) {
      return;
    }

    const userId = await firstValueFrom(this.activeUserId$);

    // Load collections if not provided and the cipher has collectionIds
    if (
      cipher.collectionIds &&
      cipher.collectionIds.length > 0 &&
      (!this.collections() || this.collections()?.length === 0)
    ) {
      this.loadedCollections.set(
        await firstValueFrom(
          this.collectionService.decryptedCollections$(userId).pipe(getByIds(cipher.collectionIds)),
        ),
      );
    }

    if (cipher.organizationId) {
      this.organization$ = this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(cipher.organizationId))
        .pipe(takeUntil(this.destroyed$));

      if (cipher.type === CipherType.Login) {
        await this.checkPendingChangePasswordTasks(userId);
      }
    }

    if (cipher.folderId) {
      this.folder$ = this.folderService
        .getDecrypted$(cipher.folderId, userId)
        .pipe(takeUntil(this.destroyed$));
    }
  }

  private async checkPendingChangePasswordTasks(userId: UserId): Promise<void> {
    const cipher = this.cipher();
    try {
      // Show Tasks for Manage and Edit permissions
      // Using cipherService to see if user has access to cipher in a non-AC context to address with Edit Except Password permissions
      const allCiphers = await firstValueFrom(this.cipherService.ciphers$(userId));
      const cipherServiceCipher = allCiphers[cipher?.id as CipherId];

      if (!cipherServiceCipher?.edit || !cipherServiceCipher?.viewPassword) {
        this.hadPendingChangePasswordTask.set(false);
        return;
      }

      const tasks = await firstValueFrom(this.defaultTaskService.pendingTasks$(userId));

      this.hadPendingChangePasswordTask.set(
        tasks?.some((task) => {
          return (
            task.cipherId === cipher?.id && task.type === SecurityTaskType.UpdateAtRiskCredential
          );
        }) ?? false,
      );
    } catch (error) {
      this.hadPendingChangePasswordTask.set(false);
      this.logService.error("Failed to retrieve change password tasks for cipher", error);
    }
  }

  launchChangePassword = async () => {
    const cipher = this.cipher();
    if (cipher != null) {
      const url = await this.changeLoginPasswordService.getChangePasswordUrl(cipher);
      if (url == null) {
        return;
      }
      this.platformUtilsService.launchUri(url);
    }
  };
}
