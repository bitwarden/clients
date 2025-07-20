// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  Subject,
  take,
  takeUntil,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import {
  ButtonModule,
  DialogService,
  Icons,
  ItemModule,
  NoItemsModule,
  SearchModule,
  SectionComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ZonedMessageListenerService } from "../../../platform/browser/zoned-message-listener.service";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { VaultPopoutType } from "../../../vault/popup/utils/vault-popout-window";
import { Fido2UserVerificationService } from "../../../vault/services/fido2-user-verification.service";
import {
  BrowserFido2Message,
  BrowserFido2UserInterfaceSession,
  BrowserFido2MessageTypes,
} from "../../fido2/services/browser-fido2-user-interface.service";

import { Fido2CipherRowComponent } from "./fido2-cipher-row.component";
import { Fido2UseBrowserLinkComponent } from "./fido2-use-browser-link.component";

const PasskeyActions = {
  Register: "register",
  Authenticate: "authenticate",
} as const;

type PasskeyActionValue = (typeof PasskeyActions)[keyof typeof PasskeyActions];

interface ViewData {
  message: BrowserFido2Message;
  fallbackSupported: boolean;
}

@Component({
  selector: "app-fido2",
  templateUrl: "fido2.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    Fido2CipherRowComponent,
    Fido2UseBrowserLinkComponent,
    FormsModule,
    ItemModule,
    JslibModule,
    NoItemsModule,
    PopupHeaderComponent,
    PopupPageComponent,
    SearchModule,
    SectionComponent,
    SectionHeaderComponent,
  ],
})
export class Fido2Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private message$ = new BehaviorSubject<BrowserFido2Message>(null);
  protected BrowserFido2MessageTypes = BrowserFido2MessageTypes;
  protected cipher: CipherView;
  protected ciphers?: CipherView[] = [];
  protected data$: Observable<ViewData>;
  protected displayedCiphers?: CipherView[] = [];
  protected equivalentDomains: Set<string>;
  protected equivalentDomainsURL: string;
  protected hostname: string;
  protected loading = false;
  protected noResultsIcon = Icons.NoResults;
  protected passkeyAction: PasskeyActionValue = PasskeyActions.Register;
  protected PasskeyActions = PasskeyActions;
  protected hasSearched = false;
  protected searchText: string;
  protected searchTypeSearch = false;
  protected senderTabId?: string;
  protected sessionId?: string;
  protected showNewPasskeyButton: boolean = false;
  protected url: string;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cipherService: CipherService,
    private platformUtilsService: PlatformUtilsService,
    private domainSettingsService: DomainSettingsService,
    private searchService: SearchService,
    private logService: LogService,
    private dialogService: DialogService,
    private browserMessagingApi: ZonedMessageListenerService,
    private passwordRepromptService: PasswordRepromptService,
    private accountService: AccountService,
    private fido2UserVerificationService: Fido2UserVerificationService,
  ) {}

  ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();

    const queryParams$ = this.activatedRoute.queryParamMap.pipe(
      take(1),
      map((queryParamMap) => ({
        sessionId: queryParamMap.get("sessionId"),
        senderTabId: queryParamMap.get("senderTabId"),
        senderUrl: queryParamMap.get("senderUrl"),
      })),
    );

    combineLatest([
      queryParams$,
      this.browserMessagingApi.messageListener$() as Observable<BrowserFido2Message>,
    ])
      .pipe(
        concatMap(async ([queryParams, message]) => {
          this.sessionId = queryParams.sessionId;
          this.senderTabId = queryParams.senderTabId;
          this.url = queryParams.senderUrl;
          // For a 'NewSessionCreatedRequest', abort if it doesn't belong to the current session.
          if (
            message.type === BrowserFido2MessageTypes.NewSessionCreatedRequest &&
            message.sessionId !== queryParams.sessionId
          ) {
            this.abort(false);
            return;
          }

          // Ignore messages that don't belong to the current session.
          if (message.sessionId !== queryParams.sessionId) {
            return;
          }

          if (message.type === BrowserFido2MessageTypes.AbortRequest) {
            this.abort(false);
            return;
          }

          return message;
        }),
        filter((message) => !!message),
        takeUntil(this.destroy$),
      )
      .subscribe((message) => {
        this.message$.next(message);
      });

    this.data$ = this.message$.pipe(
      filter((message) => message != undefined),
      concatMap(async (message) => {
        switch (message.type) {
          case BrowserFido2MessageTypes.ConfirmNewCredentialRequest: {
            const equivalentDomains = await firstValueFrom(
              this.domainSettingsService.getUrlEquivalentDomains(this.url),
            );

            const activeUserId = await firstValueFrom(
              this.accountService.activeAccount$.pipe(getUserId),
            );
            this.ciphers = (await this.cipherService.getAllDecrypted(activeUserId)).filter(
              (cipher) => cipher.type === CipherType.Login && !cipher.isDeleted,
            );

            this.displayedCiphers = this.ciphers.filter(
              (cipher) =>
                cipher.login.matchesUri(this.url, equivalentDomains) &&
                this.cipherHasNoOtherPasskeys(cipher, message.userHandle),
            );

            this.passkeyAction = PasskeyActions.Register;

            // @TODO fix new cipher creation for other fido2 registration message types and remove `showNewPasskeyButton` from the template
            this.showNewPasskeyButton = true;

            break;
          }

          case BrowserFido2MessageTypes.PickCredentialRequest: {
            const activeUserId = await firstValueFrom(
              this.accountService.activeAccount$.pipe(map((a) => a?.id)),
            );

            this.ciphers = await Promise.all(
              message.cipherIds.map(async (cipherId) => {
                const cipher = await this.cipherService.get(cipherId, activeUserId);
                return this.cipherService.decrypt(cipher, activeUserId);
              }),
            );

            this.displayedCiphers = [...this.ciphers];

            this.passkeyAction = PasskeyActions.Authenticate;

            break;
          }

          case BrowserFido2MessageTypes.InformExcludedCredentialRequest: {
            const activeUserId = await firstValueFrom(
              this.accountService.activeAccount$.pipe(map((a) => a?.id)),
            );

            this.ciphers = await Promise.all(
              message.existingCipherIds.map(async (cipherId) => {
                const cipher = await this.cipherService.get(cipherId, activeUserId);
                return this.cipherService.decrypt(cipher, activeUserId);
              }),
            );

            this.displayedCiphers = [...this.ciphers];

            this.passkeyAction = PasskeyActions.Register;

            break;
          }

          case BrowserFido2MessageTypes.InformCredentialNotFoundRequest: {
            this.passkeyAction = PasskeyActions.Authenticate;

            break;
          }
        }

        return {
          message,
          fallbackSupported: "fallbackSupported" in message && message.fallbackSupported,
        };
      }),

      takeUntil(this.destroy$),
    );

    queryParams$.pipe(takeUntil(this.destroy$)).subscribe((queryParams) => {
      this.send({
        sessionId: queryParams.sessionId,
        type: BrowserFido2MessageTypes.ConnectResponse,
      });
    });
  }

  protected async submit() {
    const data = this.message$.value;

    if (data?.type === BrowserFido2MessageTypes.PickCredentialRequest) {
      // TODO: Revert to use fido2 user verification service once user verification for passkeys is approved for production.
      // PM-4577 - https://github.com/bitwarden/clients/pull/8746
      const userVerified = await this.handleUserVerification(data.userVerification, this.cipher);

      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: BrowserFido2MessageTypes.PickCredentialResponse,
        userVerified,
      });
    } else if (data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      if (this.cipher.login.hasFido2Credentials) {
        const confirmed = await this.dialogService.openSimpleDialog({
          title: { key: "overwritePasskey" },
          content: { key: "overwritePasskeyAlert" },
          type: "warning",
        });

        if (!confirmed) {
          return false;
        }
      }

      // TODO: Revert to use fido2 user verification service once user verification for passkeys is approved for production.
      // PM-4577 - https://github.com/bitwarden/clients/pull/8746
      const userVerified = await this.handleUserVerification(data.userVerification, this.cipher);

      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: BrowserFido2MessageTypes.ConfirmNewCredentialResponse,
        userVerified,
      });
    }

    this.loading = true;
  }

  protected async saveNewLogin() {
    const data = this.message$.value;

    if (data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      const name = data.credentialName || data.rpId;
      // TODO: Revert to check for user verification once user verification for passkeys is approved for production.
      // PM-4577 - https://github.com/bitwarden/clients/pull/8746
      await this.createNewCipher(name, data.userName);

      // We are bypassing user verification pending approval.
      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher?.id,
        type: BrowserFido2MessageTypes.ConfirmNewCredentialResponse,
        userVerified: data.userVerification,
      });
    }

    this.loading = true;
  }

  async handleCipherItemSelect(item: CipherView) {
    this.cipher = item;

    await this.submit();
  }

  async addCipher() {
    const data = this.message$.value;

    if (data?.type === BrowserFido2MessageTypes.ConfirmNewCredentialRequest) {
      await this.router.navigate(["/add-cipher"], {
        queryParams: {
          type: CipherType.Login.toString(),
          name: data.credentialName || data.rpId,
          uri: this.url,
          uilocation: "popout",
          username: data.userName,
          senderTabId: this.senderTabId,
          sessionId: this.sessionId,
          userVerification: data.userVerification,
          singleActionPopout: `${VaultPopoutType.fido2Popout}_${this.sessionId}`,
        },
      });
    }

    return;
  }

  async getEquivalentDomains() {
    if (this.equivalentDomainsURL !== this.url) {
      this.equivalentDomainsURL = this.url;
      this.equivalentDomains = await firstValueFrom(
        this.domainSettingsService.getUrlEquivalentDomains(this.url),
      );
    }

    return this.equivalentDomains;
  }

  async clearSearch() {
    this.searchText = "";
    await this.setDisplayedCiphersToAllDomainMatch();
  }

  protected async setDisplayedCiphersToAllDomainMatch() {
    const equivalentDomains = await this.getEquivalentDomains();
    this.displayedCiphers = this.ciphers.filter((cipher) =>
      cipher.login.matchesUri(this.url, equivalentDomains),
    );
  }

  protected async search() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.hasSearched = true;
    const isSearchable = await this.searchService.isSearchable(userId, this.searchText);

    if (isSearchable) {
      this.displayedCiphers = await this.searchService.searchCiphers(
        userId,
        this.searchText,
        null,
        this.ciphers,
      );
    } else {
      await this.setDisplayedCiphersToAllDomainMatch();
    }
  }

  abort(fallback: boolean) {
    this.unload(fallback);
    window.close();
  }

  unload(fallback = false) {
    this.send({
      sessionId: this.sessionId,
      type: BrowserFido2MessageTypes.AbortResponse,
      fallbackRequested: fallback,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildCipher(name: string, username: string) {
    this.cipher = new CipherView();
    this.cipher.name = name;

    this.cipher.type = CipherType.Login;
    this.cipher.login = new LoginView();
    this.cipher.login.username = username;
    this.cipher.login.uris = [new LoginUriView()];
    this.cipher.login.uris[0].uri = this.url;
    this.cipher.card = new CardView();
    this.cipher.identity = new IdentityView();
    this.cipher.secureNote = new SecureNoteView();
    this.cipher.secureNote.type = SecureNoteType.Generic;
    this.cipher.reprompt = CipherRepromptType.None;
  }

  private async createNewCipher(name: string, username: string) {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    this.buildCipher(name, username);
    const encrypted = await this.cipherService.encrypt(this.cipher, activeUserId);
    try {
      await this.cipherService.createWithServer(encrypted);
      this.cipher.id = encrypted.cipher.id;
    } catch (e) {
      this.logService.error(e);
    }
  }

  // TODO: Remove and use fido2 user verification service once user verification for passkeys is approved for production.
  private async handleUserVerification(
    userVerificationRequested: boolean,
    cipher: CipherView,
  ): Promise<boolean> {
    const masterPasswordRepromptRequired = cipher && cipher.reprompt !== 0;

    if (masterPasswordRepromptRequired) {
      return await this.passwordRepromptService.showPasswordPrompt();
    }

    return userVerificationRequested;
  }

  private send(msg: BrowserFido2Message) {
    BrowserFido2UserInterfaceSession.sendMessage({
      sessionId: this.sessionId,
      ...msg,
    });
  }

  /**
   * This methods returns true if a cipher either has no passkeys, or has a passkey matching with userHandle
   * @param userHandle
   */
  private cipherHasNoOtherPasskeys(cipher: CipherView, userHandle: string): boolean {
    if (cipher.login.fido2Credentials == null || cipher.login.fido2Credentials.length === 0) {
      return true;
    }

    return cipher.login.fido2Credentials.some((passkey) => passkey.userHandle === userHandle);
  }
}
