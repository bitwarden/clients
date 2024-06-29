import {
  BehaviorSubject,
  EmptyError,
  filter,
  firstValueFrom,
  fromEvent,
  fromEventPattern,
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

import { BrowserApi } from "../../platform/browser/browser-api";
import { closeFido2Popout, openFido2Popout } from "../popup/utils/vault-popout-window";

const BrowserFido2MessageName = "BrowserFido2UserInterfaceServiceMessage";

export class SessionClosedError extends Error {
  constructor() {
    super("Fido2UserInterfaceSession was closed");
  }
}

export type BrowserFido2Message = { sessionId: string } & (
  | /**
   * This message is used by popouts to announce that they are ready
   * to recieve messages.
   **/ {
      type: "ConnectResponse";
    }
  /**
   * This message is used to announce the creation of a new session.
   * It is used by popouts to know when to close.
   **/
  | {
      type: "NewSessionCreatedRequest";
    }
  | {
      type: "PickCredentialRequest";
      cipherIds: string[];
      userVerification: boolean;
      fallbackSupported: boolean;
    }
  | {
      type: "PickCredentialResponse";
      cipherId?: string;
      userVerified: boolean;
    }
  | {
      type: "ConfirmNewCredentialRequest";
      credentialName: string;
      userName: string;
      userHandle: string;
      userVerification: boolean;
      fallbackSupported: boolean;
      rpId: string;
    }
  | {
      type: "ConfirmNewCredentialResponse";
      cipherId: string;
      userVerified: boolean;
    }
  | {
      type: "InformExcludedCredentialRequest";
      existingCipherIds: string[];
      fallbackSupported: boolean;
    }
  | {
      type: "InformCredentialNotFoundRequest";
      fallbackSupported: boolean;
    }
  | {
      type: "AbortRequest";
    }
  | {
      type: "AbortResponse";
      fallbackRequested: boolean;
    }
);

/**
 * Browser implementation of the {@link Fido2UserInterfaceService}.
 * The user interface is implemented as a popout and the service uses the browser's messaging API to communicate with it.
 */
export class BrowserFido2UserInterfaceService implements Fido2UserInterfaceServiceAbstraction {
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
      type: "AbortResponse",
      fallbackRequested: fallbackRequested,
    });
  }

  static confirmNewCredentialResponse(sessionId: string, cipherId: string, userVerified: boolean) {
    this.sendMessage({
      sessionId: sessionId,
      type: "ConfirmNewCredentialResponse",
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
        filter((msg) => msg.type === "ConnectResponse"),
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
          type: "AbortRequest",
          sessionId: this.sessionId,
        });
      });

    // Handle session aborted by user
    this.messages$
      .pipe(
        filter((msg) => msg.type === "AbortResponse"),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe((msg) => {
        if (msg.type === "AbortResponse") {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.close();
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.abort(msg.fallbackRequested);
        }
      });

    this.windowClosed$ = fromEventPattern(
      // FIXME: Make sure that is does not cause a memory leak in Safari or use BrowserApi.AddListener
      // and test that it doesn't break. Tracking Ticket: https://bitwarden.atlassian.net/browse/PM-4735
      // eslint-disable-next-line no-restricted-syntax
      (handler: any) => chrome.windows.onRemoved.addListener(handler),
      (handler: any) => chrome.windows.onRemoved.removeListener(handler),
    );

    BrowserFido2UserInterfaceSession.sendMessage({
      type: "NewSessionCreatedRequest",
      sessionId,
    });
  }

  async pickCredential({
    cipherIds,
    userVerification,
  }: PickCredentialParams): Promise<{ cipherId: string; userVerified: boolean }> {
    const data: BrowserFido2Message = {
      type: "PickCredentialRequest",
      cipherIds,
      sessionId: this.sessionId,
      userVerification,
      fallbackSupported: this.fallbackSupported,
    };

    await this.send(data);
    const response = await this.receive("PickCredentialResponse");

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
      type: "ConfirmNewCredentialRequest",
      sessionId: this.sessionId,
      credentialName,
      userName,
      userHandle,
      userVerification,
      fallbackSupported: this.fallbackSupported,
      rpId,
    };

    await this.send(data);
    const response = await this.receive("ConfirmNewCredentialResponse");

    return { cipherId: response.cipherId, userVerified: response.userVerified };
  }

  async informExcludedCredential(existingCipherIds: string[]): Promise<void> {
    const data: BrowserFido2Message = {
      type: "InformExcludedCredentialRequest",
      sessionId: this.sessionId,
      existingCipherIds,
      fallbackSupported: this.fallbackSupported,
    };

    await this.send(data);
    await this.receive("AbortResponse");
  }

  async ensureUnlockedVault(): Promise<void> {
    if ((await this.authService.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
      await this.connect();
    }
  }

  async informCredentialNotFound(): Promise<void> {
    const data: BrowserFido2Message = {
      type: "InformCredentialNotFoundRequest",
      sessionId: this.sessionId,
      fallbackSupported: this.fallbackSupported,
    };

    await this.send(data);
    await this.receive("AbortResponse");
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
