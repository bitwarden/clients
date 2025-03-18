import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnDestroy } from "@angular/core";
import { firstValueFrom, Observable, Subject, takeUntil } from "rxjs";

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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId, CollectionId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { AnchorLinkDirective, CalloutModule, SearchModule } from "@bitwarden/components";

import { ChangeLoginPasswordService } from "../abstractions/change-login-password.service";
import { TaskService, SecurityTaskType } from "../tasks";

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
  standalone: true,
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
export class CipherViewComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) cipher: CipherView | null = null;

  activeUserId$ = getUserId(this.accountService.activeAccount$);

  /**
   * Optional list of collections the cipher is assigned to. If none are provided, they will be fetched using the
   * `CipherService` and the `collectionIds` property of the cipher.
   */
  @Input() collections?: CollectionView[];

  /** Should be set to true when the component is used within the Admin Console */
  @Input() isAdminConsole?: boolean = false;

  organization$: Observable<Organization | undefined> | undefined;
  folder$: Observable<FolderView | undefined> | undefined;
  private destroyed$: Subject<void> = new Subject();
  cardIsExpired: boolean = false;
  hadPendingChangePasswordTask: boolean = false;
  isSecurityTasksEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.SecurityTasks);

  constructor(
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private folderService: FolderService,
    private accountService: AccountService,
    private defaultTaskService: TaskService,
    private platformUtilsService: PlatformUtilsService,
    private changeLoginPasswordService: ChangeLoginPasswordService,
    private configService: ConfigService,
    private cipherService: CipherService,
  ) {}

  async ngOnChanges() {
    if (this.cipher == null) {
      return;
    }

    await this.loadCipherData();

    this.cardIsExpired = isCardExpired(this.cipher.card);
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  get hasCard() {
    if (!this.cipher) {
      return false;
    }

    const { cardholderName, code, expMonth, expYear, number } = this.cipher.card;
    return cardholderName || code || expMonth || expYear || number;
  }

  get hasLogin() {
    if (!this.cipher) {
      return false;
    }

    const { username, password, totp, fido2Credentials } = this.cipher.login;
    return username || password || totp || fido2Credentials;
  }

  get hasAutofill() {
    const uris = this.cipher?.login?.uris.length ?? 0;

    return uris > 0;
  }

  get hasSshKey() {
    return !!this.cipher?.sshKey?.privateKey;
  }

  async loadCipherData() {
    if (!this.cipher) {
      return;
    }

    // Load collections if not provided and the cipher has collectionIds
    if (
      this.cipher.collectionIds &&
      this.cipher.collectionIds.length > 0 &&
      (!this.collections || this.collections.length === 0)
    ) {
      this.collections = await firstValueFrom(
        this.collectionService.decryptedCollectionViews$(
          this.cipher.collectionIds as CollectionId[],
        ),
      );
    }

    const userId = await firstValueFrom(this.activeUserId$);

    // Show Tasks for Manage and Edit permissions
    // Using cipherService to see if user has access to cipher in a non-AC context to address with Edit Except Password permissions
    const allCiphers = await firstValueFrom(this.cipherService.ciphers$(userId));
    const cipherServiceCipher = allCiphers[this.cipher?.id as CipherId];

    if (cipherServiceCipher.edit && cipherServiceCipher.viewPassword) {
      await this.checkPendingChangePasswordTasks(userId);
    }

    if (this.cipher.organizationId && userId) {
      this.organization$ = this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.cipher.organizationId))
        .pipe(takeUntil(this.destroyed$));
    }

    if (this.cipher.folderId) {
      this.folder$ = this.folderService
        .getDecrypted$(this.cipher.folderId, userId)
        .pipe(takeUntil(this.destroyed$));
    }
  }

  async checkPendingChangePasswordTasks(userId: UserId): Promise<void> {
    if (!(await firstValueFrom(this.isSecurityTasksEnabled$))) {
      return;
    }

    const tasks = await firstValueFrom(this.defaultTaskService.pendingTasks$(userId));

    this.hadPendingChangePasswordTask = tasks?.some((task) => {
      return (
        task.cipherId === this.cipher?.id && task.type === SecurityTaskType.UpdateAtRiskCredential
      );
    });
  }

  launchChangePassword = async () => {
    if (this.cipher != null) {
      const url = await this.changeLoginPasswordService.getChangePasswordUrl(this.cipher);
      if (url == null) {
        return;
      }
      this.platformUtilsService.launchUri(url);
    }
  };
}
