import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, combineLatest, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendSdkApiService } from "@bitwarden/common/tools/send/services/send-sdk-api.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Represents an active share link created for a vault item.
 */
export interface ShareLink {
  id: number;
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

  private cipherId = new BehaviorSubject<CipherId | undefined>(undefined);
  private readonly links = new BehaviorSubject<ShareLink[]>([]);

  /** Observable of all active share links. */
  readonly links$ = this.links.asObservable();

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
    sendView.name = `Share for Cipher ${cipherView.id}`;
    sendView.type = SendType.Item;
    sendView.authType = AuthType.Email;
    sendView.emails = emails;
    sendView.deletionDate = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    if (oneTimeShare) {
      sendView.maxAccessCount = 1;
    }
    const sharedCipherView = new CipherView();
    Object.assign(sharedCipherView, cipherView);
    sharedCipherView.attachments = [];
    if (sharedCipherView.login) {
      sharedCipherView.login.fido2Credentials = [];
    }
    delete sharedCipherView.key;
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
          id: newLinks.length,
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

  /** Deletes a share link by id. */
  async deleteLink(linkId: number): Promise<void> {
    const link = this.links.getValue().find((l) => l.id === linkId);
    if (link) {
      await this.sendSdkApiService.deleteSend(link.sendId);
    }
  }
}
