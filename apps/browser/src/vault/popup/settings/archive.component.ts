import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable, startWith, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
  CardComponent,
  ButtonComponent,
} from "@bitwarden/components";
import {
  CanDeleteCipherDirective,
  DecryptionFailureDialogComponent,
  OrgIconDirective,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { ROUTES_AFTER_EDIT_DELETION } from "../services/vault-popup-after-deletion-navigation.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "archive.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    NoItemsModule,
    ItemModule,
    MenuModule,
    IconButtonModule,
    CanDeleteCipherDirective,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    OrgIconDirective,
    CardComponent,
    ButtonComponent,
  ],
})
export class ArchiveComponent {
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private cipherService = inject(CipherService);
  private accountService = inject(AccountService);
  private logService = inject(LogService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private cipherArchiveService = inject(CipherArchiveService);
  private passwordRepromptService = inject(PasswordRepromptService);
  private organizationService = inject(OrganizationService);
  private collectionService = inject(CollectionService);

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  private readonly orgMap = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        this.organizationService.organizations$(userId).pipe(
          map((orgs) => {
            const map = new Map<string, Organization>();
            for (const org of orgs) {
              map.set(org.id, org);
            }
            return map;
          }),
        ),
      ),
    ),
  );

  private readonly collections = toSignal(
    this.userId$.pipe(switchMap((userId) => this.collectionService.decryptedCollections$(userId))),
  );

  protected archivedCiphers$ = this.userId$.pipe(
    switchMap((userId) => this.cipherArchiveService.archivedCiphers$(userId)),
  );

  protected userCanArchive$ = this.userId$.pipe(
    switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
  );
  protected CipherViewLikeUtils = CipherViewLikeUtils;

  protected loading$ = this.archivedCiphers$.pipe(
    map(() => false),
    startWith(true),
  );

  protected canAssignCollections$ = this.userId$.pipe(
    switchMap((userId) => {
      return combineLatest([
        this.organizationService.hasOrganizations(userId),
        this.collectionService.decryptedCollections$(userId),
      ]).pipe(
        map(([hasOrgs, collections]) => {
          const canEditCollections = collections.some((c) => !c.readOnly);
          return hasOrgs && canEditCollections;
        }),
      );
    }),
  );

  protected showSubscriptionEndedMessaging$ = this.userId$.pipe(
    switchMap((userId) => this.cipherArchiveService.showSubscriptionEndedMessaging$(userId)),
  );

  protected userHasPremium$ = this.userId$.pipe(
    switchMap((userId) => this.cipherArchiveService.userHasPremium$(userId)),
  );

  async navigateToPremium() {
    await this.router.navigate(["/premium"]);
  }

  async view(cipher: CipherViewLike) {
    if (!(await this.canInteract(cipher))) {
      return;
    }

    await this.router.navigate(["/view-cipher"], {
      queryParams: {
        cipherId: cipher.id,
        type: cipher.type,
        routeAfterDeletion: ROUTES_AFTER_EDIT_DELETION.archive,
      },
    });
  }

  async edit(cipher: CipherViewLike) {
    if (!(await this.canInteract(cipher))) {
      return;
    }

    await this.router.navigate(["/edit-cipher"], {
      queryParams: {
        cipherId: cipher.id,
        type: cipher.type,
        routeAfterDeletion: ROUTES_AFTER_EDIT_DELETION.archive,
      },
    });
  }

  async delete(cipher: CipherViewLike) {
    if (!(await this.canInteract(cipher))) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const activeUserId = await firstValueFrom(this.userId$);

    try {
      await this.cipherService.softDeleteWithServer(cipher.id as string, activeUserId);
    } catch (e) {
      this.logService.error(e);
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedItem"),
    });
  }

  async unarchive(cipher: CipherViewLike) {
    if (!(await this.canInteract(cipher))) {
      return;
    }
    const activeUserId = await firstValueFrom(this.userId$);

    await this.cipherArchiveService.unarchiveWithServer(
      cipher.id as unknown as CipherId,
      activeUserId,
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("itemUnarchivedToast"),
    });
  }

  async clone(cipher: CipherViewLike) {
    if (!(await this.canInteract(cipher))) {
      return;
    }

    if (CipherViewLikeUtils.hasFido2Credentials(cipher)) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return;
      }
    }

    await this.router.navigate(["/clone-cipher"], {
      queryParams: {
        clone: true.toString(),
        cipherId: cipher.id,
        type: cipher.type,
      },
    });
  }

  /** Prompts for password when necessary then navigates to the assign collections route */
  async conditionallyNavigateToAssignCollections(cipher: CipherViewLike) {
    if (cipher.reprompt && !(await this.passwordRepromptService.showPasswordPrompt())) {
      return;
    }

    await this.router.navigate(["/assign-collections"], {
      queryParams: { cipherId: cipher.id },
    });
  }

  /**
   * Check if the user is able to interact with the cipher
   * (password re-prompt / decryption failure checks).
   * @param cipher
   * @private
   */
  private canInteract(cipher: CipherViewLike) {
    if (CipherViewLikeUtils.decryptionFailure(cipher)) {
      DecryptionFailureDialogComponent.open(this.dialogService, {
        cipherIds: [cipher.id as CipherId],
      });
      return false;
    }

    return this.passwordRepromptService.passwordRepromptCheck(cipher);
  }

  /**
   * Get the organization tier type for the given cipher.
   */
  orgTierType({ organizationId }: CipherViewLike) {
    return this.orgMap()?.get(organizationId as string)?.productTierType;
  }

  /**
   * Get the organization icon tooltip for the given cipher.
   */
  orgIconTooltip({ collectionIds }: CipherViewLike) {
    if (collectionIds.length !== 1) {
      return this.i18nService.t("nCollections", collectionIds.length);
    }

    return this.collections()?.find((c) => c.id === collectionIds[0])?.name;
  }
}
