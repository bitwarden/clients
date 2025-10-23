import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, of, switchMap, map, catchError, from, Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { isCardExpired } from "@bitwarden/common/autofill/utils";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getByIds } from "@bitwarden/common/platform/misc";
import { CipherId, EmergencyAccessId, UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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
export class CipherViewComponent {
  readonly cipher = input.required<CipherView>();
  private readonly cipher$ = toObservable(this.cipher);

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
    private cipherRiskService: CipherRiskService,
    private billingAccountService: BillingAccountProfileStateService,
  ) {}

  readonly resolvedCollections = toSignal<CollectionView[] | undefined>(
    combineLatest([this.activeUserId$, this.cipher$, toObservable(this.collections)]).pipe(
      switchMap(([userId, cipher, providedCollections]) => {
        // Use provided collections if available
        if (providedCollections && providedCollections.length > 0) {
          return of(providedCollections);
        }
        // Otherwise, load collections based on cipher's collectionIds
        if (cipher.collectionIds && cipher.collectionIds.length > 0) {
          return this.collectionService
            .decryptedCollections$(userId)
            .pipe(getByIds(cipher.collectionIds));
        }
        return of(undefined);
      }),
    ),
  );

  readonly organization = toSignal(
    combineLatest([this.activeUserId$, this.cipher$]).pipe(
      switchMap(([userId, cipher]) => {
        if (!userId || !cipher?.organizationId) {
          return of(undefined);
        }
        return this.organizationService.organizations$(userId).pipe(
          map((organizations) => {
            return organizations.find((org) => org.id === cipher.organizationId);
          }),
        );
      }),
    ),
  );
  readonly folder = toSignal(
    combineLatest([this.activeUserId$, this.cipher$]).pipe(
      switchMap(([userId, cipher]) => {
        if (!userId || !cipher?.folderId) {
          return of(undefined);
        }
        return this.folderService.getDecrypted$(cipher.folderId, userId);
      }),
    ),
  );

  readonly hadPendingChangePasswordTask = toSignal(
    combineLatest([this.activeUserId$, this.cipher$]).pipe(
      switchMap(([userId, cipher]) => {
        // Early exit if not a Login cipher owned by an organization
        if (cipher?.type !== CipherType.Login || !cipher?.organizationId) {
          return of(false);
        }

        return combineLatest([
          this.cipherService.ciphers$(userId),
          this.defaultTaskService.pendingTasks$(userId),
        ]).pipe(
          map(([allCiphers, tasks]) => {
            const cipherServiceCipher = allCiphers[cipher?.id as CipherId];

            // Show tasks only for Manage and Edit permissions
            if (!cipherServiceCipher?.edit || !cipherServiceCipher?.viewPassword) {
              return false;
            }

            return (
              tasks?.some(
                (task) =>
                  task.cipherId === cipher?.id &&
                  task.type === SecurityTaskType.UpdateAtRiskCredential,
              ) ?? false
            );
          }),
          catchError((error: unknown) => {
            this.logService.error("Failed to retrieve change password tasks for cipher", error);
            return of(false);
          }),
        );
      }),
    ),
    { initialValue: false },
  );

  readonly hasCard = computed(() => {
    const cipher = this.cipher();
    if (!cipher) {
      return false;
    }

    const { cardholderName, code, expMonth, expYear, number } = cipher.card;
    return cardholderName || code || expMonth || expYear || number;
  });

  readonly cardIsExpired = computed(() => {
    const cipher = this.cipher();
    if (cipher == null) {
      return false;
    }
    return isCardExpired(cipher.card);
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

  readonly passwordIsAtRisk = toSignal(
    combineLatest([this.activeUserId$, this.cipher$]).pipe(
      switchMap(([userId, cipher]) =>
        this.switchPremium$(
          userId,
          () => from(this.checkIfPasswordIsAtRisk(cipher.id as CipherId, userId as UserId)),
          () => of(false),
        ),
      ),
    ),
    { initialValue: false },
  );

  readonly showChangePasswordLink = computed(() => {
    return this.hasLoginUri() && (this.hadPendingChangePasswordTask() || this.passwordIsAtRisk());
  });

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

  /**
   * Switches between two observables based on whether the user has a premium from any source.
   */
  private switchPremium$<T>(
    userId: UserId,
    ifPremium$: () => Observable<T>,
    ifNonPremium$: () => Observable<T>,
  ): Observable<T> {
    return this.billingAccountService
      .hasPremiumFromAnySource$(userId)
      .pipe(switchMap((isPremium) => (isPremium ? ifPremium$() : ifNonPremium$())));
  }

  private async checkIfPasswordIsAtRisk(cipherId: CipherId, userId: UserId): Promise<boolean> {
    try {
      const risk = await this.cipherRiskService.computeCipherRiskForUser(cipherId, userId, true);
      return (
        (risk.exposed_result.type === "Found" && risk.exposed_result.value > 0) ||
        (risk.reuse_count ?? 1) > 1 ||
        risk.password_strength < 3
      );
    } catch (error: unknown) {
      this.logService.error("Failed to check if password is at risk", error);
      return false;
    }
  }
}
