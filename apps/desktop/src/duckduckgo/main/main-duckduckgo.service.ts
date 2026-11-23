import { ipcMain } from "electron";
import { Subject, filter, takeUntil, firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { ipc } from "@bitwarden/desktop-napi";

import { DDGCommandBody, DDGInbound, DDGSessionKey, DuckDuckGoResponder } from "..";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { NativeMessagingMain } from "../../main/native-messaging.main";
import { WindowMain } from "../../main/window.main";
import { DDG_IPC_CHANNELS } from "../../models/native-messaging/ddg-ipc-channels";
import { DecryptedCommandData } from "../../models/native-messaging/decrypted-command-data";

import { EncryptedMessageHandlerService } from "./encrypted-message-handler.service";

const DDG_SHARED_KEY = "DuckDuckGoSharedKey";

/** Shows the dialog for one request. Resolves once the renderer has been asked. */
type ShowVerifyDialog = (requestId: number, applicationName: string) => Promise<void>;

/**
 * The renderer's verify dialog, asked over one IPC channel and answered over another.
 *
 * Electron has no main-to-renderer request, so each ask carries an id that its answer quotes and
 * several can be outstanding at once.
 */
class VerifyDialog {
  private readonly pending = new Map<number, (accepted: boolean) => void>();
  private lastRequestId = 0;

  constructor(private readonly show: ShowVerifyDialog) {
    ipcMain.handle(
      DDG_IPC_CHANNELS.VERIFY_REQUEST_RESPONSE,
      async (_, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.pending.get(requestId)?.(accepted);
        this.pending.delete(requestId);
      },
    );
  }

  /** Asks the user about `applicationName` and resolves with their answer. */
  async ask(applicationName: string): Promise<boolean> {
    const requestId = ++this.lastRequestId;
    const answered = new Promise<boolean>((resolve) => {
      this.pending.set(requestId, resolve);
    });

    await this.show(requestId, applicationName);

    return await answered;
  }
}

/**
 * Serves DuckDuckGo's native messaging browser integration from main.
 *
 * The protocol itself lives in {@link DuckDuckGoResponder}. This class wires it to the native
 * messaging socket, the renderer's verify dialog, the vault commands and the stored session key.
 */
export class MainDuckDuckGoService {
  private readonly responder: DuckDuckGoResponder;
  private readonly verifyDialog: VerifyDialog;
  private destroy$ = new Subject<void>();

  constructor(
    private readonly flagEnabled: boolean,
    private readonly logService: LogService,
    private readonly secureStorageService: AbstractStorageService,
    private readonly desktopAutofillSettingsService: DesktopAutofillSettingsService,
    private readonly encryptedMessageHandlerService: EncryptedMessageHandlerService,
    private readonly nativeMessagingMain: NativeMessagingMain,
    private readonly windowMain: WindowMain,
    private readonly messagingService: MessageSender,
  ) {
    this.responder = this.createDDGProtocolResponder();
    this.verifyDialog = new VerifyDialog((requestId, applicationName) =>
      this.showVerifyDialog(requestId, applicationName),
    );
  }

  /** Restores the stored session before the first message can arrive. */
  async init(): Promise<void> {
    await this.restoreSession();

    this.nativeMessagingMain.messages$
      .pipe(
        // Answers nothing while the renderer owns the DuckDuckGo protocol.
        filter(() => this.flagEnabled),
        filter((msg) => msg.kind === ipc.IpcMessageType.Message && msg.message != null),
        takeUntil(this.destroy$),
      )
      .subscribe((msg) => {
        this.handleRawMessage(msg.message!).catch((e: unknown) => {
          this.logService.error("[DuckDuckGo] Failed to handle a message", e);
        });
      });
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createDDGProtocolResponder(): DuckDuckGoResponder {
    return new DuckDuckGoResponder({
      confirmPairing: (applicationName) => this.confirmPairing(applicationName),
      runCommand: (body) => this.runCommand(body),
    });
  }

  /** Without the stored key every launch would re-show the pairing dialog. */
  private async restoreSession(): Promise<void> {
    const stored = await this.loadKey();
    if (stored == null) {
      return;
    }

    this.responder.resume(stored);
  }

  private async loadKey(): Promise<DDGSessionKey | undefined> {
    const stored = await this.secureStorageService.get<string>(DDG_SHARED_KEY);

    return stored == null ? undefined : DDGSessionKey.fromBase64(stored);
  }

  private async saveKey(sessionKey: DDGSessionKey): Promise<void> {
    await this.secureStorageService.save(DDG_SHARED_KEY, sessionKey.toBase64());
  }

  private async handleRawMessage(raw: string): Promise<void> {
    let message: DDGInbound;
    try {
      message = JSON.parse(raw) as DDGInbound;
    } catch {
      return;
    }

    // The socket also carries the general browser integration and the SDK's own IPC, neither of
    // which has a version field.
    if (message.version == null) {
      return;
    }

    // PureCrypto is WebAssembly, and generating a session key needs it loaded.
    await SdkLoadService.Ready;

    const response = await this.responder.handle(message);
    if (response == null) {
      return;
    }

    const sessionKey = this.responder.pairedKey;
    if (sessionKey != null) {
      await this.saveKey(sessionKey);
    }

    this.nativeMessagingMain.send(response);
  }

  private async confirmPairing(applicationName: string): Promise<boolean> {
    const integrationEnabled = await firstValueFrom(
      this.desktopAutofillSettingsService.enableDuckDuckGoBrowserIntegration$,
    );
    if (!integrationEnabled) {
      return false;
    }

    return await this.verifyDialog.ask(applicationName);
  }

  /** Recreates the renderer if it was destroyed. The only step of the flow that needs UI. */
  private async showVerifyDialog(requestId: number, applicationName: string): Promise<void> {
    // Without the renderer the dialog can never be answered, so DuckDuckGo would just hang.
    await this.windowMain.ensureRenderer();

    this.messagingService.send(DDG_IPC_CHANNELS.VERIFY_REQUEST, { requestId, applicationName });
  }

  /** Runs a decrypted command against the vault. A failure answers with an empty payload. */
  private async runCommand(body: DDGCommandBody): Promise<unknown> {
    try {
      return await this.encryptedMessageHandlerService.responseDataForCommand(
        body as DecryptedCommandData,
      );
    } catch (e: unknown) {
      this.logService.error("[DuckDuckGo] Failed to handle an encrypted command", e);
      return {};
    }
  }
}
