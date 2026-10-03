import { createHash, randomUUID, X509Certificate } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";

import {
  app,
  dialog,
  ipcMain,
  type BrowserWindow,
  type Certificate,
  type IpcMainInvokeEvent,
  type WebContents,
} from "electron";

import {
  IdentityMetadata,
  MtlsConfiguration,
  MtlsErrorCode,
  MtlsResult,
  MtlsStatus,
  MtlsView,
} from "../../models/mtls";

import { normalizeChallengeEndpoint, normalizeEndpoint } from "./endpoint";
import { MtlsBackend } from "./mtls-backend";
import { MtlsRegistry } from "./mtls-registry";
import { selectOfferedIdentity } from "./selection";
import { resolveMtlsStoreLocation } from "./store-location";

type SelectionCallback = (certificate?: Certificate) => void;
type ChangeResult = MtlsResult<{ revision: number; restartRequired: true }>;
const DRAFT_LIFETIME_MS = 5 * 60_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface SelectionDiagnostic {
  endpoint?: string;
  offeredCount: number;
  contentsAvailable?: boolean;
  contentsDestroyed?: boolean;
  decision: "unowned-request" | "selected" | "unbound" | MtlsErrorCode;
}

interface SelectionDraft {
  selectionId: string;
  bytes: Buffer;
  fileName: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
  draftId?: string;
  password?: Buffer;
  identity?: IdentityMetadata;
  inspecting?: boolean;
  committing?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mutationError(error: unknown): MtlsErrorCode {
  const message = (error as Error)?.message;
  return message === "conflict" || message === "identity-missing" || message === "invalid-endpoint"
    ? message
    : "storage-failed";
}

/** Installs the read-only selection snapshot before application windows start networking. */
export class MtlsMain {
  private constructor(
    private readonly active: MtlsConfiguration,
    private readonly ownsContents: (contents: WebContents) => boolean,
    private readonly onStatus: (error: MtlsErrorCode) => void,
    private readonly registry?: MtlsRegistry,
    private readonly backend = new MtlsBackend(),
    private readonly trustedSender: (event: IpcMainInvokeEvent) => boolean = () => false,
    private readonly startupError?: MtlsErrorCode,
    private readonly getWindow: () => BrowserWindow | undefined = () => undefined,
    private readonly onSelection: (diagnostic: SelectionDiagnostic) => void = () => {},
  ) {}

  private readonly selections = new Map<number, SelectionDraft>();
  private readonly watchedSenders = new Set<number>();
  private mutationQueue: Promise<unknown> = Promise.resolve();

  static async load(
    userData: string,
    ownsContents: (contents: WebContents) => boolean,
    onStatus: (error: MtlsErrorCode) => void,
    trustedSender: (event: IpcMainInvokeEvent) => boolean = () => false,
    getWindow: () => BrowserWindow | undefined = () => undefined,
    onSelection: (diagnostic: SelectionDiagnostic) => void = () => {},
  ): Promise<MtlsMain> {
    try {
      await resolveMtlsStoreLocation();
      const registry = await MtlsRegistry.load(userData);
      return new MtlsMain(
        registry.active,
        ownsContents,
        onStatus,
        registry,
        new MtlsBackend(),
        trustedSender,
        undefined,
        getWindow,
        onSelection,
      );
    } catch (error) {
      const code =
        (error as Error).message === "store-corrupt"
          ? "store-corrupt"
          : "store-location-unsupported";
      onStatus(code);
      return new MtlsMain(
        { version: 1, revision: 0, storeId: "", identities: {}, bindings: {}, cleanup: [] },
        ownsContents,
        onStatus,
        undefined,
        new MtlsBackend(),
        trustedSender,
        code,
        getWindow,
        onSelection,
      );
    }
  }

  install(): void {
    app.on("select-client-certificate", this.handleSelection);
    app.setClientCertRequestPasswordHandler(async () => {
      this.onStatus("store-password-unsupported");
      return "";
    });
    ipcMain.handle("mtls.status", (event) =>
      this.trustedSender(event)
        ? { ok: true, value: this.status() }
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.list", (event) =>
      this.trustedSender(event) ? this.list() : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.bind", (event, request: unknown) =>
      this.trustedSender(event)
        ? this.serialize(() => this.bind(request))
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.unbind", (event, request: unknown) =>
      this.trustedSender(event)
        ? this.serialize(() => this.unbind(request))
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.remove", (event, request: unknown) =>
      this.trustedSender(event)
        ? this.serialize(() => this.remove(request))
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.chooseFile", (event) =>
      this.trustedSender(event)
        ? this.chooseFile(event)
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.inspect", (event, selectionId: unknown, password: unknown) =>
      this.trustedSender(event)
        ? this.inspect(event, selectionId, password)
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.commit", (event, request: unknown) =>
      this.trustedSender(event)
        ? this.serialize(() => this.commit(event, request))
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.cancelDraft", (event, draftId: unknown) =>
      this.trustedSender(event)
        ? this.cancelDraft(event, draftId)
        : { ok: false, error: { code: "unsupported" } },
    );
    ipcMain.handle("mtls.restart", (event) => {
      if (!this.trustedSender(event)) {
        return { ok: false, error: { code: "unsupported" } };
      }
      setImmediate(() => {
        app.relaunch();
        app.quit();
      });
      return { ok: true, value: undefined };
    });
  }

  dispose(): void {
    app.off("select-client-certificate", this.handleSelection);
    ipcMain.removeHandler("mtls.status");
    ipcMain.removeHandler("mtls.list");
    ipcMain.removeHandler("mtls.bind");
    ipcMain.removeHandler("mtls.unbind");
    ipcMain.removeHandler("mtls.remove");
    ipcMain.removeHandler("mtls.chooseFile");
    ipcMain.removeHandler("mtls.inspect");
    ipcMain.removeHandler("mtls.commit");
    ipcMain.removeHandler("mtls.cancelDraft");
    ipcMain.removeHandler("mtls.restart");
    for (const senderId of this.selections.keys()) {
      this.clearSelection(senderId, true);
    }
  }

  status(): MtlsStatus {
    if (this.startupError) {
      return { state: "unavailable", error: this.startupError };
    }
    return { state: this.registry?.restartRequired ? "restart-pending" : "ready" };
  }

  list(): MtlsResult<MtlsView> {
    if (!this.registry) {
      return { ok: false, error: { code: this.startupError ?? "unsupported" } };
    }
    const pending = this.registry.pending;
    return {
      ok: true,
      value: {
        revision: pending.revision,
        identities: pending.identities,
        bindings: pending.bindings,
        activeBindings: this.active.bindings,
        cleanup: pending.cleanup,
        restartRequired: this.registry.restartRequired,
      },
    };
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.mutationQueue.then(operation);
    this.mutationQueue = task.catch((): void => undefined);
    return task;
  }

  private clearSelection(senderId: number, force = false): void {
    const selection = this.selections.get(senderId);
    if (!selection) {
      return;
    }
    if (selection.committing && !force) {
      return;
    }
    clearTimeout(selection.timer);
    selection.bytes.fill(0);
    selection.password?.fill(0);
    this.selections.delete(senderId);
  }

  private currentSelection(senderId: number): SelectionDraft | undefined {
    const selection = this.selections.get(senderId);
    if (!selection) {
      return undefined;
    }
    if (Date.now() >= selection.expiresAt) {
      this.clearSelection(senderId);
      return undefined;
    }
    return selection;
  }

  private async chooseFile(
    event: IpcMainInvokeEvent,
  ): Promise<MtlsResult<{ selectionId: string; fileName: string }>> {
    if (!this.registry) {
      return { ok: false, error: { code: this.startupError ?? "unsupported" } };
    }
    if (this.currentSelection(event.sender.id)?.committing) {
      return { ok: false, error: { code: "conflict" } };
    }
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      return { ok: false, error: { code: "unsupported" } };
    }
    try {
      const chosen = await dialog.showOpenDialog(window, {
        properties: ["openFile"],
        filters: [{ name: "PKCS#12", extensions: ["p12", "pfx"] }],
      });
      if (!this.trustedSender(event) || event.sender.isDestroyed()) {
        return { ok: false, error: { code: "cancelled" } };
      }
      if (this.currentSelection(event.sender.id)?.committing) {
        return { ok: false, error: { code: "conflict" } };
      }
      if (chosen.canceled || chosen.filePaths.length !== 1) {
        return { ok: false, error: { code: "cancelled" } };
      }
      const handle = await fs.open(chosen.filePaths[0], "r");
      let bytes: Buffer;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_FILE_BYTES) {
          return { ok: false, error: { code: "invalid-file" } };
        }
        bytes = await handle.readFile();
        if (bytes.length !== stat.size || bytes.length > MAX_FILE_BYTES) {
          bytes.fill(0);
          return { ok: false, error: { code: "invalid-file" } };
        }
      } finally {
        await handle.close();
      }
      const senderId = event.sender.id;
      this.clearSelection(senderId);
      const selectionId = randomUUID();
      const timer = setTimeout(() => this.clearSelection(senderId), DRAFT_LIFETIME_MS);
      timer.unref?.();
      const fileName = path.basename(chosen.filePaths[0]);
      this.selections.set(senderId, {
        selectionId,
        bytes,
        fileName,
        expiresAt: Date.now() + DRAFT_LIFETIME_MS,
        timer,
      });
      if (!this.watchedSenders.has(senderId)) {
        this.watchedSenders.add(senderId);
        event.sender.once("destroyed", () => {
          this.clearSelection(senderId);
          this.watchedSenders.delete(senderId);
        });
      }
      return { ok: true, value: { selectionId, fileName } };
    } catch {
      return { ok: false, error: { code: "invalid-file" } };
    }
  }

  private async inspect(
    event: IpcMainInvokeEvent,
    selectionId: unknown,
    password: unknown,
  ): Promise<MtlsResult<{ draftId: string; identity: IdentityMetadata }>> {
    const selection = this.currentSelection(event.sender.id);
    if (
      !selection ||
      selection.inspecting ||
      selection.committing ||
      typeof selectionId !== "string" ||
      selectionId !== selection.selectionId ||
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") < 1 ||
      Buffer.byteLength(password, "utf8") > 4096
    ) {
      return { ok: false, error: { code: "invalid-file" } };
    }
    selection.inspecting = true;
    const bundle = Buffer.from(selection.bytes);
    let result: Awaited<ReturnType<MtlsBackend["inspectBundle"]>>;
    try {
      result = await this.backend.inspectBundle(bundle, password);
    } catch {
      return { ok: false, error: { code: "backend-failed" } };
    } finally {
      bundle.fill(0);
      selection.inspecting = false;
    }
    if (this.currentSelection(event.sender.id) !== selection) {
      return { ok: false, error: { code: "cancelled" } };
    }
    if (result.ok === false) {
      return result;
    }
    try {
      const certificate = new X509Certificate(result.value.certificateDer);
      const fingerprint = createHash("sha256").update(certificate.raw).digest("hex");
      const notBefore = new Date(certificate.validFrom).toISOString();
      const notAfter = new Date(certificate.validTo).toISOString();
      const identity: IdentityMetadata = {
        fingerprint,
        label: selection.fileName.slice(0, 128),
        subject: certificate.subject,
        issuer: certificate.issuer,
        notBefore,
        notAfter,
        importedAt: new Date().toISOString(),
      };
      selection.password?.fill(0);
      selection.password = Buffer.from(password, "utf8");
      selection.identity = identity;
      selection.draftId = randomUUID();
      return { ok: true, value: { draftId: selection.draftId, identity } };
    } catch {
      return { ok: false, error: { code: "unsupported-bundle" } };
    }
  }

  private cancelDraft(event: IpcMainInvokeEvent, draftId: unknown): MtlsResult<void> {
    const selection = this.currentSelection(event.sender.id);
    if (!selection || typeof draftId !== "string" || selection.draftId !== draftId) {
      return { ok: false, error: { code: "invalid-file" } };
    }
    if (selection.committing) {
      return { ok: false, error: { code: "conflict" } };
    }
    this.clearSelection(event.sender.id);
    return { ok: true, value: undefined };
  }

  private async commit(event: IpcMainInvokeEvent, request: unknown): Promise<ChangeResult> {
    if (!this.registry) {
      return { ok: false, error: { code: this.startupError ?? "unsupported" } };
    }
    if (
      !isRecord(request) ||
      typeof request.draftId !== "string" ||
      !Number.isSafeInteger(request.expectedRevision) ||
      !Array.isArray(request.endpointUrls) ||
      request.endpointUrls.length < 1 ||
      request.endpointUrls.length > 32 ||
      !request.endpointUrls.every((url) => typeof url === "string" && url.length <= 2048) ||
      typeof request.replaceExisting !== "boolean"
    ) {
      return { ok: false, error: { code: "invalid-endpoint" } };
    }
    const selection = this.currentSelection(event.sender.id);
    if (
      !selection ||
      selection.draftId !== request.draftId ||
      !selection.identity ||
      !selection.password
    ) {
      return { ok: false, error: { code: "invalid-file" } };
    }
    const pending = this.registry.pending;
    if (pending.revision !== request.expectedRevision) {
      return { ok: false, error: { code: "conflict" } };
    }
    try {
      for (const url of request.endpointUrls as string[]) {
        const endpoint = normalizeEndpoint(url);
        if (
          pending.bindings[endpoint] &&
          pending.bindings[endpoint] !== selection.identity.fingerprint &&
          !request.replaceExisting
        ) {
          return { ok: false, error: { code: "conflict" } };
        }
      }
    } catch {
      return { ok: false, error: { code: "invalid-endpoint" } };
    }
    selection.committing = true;
    try {
      const fingerprint = selection.identity.fingerprint;
      const newlyTracked = !pending.identities[fingerprint] && !this.active.identities[fingerprint];
      let revision = pending.revision;
      if (newlyTracked && !pending.cleanup.includes(fingerprint)) {
        try {
          const prepared = await this.registry.scheduleCleanup(fingerprint, revision);
          revision = prepared.revision;
        } catch (error) {
          return { ok: false, error: { code: mutationError(error) } };
        }
      }
      const bundle = Buffer.from(selection.bytes);
      let imported: Awaited<ReturnType<MtlsBackend["importBundle"]>>;
      try {
        imported = await this.backend.importBundle(
          bundle,
          selection.password.toString("utf8"),
          pending.storeId,
        );
      } catch {
        return { ok: false, error: { code: "backend-failed" } };
      } finally {
        bundle.fill(0);
      }
      if (imported.ok === false) {
        return imported;
      }
      if (
        createHash("sha256").update(imported.value.certificateDer).digest("hex") !== fingerprint
      ) {
        return { ok: false, error: { code: "backend-failed" } };
      }
      try {
        const committed = await this.registry.commitIdentity(
          selection.identity,
          request.endpointUrls as string[],
          revision,
          request.replaceExisting,
        );
        return { ok: true, value: { revision: committed.revision, restartRequired: true } };
      } catch (error) {
        if (newlyTracked) {
          try {
            const deleted = await this.backend.deleteIdentity(fingerprint, pending.storeId);
            if (deleted.ok === true) {
              try {
                await this.registry.completeCleanup(fingerprint, this.registry.pending.revision);
              } catch {
                // The durable cleanup journal remains for startup reconciliation.
              }
            }
          } catch {
            // The durable cleanup journal remains for startup reconciliation.
          }
        }
        return { ok: false, error: { code: mutationError(error) } };
      }
    } finally {
      this.clearSelection(event.sender.id, true);
    }
  }

  private async bind(request: unknown): Promise<ChangeResult> {
    if (!this.registry) {
      return { ok: false, error: { code: this.startupError ?? "unsupported" } };
    }
    if (
      !isRecord(request) ||
      typeof request.fingerprint !== "string" ||
      !/^[0-9a-f]{64}$/.test(request.fingerprint) ||
      !Array.isArray(request.endpointUrls) ||
      request.endpointUrls.length < 1 ||
      request.endpointUrls.length > 32 ||
      !request.endpointUrls.every((url) => typeof url === "string" && url.length <= 2048) ||
      !Number.isSafeInteger(request.expectedRevision) ||
      typeof request.replaceExisting !== "boolean"
    ) {
      return { ok: false, error: { code: "invalid-endpoint" } };
    }
    try {
      const next = await this.registry.bind(
        request.fingerprint,
        request.endpointUrls,
        request.expectedRevision as number,
        request.replaceExisting,
      );
      return { ok: true, value: { revision: next.revision, restartRequired: true } };
    } catch (error) {
      return { ok: false, error: { code: mutationError(error) } };
    }
  }

  private async unbind(request: unknown): Promise<ChangeResult> {
    if (!this.registry) {
      return { ok: false, error: { code: this.startupError ?? "unsupported" } };
    }
    if (
      !isRecord(request) ||
      typeof request.endpointUrl !== "string" ||
      request.endpointUrl.length > 2048 ||
      !Number.isSafeInteger(request.expectedRevision)
    ) {
      return { ok: false, error: { code: "invalid-endpoint" } };
    }
    try {
      const next = await this.registry.unbind(
        request.endpointUrl,
        request.expectedRevision as number,
      );
      return { ok: true, value: { revision: next.revision, restartRequired: true } };
    } catch (error) {
      return { ok: false, error: { code: mutationError(error) } };
    }
  }

  private async remove(request: unknown): Promise<ChangeResult> {
    if (!this.registry) {
      return { ok: false, error: { code: this.startupError ?? "unsupported" } };
    }
    if (
      !isRecord(request) ||
      typeof request.fingerprint !== "string" ||
      !/^[0-9a-f]{64}$/.test(request.fingerprint) ||
      !Number.isSafeInteger(request.expectedRevision)
    ) {
      return { ok: false, error: { code: "invalid-file" } };
    }
    try {
      const next = await this.registry.remove(
        request.fingerprint,
        request.expectedRevision as number,
      );
      return { ok: true, value: { revision: next.revision, restartRequired: true } };
    } catch (error) {
      return { ok: false, error: { code: mutationError(error) } };
    }
  }

  /** Called only after the app holds its single-instance lock and before opening windows. */
  async reconcile(): Promise<void> {
    if (!this.registry) {
      return;
    }
    for (const fingerprint of this.registry.pending.cleanup) {
      const result = await this.backend.deleteIdentity(fingerprint, this.registry.pending.storeId);
      if (result.ok === false) {
        this.onStatus(result.error.code);
        continue;
      }
      try {
        await this.registry.completeCleanup(fingerprint, this.registry.pending.revision);
      } catch {
        this.onStatus("storage-failed");
      }
    }
  }

  private readonly handleSelection = (
    event: Electron.Event,
    contents: WebContents,
    url: string,
    offered: Certificate[],
    callback: SelectionCallback,
  ): void => {
    event.preventDefault();
    let called = false;
    const complete = (certificate?: Certificate) => {
      if (called) {
        return;
      }
      called = true;
      callback(certificate);
    };
    try {
      if (!contents || contents.isDestroyed() || !this.ownsContents(contents)) {
        this.onSelection({
          offeredCount: offered.length,
          decision: "unowned-request",
          contentsAvailable: contents != null,
          contentsDestroyed: contents?.isDestroyed(),
        });
        complete();
        return;
      }
      const selection = selectOfferedIdentity(this.active, url, offered);
      let endpoint: string | undefined;
      try {
        endpoint = normalizeChallengeEndpoint(url);
      } catch {
        // Do not put malformed challenge URLs or their paths in the log.
      }
      this.onSelection({
        endpoint,
        offeredCount: offered.length,
        decision: selection.error ?? (selection.certificate ? "selected" : "unbound"),
      });
      if (selection.error) {
        this.onStatus(selection.error);
      }
      complete(selection.certificate);
    } catch {
      complete();
    }
  };
}
