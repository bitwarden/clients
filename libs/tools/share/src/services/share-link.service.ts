import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ClientType } from "@bitwarden/client-type";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendSdkApiService } from "@bitwarden/common/tools/send/services/send-sdk-api.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { PolicyType } from "@bitwarden/sdk-internal";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ShareItemDrawerComponent } from "../components/share-item-drawer/share-item-drawer.component";

/**
 * Represents an active share link created for a vault item.
 */
export interface ShareLink {
  cipherId: CipherId;
  sendId: string;
  emails: string[];
  expiresAt: Date;
  oneTimeShare: boolean;
  url: string;
}

/**
 * Service for managing share links.
 */
@Injectable({ providedIn: "root" })
export class ShareLinkService {
  private sendService = inject(SendService);
  private environmentService = inject(EnvironmentService);
  private accountService = inject(AccountService);
  private sendSdkApiService = inject(SendSdkApiService);
  private i18nService = inject(I18nService);
  private configService = inject(ConfigService);
  private collectionService = inject(CollectionService);
  private policyService = inject(PolicyService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly platformService = inject(PlatformUtilsService);
  private readonly router = inject(Router);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly cipherService = inject(CipherService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);

  private cipherId = new BehaviorSubject<CipherId | undefined>(undefined);
  private links = new BehaviorSubject<ShareLink[]>([]);

  /** Observable of all active share links. */
  links$ = this.links.asObservable();

  constructor() {
    combineLatest([this.cipherId, this.sendService.sendViews$])
      .pipe(takeUntilDestroyed())
      .subscribe(([cipherId, sendViews]) => {
        void this.getLinksForCipher(cipherId, sendViews);
      });
  }

  /**
   * Creates a new share link
   *
   * @param cipherView - The cipher to share
   * @param emails - Comma-delimited email addresses
   * @param expiryHours - Number of hours until expiry
   * @param oneTimeShare - Whether the link can only be viewed once
   * @returns The created share link
   */
  async createShareLink(
    cipherView: CipherView,
    emails: string[],
    expiryHours: number,
    oneTimeShare: boolean,
  ): Promise<string | undefined> {
    const sendView = new SendView();
    sendView.name = this.i18nService.t("itemSendTitle", cipherView.name);
    sendView.type = SendType.Item;
    sendView.authType = AuthType.Email;
    sendView.emails = emails;
    sendView.deletionDate = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    sendView.expirationDate = sendView.deletionDate;
    if (oneTimeShare) {
      sendView.maxAccessCount = 1;
    }
    const sharedCipherView = this.toShareView(cipherView);
    if (!sharedCipherView) {
      throw new Error(this.i18nService.t("linkSaveFailed"));
    }

    sendView.data = {
      data: sharedCipherView,
    };

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const createdSdkSendView = await this.sendSdkApiService.mutateSend(
      sendView,
      userId,
      null as any,
    );
    await this.sendSdkApiService.refreshAfterMutation(createdSdkSendView.id as any);
    const env = await firstValueFrom(this.environmentService.environment$);
    if (!createdSdkSendView.key) {
      return;
    }
    const sendLink =
      env.getSendUrl() +
      createdSdkSendView.accessId +
      "/" +
      Utils.fromB64toUrlB64(createdSdkSendView.key);
    return sendLink;
  }

  // Create a copy of a CipherView suitable for sharing, with some fields removed
  // Returns undefined if we are unable to do so
  private toShareView(cipherView: CipherView): CipherView | undefined {
    // Create a deep copy of the CipherView
    const sharedCipherView = CipherView.fromJSON(JSON.parse(JSON.stringify(cipherView)));
    if (!sharedCipherView) {
      return;
    }
    // Strip attachments, passkeys, password history, and encryption key
    sharedCipherView.attachments = [];
    if (sharedCipherView.login) {
      sharedCipherView.login.fido2Credentials = [];
    }
    sharedCipherView.passwordHistory = [];
    delete sharedCipherView.key;

    return sharedCipherView;
  }

  setCipher(cipherId: CipherId | undefined) {
    this.cipherId.next(cipherId);
  }

  /** Recalculates active share links for a given cipher. */
  private async getLinksForCipher(
    cipherId: CipherId | undefined,
    sendViews: SendView[],
  ): Promise<void> {
    const newLinks: ShareLink[] = [];
    if (!cipherId) {
      this.links.next(newLinks);
      return;
    }
    const env = await firstValueFrom(this.environmentService.environment$);
    for (const send of sendViews) {
      if (send.type === SendType.Item && (send.data?.data?.id as any) === cipherId && send.key) {
        const sendLink = env.getSendUrl() + send.accessId + "/" + Utils.fromArrayToUrlB64(send.key);
        newLinks.push({
          sendId: send.id,
          cipherId: send.data?.data?.id as any,
          emails: send.emails,
          expiresAt: send.deletionDate,
          oneTimeShare: send.maxAccessCount === 1,
          url: sendLink,
        });
      }
    }
    this.links.next(newLinks);
  }

  /** Deletes a share link by Send id. */
  async deleteLink(sendId: string): Promise<void> {
    const link = this.links.getValue().find((l) => l.sendId === sendId);
    if (link) {
      await this.sendSdkApiService.delete(link.sendId);
    }
  }

  /** Returns whether a cipher can be shared or not */
  cipherCanBeShared$(c: CipherViewLike | undefined): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM34203TemporaryItemSharing),
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
        ),
      ),
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.policyService.policiesByType$(PolicyType.SendControls, userId)),
      ),
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.collectionService.decryptedCollections$(userId)),
      ),
    ]).pipe(
      map(([ffEnabled, hasPremium, sendControlsPolicies, collections]) => {
        // Sharing feature must be enabled and, as a premium feature, accessible
        if (!ffEnabled || !hasPremium) {
          return false;
        }
        // Cannot be shared if the cipher is undefined, archived, deleted, or an SSH key
        if (
          !c ||
          c.archivedDate ||
          c.deletedDate ||
          CipherViewLikeUtils.getType(c) === CipherType.SshKey
        ) {
          return false;
        }
        // Look for any policy that doesn't allow Item-type Sends, doesn't allow the email auth
        // they require, or disables the Send feature entirely; any of these preclude sharing
        const policyDisablingItemSends = sendControlsPolicies.find(
          (scp) =>
            (scp.data.allowedSendTypes && !scp.data.allowedSendTypes.includes(SendType.Item)) ||
            scp.data.whoCanAccess === WhoCanAccessType.PasswordProtected ||
            scp.data.disableSend,
        );
        if (policyDisablingItemSends) {
          return false;
        }
        // Lastly check that, if a cipher belongs to any collections,
        // the user has edit-level access to at least one of them.
        return (
          c.collectionIds.length === 0 ||
          c.collectionIds.some((cId) =>
            collections.some((col) => col.id === cId && !col.readOnly && !col.hidePasswords),
          )
        );
      }),
    );
  }

  async openShareForm(cipher: CipherViewLike, hostDialog: DialogRef | null): Promise<void> {
    const clientType = this.platformService.getClientType();
    if (clientType === ClientType.Cli) {
      return;
    }
    const cipherView = await this.resolveCipherView(cipher);
    if (!cipherView || !cipherView.id) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("unknownCipher"),
      });
      return;
    }
    this.setCipher(cipherView.id as CipherId);
    if (clientType === ClientType.Browser) {
      await this.router.navigate(["/share-item"], { queryParams: { cipherId: cipherView.id } });
    } else {
      // Web/Desktop
      if (hostDialog == null && cipher.reprompt === CipherRepromptType.Password) {
        const pwdEntered = await this.passwordRepromptService.showPasswordPrompt();
        if (!pwdEntered) {
          return;
        }
      }
      await this.dialogService.openDrawer(ShareItemDrawerComponent, {
        data: { cipher: cipherView },
      });
      await hostDialog?.close();
    }
  }

  /**
   * The drawer needs a full {@link CipherView}. Lists that render `CipherListView` rows have to
   * look one up; callers that already hold a decrypted view — the Admin Console, whose items are
   * not necessarily in the acting user's own vault — pass it straight through, because looking it
   * up by id would come back empty for them.
   */
  private async resolveCipherView(cipher: CipherViewLike): Promise<CipherView | undefined> {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      return cipher;
    }

    if (cipher.id == null) {
      return undefined;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    // The SDK and `common` tag cipher ids separately, so the two do not overlap structurally.
    return await firstValueFrom(
      this.cipherService.cipherView$(userId, cipher.id as unknown as CipherId),
    );
  }
}
