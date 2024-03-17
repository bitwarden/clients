import { Component, OnDestroy, OnInit } from "@angular/core";
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

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecureNoteType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ZonedMessageListenerService } from "../../../../platform/browser/zoned-message-listener.service";
import {
  BrowserFido2Message,
  BrowserFido2UserInterfaceSession,
} from "../../../fido2/browser-fido2-user-interface.service";
import { VaultPopoutType } from "../../utils/vault-popout-window";

interface ViewData {
  message: BrowserFido2Message;
  fallbackSupported: boolean;
}

@Component({
  selector: "app-fido2",
  templateUrl: "fido2.component.html",
  styleUrls: [],
})
export class Fido2Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private hasSearched = false;

  protected cipher: CipherView;
  protected searchTypeSearch = false;
  protected searchPending = false;
  protected searchText: string;
  protected url: string;
  protected hostname: string;
  protected data$: Observable<ViewData>;
  protected sessionId?: string;
  protected senderTabId?: string;
  protected ciphers?: CipherView[] = [];
  protected displayedCiphers?: CipherView[] = [];
  protected loading = false;
  protected subtitleText: string;
  protected credentialText: string;

  private message$ = new BehaviorSubject<BrowserFido2Message>(null);

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService,
    private platformUtilsService: PlatformUtilsService,
    private domainSettingsService: DomainSettingsService,
    private searchService: SearchService,
    private logService: LogService,
    private dialogService: DialogService,
    private browserMessagingApi: ZonedMessageListenerService,
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
            message.type === "NewSessionCreatedRequest" &&
            message.sessionId !== queryParams.sessionId
          ) {
            this.abort(false);
            return;
          }

          // Ignore messages that don't belong to the current session.
          if (message.sessionId !== queryParams.sessionId) {
            return;
          }

          if (message.type === "AbortRequest") {
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
          case "ConfirmNewCredentialRequest": {
            const equivalentDomains = await firstValueFrom(
              this.domainSettingsService.getUrlEquivalentDomains(this.url),
            );

            this.ciphers = (await this.cipherService.getAllDecrypted()).filter(
              (cipher) => cipher.type === CipherType.Login && !cipher.isDeleted,
            );
            this.displayedCiphers = this.ciphers.filter((cipher) =>
              cipher.login.matchesUri(this.url, equivalentDomains),
            );

            if (this.displayedCiphers.length > 0) {
              this.selectedPasskey(this.displayedCiphers[0]);
            }
            break;
          }

          case "PickCredentialRequest": {
            this.ciphers = await Promise.all(
              message.cipherIds.map(async (cipherId) => {
                const cipher = await this.cipherService.get(cipherId);
                return cipher.decrypt(
                  await this.cipherService.getKeyForCipherKeyDecryption(cipher),
                );
              }),
            );
            this.displayedCiphers = [...this.ciphers];
            if (this.displayedCiphers.length > 0) {
              this.selectedPasskey(this.displayedCiphers[0]);
            }
            break;
          }

          case "InformExcludedCredentialRequest": {
            this.ciphers = await Promise.all(
              message.existingCipherIds.map(async (cipherId) => {
                const cipher = await this.cipherService.get(cipherId);
                return cipher.decrypt(
                  await this.cipherService.getKeyForCipherKeyDecryption(cipher),
                );
              }),
            );
            this.displayedCiphers = [...this.ciphers];

            if (this.displayedCiphers.length > 0) {
              this.selectedPasskey(this.displayedCiphers[0]);
            }
            break;
          }
        }

        this.subtitleText =
          this.displayedCiphers.length > 0
            ? this.getCredentialSubTitleText(message.type)
            : "noMatchingPasskeyLogin";

        this.credentialText = this.getCredentialButtonText(message.type);
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
        type: "ConnectResponse",
      });
    });
  }

  protected async submit() {
    const data = this.message$.value;
    if (data?.type === "PickCredentialRequest") {
      const userVerified = await this.handleUserVerification(data.userVerification, this.cipher);

      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: "PickCredentialResponse",
        userVerified,
      });
    } else if (data?.type === "ConfirmNewCredentialRequest") {
      if (this.cipher.login.hasFido2Credentials) {
        const confirmed = await this.dialogService.openSimpleDialog({
          title: { key: "overwritePasskey" },
          content: { key: "overwritePasskeyAlert" },
          type: "info",
        });

        if (!confirmed) {
          return false;
        }
      }

      const userVerified = await this.handleUserVerification(data.userVerification, this.cipher);

      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher.id,
        type: "ConfirmNewCredentialResponse",
        userVerified,
      });
    }

    this.loading = true;
  }

  protected async saveNewLogin() {
    const data = this.message$.value;
    if (data?.type === "ConfirmNewCredentialRequest") {
      const name = data.credentialName || data.rpId;
      await this.createNewCipher(name);

      // We are bypassing user verification pending implementation of PIN and biometric support.
      this.send({
        sessionId: this.sessionId,
        cipherId: this.cipher?.id,
        type: "ConfirmNewCredentialResponse",
        userVerified: data.userVerification,
      });
    }

    this.loading = true;
  }

  getCredentialSubTitleText(messageType: string): string {
    return messageType == "ConfirmNewCredentialRequest" ? "choosePasskey" : "logInWithPasskey";
  }

  getCredentialButtonText(messageType: string): string {
    return messageType == "ConfirmNewCredentialRequest" ? "savePasskey" : "confirm";
  }

  selectedPasskey(item: CipherView) {
    this.cipher = item;
  }

  viewPasskey() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/view-cipher"], {
      queryParams: {
        cipherId: this.cipher.id,
        uilocation: "popout",
        senderTabId: this.senderTabId,
        sessionId: this.sessionId,
        singleActionPopout: `${VaultPopoutType.fido2Popout}_${this.sessionId}`,
      },
    });
  }

  addCipher() {
    const data = this.message$.value;

    if (data?.type !== "ConfirmNewCredentialRequest") {
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-cipher"], {
      queryParams: {
        name: data.credentialName || data.rpId,
        uri: this.url,
        uilocation: "popout",
        senderTabId: this.senderTabId,
        sessionId: this.sessionId,
        userVerification: data.userVerification,
        singleActionPopout: `${VaultPopoutType.fido2Popout}_${this.sessionId}`,
      },
    });
  }

  protected async search() {
    this.hasSearched = this.searchService.isSearchable(this.searchText);
    this.searchPending = true;
    if (this.hasSearched) {
      this.displayedCiphers = await this.searchService.searchCiphers(
        this.searchText,
        null,
        this.ciphers,
      );
    } else {
      const equivalentDomains = await firstValueFrom(
        this.domainSettingsService.getUrlEquivalentDomains(this.url),
      );
      this.displayedCiphers = this.ciphers.filter((cipher) =>
        cipher.login.matchesUri(this.url, equivalentDomains),
      );
    }
    this.searchPending = false;
    this.selectedPasskey(this.displayedCiphers[0]);
  }

  abort(fallback: boolean) {
    this.unload(fallback);
    window.close();
  }

  unload(fallback = false) {
    this.send({
      sessionId: this.sessionId,
      type: "AbortResponse",
      fallbackRequested: fallback,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildCipher(name: string) {
    this.cipher = new CipherView();
    this.cipher.name = name;
    this.cipher.type = CipherType.Login;
    this.cipher.login = new LoginView();
    this.cipher.login.uris = [new LoginUriView()];
    this.cipher.login.uris[0].uri = this.url;
    this.cipher.card = new CardView();
    this.cipher.identity = new IdentityView();
    this.cipher.secureNote = new SecureNoteView();
    this.cipher.secureNote.type = SecureNoteType.Generic;
    this.cipher.reprompt = CipherRepromptType.None;
  }

  private async createNewCipher(name: string) {
    this.buildCipher(name);
    const cipher = await this.cipherService.encrypt(this.cipher);
    try {
      await this.cipherService.createWithServer(cipher);
      this.cipher.id = cipher.id;
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async handleUserVerification(
    userVerificationRequested: boolean,
    cipher: CipherView,
  ): Promise<boolean> {
    const masterPasswordRepromptRequired = cipher && cipher.reprompt !== 0;

    if (masterPasswordRepromptRequired) {
      return await this.passwordRepromptService.showPasswordPrompt();
    }

    // We are bypassing user verification pending implementation of PIN and biometric support.
    return userVerificationRequested;
  }

  private send(msg: BrowserFido2Message) {
    BrowserFido2UserInterfaceSession.sendMessage({
      sessionId: this.sessionId,
      ...msg,
    });
  }
}
