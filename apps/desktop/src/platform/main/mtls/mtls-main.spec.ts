import { createHash, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";

import { app, dialog, ipcMain } from "electron";

import { MtlsBackend } from "./mtls-backend";
import { MtlsMain } from "./mtls-main";
import { MtlsRegistry } from "./mtls-registry";
import { resolveMtlsStoreLocation } from "./store-location";

jest.mock("electron", () => ({
  app: { on: jest.fn(), off: jest.fn(), setClientCertRequestPasswordHandler: jest.fn() },
  ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
  dialog: { showOpenDialog: jest.fn() },
}));
jest.mock("./mtls-registry", () => ({ MtlsRegistry: { load: jest.fn() } }));
jest.mock("./store-location", () => ({ resolveMtlsStoreLocation: jest.fn() }));

const emptyConfiguration = {
  version: 1,
  revision: 0,
  storeId: "12345678-1234-1234-1234-123456789abc",
  identities: {},
  bindings: {},
  cleanup: [],
};

describe("mTLS main selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(resolveMtlsStoreLocation).mockResolvedValue("/safe/nssdb");
    jest.mocked(MtlsRegistry.load).mockResolvedValue({
      active: emptyConfiguration,
      pending: emptyConfiguration,
      restartRequired: false,
    } as MtlsRegistry);
  });

  it("declines unowned contents exactly once before Chromium can auto-select", async () => {
    const owned = { isDestroyed: () => false };
    const other = { isDestroyed: () => false };
    const main = await MtlsMain.load("/safe/userData", (contents) => contents === owned, jest.fn());
    main.install();
    const listener = jest.mocked(app.on).mock.calls[0][1] as (...args: unknown[]) => void;
    const event = { preventDefault: jest.fn() };
    const callback = jest.fn();

    listener(event, other, "https://vault.example/", [{ data: "unused" }], callback);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(undefined);
    main.dispose();
    expect(app.off).toHaveBeenCalledWith("select-client-certificate", listener);
  });

  it("declines requests if the registry is corrupt", async () => {
    jest.mocked(MtlsRegistry.load).mockRejectedValue(new Error("store-corrupt"));
    const status = jest.fn();
    const contents = { isDestroyed: () => false };
    const main = await MtlsMain.load("/safe/userData", () => true, status);
    main.install();
    const listener = jest.mocked(app.on).mock.calls[0][1] as (...args: unknown[]) => void;
    const callback = jest.fn();

    listener({ preventDefault: jest.fn() }, contents, "https://vault.example/", [], callback);

    expect(status).toHaveBeenCalledWith("store-corrupt");
    expect(callback).toHaveBeenCalledWith(undefined);
  });

  it("declines a challenge without renderer attribution and records that reason", async () => {
    const owner = jest.fn(() => true);
    const diagnostic = jest.fn();
    const main = await MtlsMain.load(
      "/safe/userData",
      owner,
      jest.fn(),
      undefined,
      undefined,
      diagnostic,
    );
    main.install();
    const listener = jest.mocked(app.on).mock.calls[0][1] as (...args: unknown[]) => void;
    const callback = jest.fn();
    listener({ preventDefault: jest.fn() }, null, "vault.example:443", [], callback);
    expect(owner).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(undefined);
    expect(diagnostic).toHaveBeenCalledWith({
      offeredCount: 0,
      decision: "unowned-request",
      contentsAvailable: false,
      contentsDestroyed: undefined,
    });
  });

  it("selects an owned renderer's certificate for Electron's host:port challenge", async () => {
    const data = readFileSync(path.join(__dirname, "fixtures", "test-cert.pem"), "utf8");
    const fingerprint = createHash("sha256").update(new X509Certificate(data).raw).digest("hex");
    const active = {
      ...emptyConfiguration,
      bindings: { "vault.example:443": fingerprint },
      identities: {
        [fingerprint]: {
          fingerprint,
          label: "Test",
          subject: "Test",
          issuer: "Test",
          notBefore: "2020-01-01T00:00:00.000Z",
          notAfter: "2099-01-01T00:00:00.000Z",
          importedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    };
    jest.mocked(MtlsRegistry.load).mockResolvedValue({
      active,
      pending: active,
      restartRequired: false,
    } as MtlsRegistry);
    const contents = { isDestroyed: () => false };
    const diagnostic = jest.fn();
    const main = await MtlsMain.load(
      "/safe/userData",
      () => true,
      jest.fn(),
      undefined,
      undefined,
      diagnostic,
    );
    main.install();
    const listener = jest.mocked(app.on).mock.calls[0][1] as (...args: unknown[]) => void;
    const callback = jest.fn();
    const offered = [{ data }];
    listener({ preventDefault: jest.fn() }, contents, "vault.example:443", offered, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(offered[0]);
    expect(diagnostic).toHaveBeenCalledWith({
      endpoint: "vault.example:443",
      offeredCount: 1,
      decision: "selected",
    });
  });

  it("cancels unexpected protected-token password requests", async () => {
    const status = jest.fn();
    const main = await MtlsMain.load("/safe/userData", () => true, status);
    main.install();
    const handler = jest.mocked(app.setClientCertRequestPasswordHandler).mock.calls[0][0];
    await expect(handler({} as Electron.ClientCertRequestParams)).resolves.toBe("");
    expect(status).toHaveBeenCalledWith("store-password-unsupported");
  });

  it("exposes only public status and bindings to an approved main frame", async () => {
    const sender = {} as Electron.IpcMainInvokeEvent;
    const main = await MtlsMain.load(
      "/safe/userData",
      () => true,
      jest.fn(),
      (event) => event === sender,
    );
    main.install();
    const handlers = new Map(jest.mocked(ipcMain.handle).mock.calls);
    const status = handlers.get("mtls.status") as (event: Electron.IpcMainInvokeEvent) => unknown;
    const list = handlers.get("mtls.list") as (event: Electron.IpcMainInvokeEvent) => unknown;

    expect(status(sender)).toEqual({ ok: true, value: { state: "ready" } });
    expect(list(sender)).toEqual({ ok: true, value: expect.objectContaining({ revision: 0 }) });
    expect(list({} as Electron.IpcMainInvokeEvent)).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("rejects malformed and untrusted binding mutations", async () => {
    const sender = {} as Electron.IpcMainInvokeEvent;
    const main = await MtlsMain.load(
      "/safe/userData",
      () => true,
      jest.fn(),
      (event) => event === sender,
    );
    main.install();
    const handlers = new Map(jest.mocked(ipcMain.handle).mock.calls);
    const bind = handlers.get("mtls.bind") as (
      event: Electron.IpcMainInvokeEvent,
      request: unknown,
    ) => Promise<unknown>;

    await expect(bind(sender, { fingerprint: "../other" })).resolves.toEqual({
      ok: false,
      error: { code: "invalid-endpoint" },
    });
    expect(bind({} as Electron.IpcMainInvokeEvent, {})).toEqual({
      ok: false,
      error: { code: "unsupported" },
    });
  });

  it("ties a file selection and inspected draft to its originating window", async () => {
    const certificateDer = new X509Certificate(
      readFileSync(path.join(__dirname, "fixtures", "test-cert.pem")),
    ).raw;
    const inspectBackend = jest
      .spyOn(MtlsBackend.prototype, "inspectBundle")
      .mockResolvedValue({ ok: true, value: { certificateDer } });
    const chosenPath = path.join(__dirname, "fixtures", "test-cert.pem");
    jest
      .mocked(dialog.showOpenDialog)
      .mockResolvedValue({ canceled: false, filePaths: [chosenPath] });
    const sender = { id: 41, isDestroyed: () => false, once: jest.fn() };
    const event = { sender } as unknown as Electron.IpcMainInvokeEvent;
    const window = { isDestroyed: () => false } as Electron.BrowserWindow;
    const main = await MtlsMain.load(
      "/safe/userData",
      () => true,
      jest.fn(),
      (candidate) => candidate === event,
      () => window,
    );
    main.install();
    const handlers = new Map(jest.mocked(ipcMain.handle).mock.calls);
    const choose = handlers.get("mtls.chooseFile") as (
      event: Electron.IpcMainInvokeEvent,
    ) => Promise<any>;
    const inspect = handlers.get("mtls.inspect") as (
      event: Electron.IpcMainInvokeEvent,
      selectionId: string,
      password: string,
    ) => Promise<any>;
    const cancel = handlers.get("mtls.cancelDraft") as (
      event: Electron.IpcMainInvokeEvent,
      draftId: string,
    ) => unknown;

    const selected = await choose(event);
    expect(selected).toEqual({ ok: true, value: expect.anything() });
    expect((await inspect(event, "wrong-id", "secret")).ok).toBe(false);
    const draft = await inspect(event, selected.value.selectionId, "secret");
    expect(draft.value.identity.subject).toContain("localhost");
    expect(inspectBackend).toHaveBeenCalledTimes(1);
    expect(cancel(event, draft.value.draftId)).toEqual({ ok: true, value: undefined });
    expect((await inspect(event, selected.value.selectionId, "secret")).ok).toBe(false);
    inspectBackend.mockRestore();
  });

  it("journals a new identity before backend import and commits one binding revision", async () => {
    const certificateDer = new X509Certificate(
      readFileSync(path.join(__dirname, "fixtures", "test-cert.pem")),
    ).raw;
    const inspectBackend = jest
      .spyOn(MtlsBackend.prototype, "inspectBundle")
      .mockResolvedValue({ ok: true, value: { certificateDer } });
    const importBackend = jest
      .spyOn(MtlsBackend.prototype, "importBundle")
      .mockResolvedValue({ ok: true, value: { certificateDer } });
    const registry = {
      active: emptyConfiguration,
      pending: { ...emptyConfiguration },
      restartRequired: false,
      scheduleCleanup: jest.fn(async (fingerprint: string) => {
        registry.pending = { ...registry.pending, revision: 1, cleanup: [fingerprint] };
        return registry.pending;
      }),
      commitIdentity: jest.fn(async () => ({ ...registry.pending, revision: 2 })),
    };
    jest.mocked(MtlsRegistry.load).mockResolvedValue(registry as unknown as MtlsRegistry);
    jest.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [path.join(__dirname, "fixtures", "test-cert.pem")],
    });
    const sender = { id: 42, isDestroyed: () => false, once: jest.fn() };
    const event = { sender } as unknown as Electron.IpcMainInvokeEvent;
    const main = await MtlsMain.load(
      "/safe/userData",
      () => true,
      jest.fn(),
      (candidate) => candidate === event,
      () => ({ isDestroyed: () => false }) as Electron.BrowserWindow,
    );
    main.install();
    const handlers = new Map(jest.mocked(ipcMain.handle).mock.calls);
    const choose = handlers.get("mtls.chooseFile") as (
      event: Electron.IpcMainInvokeEvent,
    ) => Promise<any>;
    const inspect = handlers.get("mtls.inspect") as (
      event: Electron.IpcMainInvokeEvent,
      selectionId: string,
      password: string,
    ) => Promise<any>;
    const commit = handlers.get("mtls.commit") as (
      event: Electron.IpcMainInvokeEvent,
      request: unknown,
    ) => Promise<any>;

    const selected = await choose(event);
    const draft = await inspect(event, selected.value.selectionId, "secret");
    const result = await commit(event, {
      draftId: draft.value.draftId,
      expectedRevision: 0,
      endpointUrls: ["https://vault.example/api"],
      replaceExisting: false,
    });

    expect(result).toEqual({ ok: true, value: { revision: 2, restartRequired: true } });
    expect(registry.scheduleCleanup).toHaveBeenCalledWith(draft.value.identity.fingerprint, 0);
    expect(registry.scheduleCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      importBackend.mock.invocationCallOrder[0],
    );
    expect(registry.commitIdentity).toHaveBeenCalledWith(
      draft.value.identity,
      ["https://vault.example/api"],
      1,
      false,
    );
    inspectBackend.mockRestore();
    importBackend.mockRestore();
  });
});
