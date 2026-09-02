import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendSdkApiService } from "@bitwarden/common/tools/send/services/send-sdk-api.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { PolicyType } from "@bitwarden/sdk-internal";

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
    await this.sendSdkApiService.refreshSendFromServer(createdSdkSendView.id as any);
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
      await this.sendSdkApiService.deleteSend(link.sendId);
    }
  }

  /** Returns whether a cipher can be shared or not */
  cipherCanBeShared$(c: CipherViewLike | undefined): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM34203TemporaryItemSharing),
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.collectionService.decryptedCollections$(userId)),
      ),
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.policyService.policiesByType$(PolicyType.SendControls, userId)),
      ),
    ]).pipe(
      map(([ffEnabled, collections, sendControlsPolicies]) => {
        const policyDisablingItemSends = sendControlsPolicies.find(
          (scp) =>
            scp.data.disableSend ||
            (scp.data.allowedSendTypes && !scp.data.allowedSendTypes.includes(SendType.Item)),
        );
        if (policyDisablingItemSends) {
          return false;
        }
        if (!c || c.archivedDate || c.deletedDate) {
          return false;
        }
        if (!ffEnabled) {
          return false;
        }
        if (CipherViewLikeUtils.getType(c) === CipherType.SshKey) {
          return false;
        }
        if (c.collectionIds.length === 0) {
          return true;
        }
        return c.collectionIds.some((cId) =>
          collections.some((col) => col.id === cId && !col.readOnly && !col.hidePasswords),
        );
      }),
    );
  }
}
