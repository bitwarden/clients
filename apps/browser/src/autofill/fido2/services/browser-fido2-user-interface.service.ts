// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  BehaviorSubject,
  EmptyError,
  filter,
  firstValueFrom,
  fromEvent,
  map,
  merge,
  Observable,
  Subject,
  switchMap,
  take,
  takeUntil,
  throwError,
} from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserRequestedFallbackAbortReason } from "@bitwarden/common/platform/abstractions/fido2/fido2-client.service.abstraction";
import {
  Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction,
  Fido2UserInterfaceSession,
  NewCredentialParams,
  PickCredentialParams,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { fromChromeEvent } from "../../../platform/browser/from-chrome-event";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { closeFido2Popout, openFido2Popout } from "../../../vault/popup/utils/vault-popout-window";

const BrowserFido2MessageName = "BrowserFido2UserInterfaceServiceMessage";

export const BrowserFido2MessageTypes = {
  ConnectResponse: "ConnectResponse",
  NewSessionCreatedRequest: "NewSessionCreatedRequest",
  PickCredentialRequest: "PickCredentialRequest",
  PickCredentialResponse: "PickCredentialResponse",
  ConfirmNewCredentialRequest: "ConfirmNewCredentialRequest",
  ConfirmNewCredentialResponse: "ConfirmNewCredentialResponse",
  InformExcludedCredentialRequest: "InformExcludedCredentialRequest",
  InformCredentialNotFoundRequest: "InformCredentialNotFoundRequest",
  AbortRequest: "AbortRequest",
  AbortResponse: "AbortResponse",
} as const;

export type BrowserFido2MessageTypeValue =
  (typeof BrowserFido2MessageTypes)[keyof typeof BrowserFido2MessageTypes];

export class SessionClosedError extends Error {
  constructor() {
    super("Fido2UserInterfaceSession was closed");
  }
}

export type BrowserFido2Message = { sessionId: string } & (
  | /**
   * This message is used by popouts to announce that they are ready
   * to receive messages.
   **/ {
      type: typeof BrowserFido2MessageTypes.ConnectResponse;
    }
  /**
   * This message is used to announce the creation of a new session.
   * It is used by popouts to know when to close.
   **/
  | {
      type: typeof BrowserFido2MessageTypes.NewSessionCreatedRequest;
    }
  | {
      type: typeof BrowserFido2MessageTypes.PickCredentialRequest;
      cipherIds: string[];
      userVerification: boolean;
      fallbackSupported: boolean;
    }
  | {
      type: typeof BrowserFido2MessageTypes.PickCredentialResponse;
      cipherId?: string;
      userVerified: boolean;
    }
  | {
      type: typeof BrowserFido2MessageTypes.ConfirmNewCredentialRequest;
      credentialName: string;
      userName: string;
      userHandle: string;
      userVerification: boolean;
      fallbackSupported: boolean;
      rpId: string;
    }
  | {
      type: typeof BrowserFido2MessageTypes.ConfirmNewCredentialResponse;
      cipherId: string;
      userVerified: boolean;
    }
  | {
      type: typeof BrowserFido2MessageTypes.InformExcludedCredentialRequest;
      existingCipherIds: string[];
      fallbackSupported: boolean;
    }
  | {
      type: typeof BrowserFido2MessageTypes.InformCredentialNotFoundRequest;
      fallbackSupported: boolean;
    }
  | {
      type: typeof BrowserFido2MessageTypes.AbortRequest;
    }
  | {
      type: typeof BrowserFido2MessageTypes.AbortResponse;
      fallbackRequested: boolean;
    }
);

export type BrowserFido2ParentWindowReference = chrome.tabs.Tab;

/**
 * Browser implementation of the {@link Fido2UserInterfaceService}.
 * The user interface is implemented as a popout and the service uses the browser's messaging API to communicate with it.
 */
export class BrowserFido2UserInterfaceService
  implements Fido2UserInterfaceServiceAbstraction<BrowserFido2ParentWindowReference>
{
  constructor(private authService: AuthService) {}

  async newSession(
    fallbackSupported: boolean,
    tab: chrome.tabs.Tab,
    abortController?: AbortController,
  ): Promise<Fido2UserInterfaceSession> {
    return await BrowserFido2UserInterfaceSession.create(
      this.authService,
      fallbackSupported,
      tab,
      abortController,
    );
  }
}

export class BrowserFido2UserInterfaceSession implements Fido2UserInterfaceSession {
  static async create(
    authService: AuthService,
    fallbackSupported: boolean,
    tab: chrome.tabs.Tab,
    abortController?: AbortController,
  ): Promise<BrowserFido2UserInterfaceSession> {
    return new BrowserFido2UserInterfaceSession(
      authService,
      fallbackSupported,
      tab,
      abortController,
    );
  }

  static sendMessage(msg: BrowserFido2Message) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.sendMessage(BrowserFido2MessageName, msg);
  }

  static abortPopout(sessionId: string, fallbackRequested = false) {
    this.sendMessage({
      sessionId: sessionId,
      type: BrowserFido2MessageTypes.AbortResponse,
      fallbackRequested: fallbackRequested,
    });
  }

  static confirmNewCredentialResponse(sessionId: string, cipherId: string, userVerified: boolean) {
    this.sendMessage({
      sessionId: sessionId,
      type: BrowserFido2MessageTypes.ConfirmNewCredentialResponse,
      cipherId,
      userVerified,
    });
  }

  private closed = false;
  private messages$ = (BrowserApi.messageListener$() as Observable<BrowserFido2Message>).pipe(
    filter((msg) => msg.sessionId === this.sessionId),
  );
  private connected$ = new BehaviorSubject(false);
  private windowClosed$: Observable<number>;
  private destroy$ = new Subject<void>();

  private constructor(
    private readonly authService: AuthService,
    private readonly fallbackSupported: boolean,
    private readonly tab: chrome.tabs.Tab,
    readonly abortController = new AbortController(),
    readonly sessionId = Utils.newGuid(),
  ) {
    this.messages$
      .pipe(
        filter((msg) => msg.type === BrowserFido2MessageTypes.ConnectResponse),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.connected$.next(true);
      });

    // Handle session aborted by RP
    fromEvent(abortController.signal, "abort")
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.close();
        BrowserFido2UserInterfaceSession.sendMessage({
          type: BrowserFido2MessageTypes.AbortRequest,
          sessionId: this.sessionId,
        });
      });

    // Handle session aborted by user
    this.messages$
      .pipe(
        filter((msg) => msg.type === BrowserFido2MessageTypes.AbortResponse),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe((msg) => {
        if (msg.type === BrowserFido2MessageTypes.AbortResponse) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.close();
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.abort(msg.fallbackRequested);
        }
      });

    this.windowClosed$ = fromChromeEvent(chrome.windows.onRemoved).pipe(
      map(([windowId]) => windowId),
    );

    BrowserFido2UserInterfaceSession.sendMessage({
      type: BrowserFido2MessageTypes.NewSessionCreatedRequest,
      sessionId,
    });
  }

  async pickCredential({
    cipherIds,
    userVerification,
    assumeUserPresence,
    masterPasswordRepromptRequired,
  }: PickCredentialParams): Promise<{ cipherId: string; userVerified: boolean }> {
    // NOTE: For now, we are defaulting to a userVerified status of `true` when the request
    // is for a conditionally mediated authentication. This will allow for mediated conditional
    // authentication to function without requiring user interaction. This is a product
    // decision, rather than a decision based on the expected technical specifications.
    if (assumeUserPresence && cipherIds.length === 1 && !masterPasswordRepromptRequired) {
      return { cipherId: cipherIds[0], userVerified: userVerification };
    }

    const data: BrowserFido2Message = {
      type: BrowserFido2MessageTypes.PickCredentialRequest,
      cipherIds,
      sessionId: this.sessionId,
      userVerification,
      fallbackSupported: this.fallbackSupported,
    };

    await this.send(data);
    const response = await this.receive(BrowserFido2MessageTypes.PickCredentialResponse);

    return { cipherId: response.cipherId, userVerified: response.userVerified };
  }

  async confirmNewCredential({
    credentialName,
    userName,
    userHandle,
    userVerification,
    rpId,
  }: NewCredentialParams): Promise<{ cipherId: string; userVerified: boolean }> {
    const data: BrowserFido2Message = {
      type: BrowserFido2MessageTypes.ConfirmNewCredentialRequest,
      sessionId: this.sessionId,
      credentialName,
      userName,
      userHandle,
      userVerification,
      fallbackSupported: this.fallbackSupported,
      rpId,
    };

    await this.send(data);
    const response = await this.receive(BrowserFido2MessageTypes.ConfirmNewCredentialResponse);

    return { cipherId: response.cipherId, userVerified: response.userVerified };
  }

  async informExcludedCredential(existingCipherIds: string[]): Promise<void> {
    const data: BrowserFido2Message = {
      type: BrowserFido2MessageTypes.InformExcludedCredentialRequest,
      sessionId: this.sessionId,
      existingCipherIds,
      fallbackSupported: this.fallbackSupported,
    };

    await this.send(data);
    await this.receive(BrowserFido2MessageTypes.AbortResponse);
  }

  async ensureUnlockedVault(): Promise<void> {
    if ((await this.authService.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
      await this.connect();
    }
  }

  async informCredentialNotFound(): Promise<void> {
    const data: BrowserFido2Message = {
      type: BrowserFido2MessageTypes.InformCredentialNotFoundRequest,
      sessionId: this.sessionId,
      fallbackSupported: this.fallbackSupported,
    };

    await this.send(data);
    await this.receive(BrowserFido2MessageTypes.AbortResponse);
  }

  async close() {
    await closeFido2Popout(this.sessionId);
    this.closed = true;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async abort(fallback = false) {
    this.abortController.abort(fallback ? UserRequestedFallbackAbortReason : undefined);
  }

  private async send(msg: BrowserFido2Message): Promise<void> {
    if (!this.connected$.value) {
      await this.connect();
    }
    BrowserFido2UserInterfaceSession.sendMessage(msg);
  }

  private async receive<T extends BrowserFido2Message["type"]>(
    type: T,
  ): Promise<BrowserFido2Message & { type: T }> {
    try {
      const response = await firstValueFrom(
        this.messages$.pipe(
          filter((msg) => msg.sessionId === this.sessionId && msg.type === type),
          takeUntil(this.destroy$),
        ),
      );
      return response as BrowserFido2Message & { type: T };
    } catch (error) {
      if (error instanceof EmptyError) {
        throw new SessionClosedError();
      }
      throw error;
    }
  }

  private async connect(): Promise<void> {
    if (this.closed) {
      throw new Error("Cannot re-open closed session");
    }

    const connectPromise = firstValueFrom(
      merge(
        this.connected$.pipe(filter((connected) => connected === true)),
        fromEvent(this.abortController.signal, "abort").pipe(
          switchMap(() => throwError(() => new SessionClosedError())),
        ),
      ),
    );

    const popoutId = await openFido2Popout(this.tab, {
      sessionId: this.sessionId,
      fallbackSupported: this.fallbackSupported,
    });

    this.windowClosed$
      .pipe(
        filter((windowId) => {
          return popoutId === windowId;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.close();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.abort(true);
      });

    await connectPromise;
  }
}
