import { createHash } from "crypto";
import { readFileSync } from "fs";
import * as path from "path";

import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { DeviceType } from "@bitwarden/common/enums";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import {
  ApproveOpenShellResolveParams,
  ApproveOpenShellResolveResult,
} from "../components/approve-openshell-resolve.component";
import { AgentAccessGrant } from "../models/agent-access-grant";
import { OpenShellApprovalLifetime } from "../models/openshell";

import {
  AgentAccessOpenShellService,
  OPENSHELL_DETAIL_DIGEST_MISMATCH,
  OPENSHELL_DETAIL_HIDDEN_PASSWORD,
  OPENSHELL_DETAIL_MISSING_CONTEXT,
  OPENSHELL_DETAIL_OFF,
  OPENSHELL_DETAIL_REPROMPT,
} from "./agent-access-openshell.service";
import { AgentAccessSecretsService } from "./agent-access-secrets.service";

const FIXTURE_DIR = path.join(
  __dirname,
  "../../../desktop_native/agent_access/tests/fixtures/openshell",
);
const vectors = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, "openshell-digest-vectors.json"), "utf8"),
);
const requestFixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, "openshell-resolve.request.json"), "utf8"),
);

const NOW = 1_791_230_967_890;
const USER_ID = "user-1" as UserId;
const ITEM_ID = "3f1c2b9e-8a4d-4c7e-9b21-5d6f7a8b9c0d";
const SECRET_ID = "a7e2d4c1-6b3f-4e8a-9d10-2c5b6a7f8e9d";
const DIGEST = vectors.vectors[0].digest as string;
const OTHER_DIGEST = vectors.vectors[1].digest as string;

/** The fixture request as main forwards it (napi camelCase). */
function message(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const os = requestFixture.openshell;
  return {
    requestId: 7,
    origin: "openshell",
    operation: "providerResolve",
    receivedAtMs: NOW,
    localPeer: {
      pid: 2,
      processName: "aac",
      exePath: "/opt/homebrew/bin/aac",
      parent: {
        pid: 1,
        processName: "openshell-gateway",
        exePath: "/opt/homebrew/bin/openshell-gateway",
      },
      signature: { kind: "macosTeamId", identity: "TEAM:openshell-gateway", valid: true },
    },
    openshell: {
      deadlineMs: os.deadlineMs,
      gatewayName: os.gateway.name,
      gatewayEndpoint: os.gateway.endpoint,
      providerId: os.provider.id,
      providerName: os.provider.name,
      providerProfile: os.provider.profile,
      workspace: os.provider.workspace,
      sandboxId: os.sandbox.id,
      sandboxName: os.sandbox.name,
      sandboxImage: os.sandbox.image,
      endpoints: os.endpoints,
      policyDigest: os.policy.digest,
      advisorEnabled: os.policy.advisorEnabled,
    },
    providerTargets: os.targets.map((target: Record<string, string>) => ({
      credentialKey: target.credentialKey,
      resourceType: target.resource === "item" ? "credential" : "secret",
      id: target.id,
      field: target.field,
    })),
    ...overrides,
  };
}

function loginCipher(overrides: Partial<CipherView> = {}): CipherView {
  return {
    id: ITEM_ID,
    name: "GitHub bot",
    type: CipherType.Login,
    isDeleted: false,
    isArchived: false,
    reprompt: CipherRepromptType.None,
    viewPassword: true,
    login: { username: "bot", password: "fixture-password" },
    ...overrides,
  } as unknown as CipherView;
}

function grant(details: Partial<NonNullable<AgentAccessGrant["openshell"]>>): AgentAccessGrant {
  return {
    id: "g1",
    signatureKind: "macosTeamId",
    signatureIdentity: "TEAM:openshell-gateway",
    displayName: "openshell-gateway",
    scope: "openshellSandbox",
    createdAt: 1,
    lastUsedAt: 1,
    openshell: {
      gatewayEndpoint: "https://127.0.0.1:17670",
      sandboxId: "sbx-01J9Z6",
      providerId: "prov-7f3a",
      gatewayName: "openshell",
      sandboxName: "agent-1",
      providerName: "gh-agent-1",
      policyDigest: DIGEST,
      lifetimeMode: "ttl",
      windowExpiresAtMs: NOW + 3_600_000,
      ...details,
    },
  };
}

describe("AgentAccessOpenShellService (§M8.9)", () => {
  let service: AgentAccessOpenShellService;
  let enabled$: BehaviorSubject<boolean>;
  let lifetime$: BehaviorSubject<OpenShellApprovalLifetime>;
  let cipherService: MockProxy<CipherService>;
  let secrets: MockProxy<AgentAccessSecretsService>;
  let dialogService: { open: jest.Mock };
  let dialogResult: ApproveOpenShellResolveResult | undefined;
  let openedParams: ApproveOpenShellResolveParams | undefined;
  let findGrant: jest.Mock;
  let upsertGrant: jest.Mock;
  let eventCollection: MockProxy<EventCollectionService>;
  let originalIpc: unknown;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    enabled$ = new BehaviorSubject(true);
    lifetime$ = new BehaviorSubject<OpenShellApprovalLifetime>({ mode: "ttl", ttlMinutes: 60 });
    cipherService = mock<CipherService>();
    cipherService.getAllDecrypted.mockResolvedValue([loginCipher()]);
    secrets = mock<AgentAccessSecretsService>();
    secrets.findSecrets.mockResolvedValue([
      { secretId: SECRET_ID, name: "DB password", organizationId: "org-1" },
    ]);
    secrets.getSecretValue.mockResolvedValue({
      secretId: SECRET_ID,
      name: "DB password",
      value: "fixture-secret",
      organizationId: "org-1",
    });
    dialogResult = "approved";
    openedParams = undefined;
    dialogService = {
      open: jest.fn((_component: unknown, config: { data: ApproveOpenShellResolveParams }) => {
        openedParams = config.data;
        return { closed: of(dialogResult) };
      }),
    };
    findGrant = jest.fn().mockResolvedValue(null);
    upsertGrant = jest.fn().mockImplementation(async (input) => ({ id: "g1", ...input }));
    eventCollection = mock<EventCollectionService>();

    const crypto = mock<CryptoFunctionService>();
    crypto.hash.mockImplementation(async (value) => {
      return new Uint8Array(
        createHash("sha256")
          .update(Buffer.from(value as Uint8Array))
          .digest(),
      ) as Uint8Array<ArrayBuffer>;
    });
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      platform: {
        deviceType: DeviceType.MacOsDesktop,
        isSnapStore: false,
        isAppImage: false,
        focusWindow: jest.fn(),
      },
      agentAccess: { findGrant, upsertGrant },
    };

    TestBed.configureTestingModule({
      providers: [
        AgentAccessOpenShellService,
        {
          provide: DesktopSettingsService,
          useValue: {
            agentAccessOpenShellEnabled$: enabled$,
            agentAccessOpenShellApprovalLifetime$: lifetime$,
          },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: AgentAccessSecretsService, useValue: secrets },
        { provide: DialogService, useValue: dialogService },
        { provide: CryptoFunctionService, useValue: crypto },
        { provide: I18nService, useValue: i18n },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: EventCollectionService, useValue: eventCollection },
        { provide: MessageSender, useValue: mock<MessageSender>() },
      ],
    });
    service = TestBed.inject(AgentAccessOpenShellService);
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
  });

  /** `handle`, then what the caller does once main confirms delivery. */
  async function handleDelivered(m: Record<string, unknown> = message()) {
    const result = await service.handle(m, USER_ID);
    await result.onDelivered?.();
    return result;
  }

  /** Only the item target (no post-approval network fetch). */
  function itemOnlyMessage(): Record<string, unknown> {
    const m = message();
    m.providerTargets = (m.providerTargets as Array<{ resourceType: string }>).filter(
      (target) => target.resourceType === "credential",
    );
    return m;
  }

  function expectNoDialog() {
    expect(dialogService.open).not.toHaveBeenCalled();
  }

  function expectNoValues(response: { openshellValues?: unknown; openshellLifetime?: unknown }) {
    expect(response.openshellValues).toBeUndefined();
    expect(response.openshellLifetime).toBeUndefined();
  }

  describe("refusals before any dialog", () => {
    it("errors when the setting is off", async () => {
      enabled$.next(false);
      const { response } = await service.handle(message(), USER_ID);
      expect(response).toEqual({
        approved: false,
        reason: "error",
        denialDetail: OPENSHELL_DETAIL_OFF,
      });
      expectNoDialog();
    });

    it.each([
      ["Windows", { deviceType: DeviceType.WindowsDesktop }],
      ["Snap", { isSnapStore: true }],
      ["AppImage", { isAppImage: true }],
    ])("errors on %s", async (_label, platform) => {
      Object.assign((global as any).ipc.platform, platform);
      const { response } = await service.handle(message(), USER_ID);
      expect(response.denialDetail).toBe(OPENSHELL_DETAIL_OFF);
      expectNoDialog();
    });

    it.each([
      ["parent", (m: any) => delete m.localPeer.parent],
      ["signature", (m: any) => delete m.localPeer.signature],
      ["context", (m: any) => delete m.openshell],
      ["targets", (m: any) => delete m.providerTargets],
      [
        "empty targets",
        (m: any): void => {
          m.providerTargets = [];
        },
      ],
    ])("errors when the %s is missing", async (_label, strip) => {
      const m = message();
      strip(m);
      const { response } = await service.handle(m, USER_ID);
      expect(response).toEqual({
        approved: false,
        reason: "error",
        denialDetail: OPENSHELL_DETAIL_MISSING_CONTEXT,
      });
      expectNoDialog();
    });

    it("errors on a digest that doesn't match the displayed endpoints", async () => {
      const m = message();
      (m.openshell as any).endpoints = vectors.vectors[1].endpoints;
      (m.openshell as any).policyDigest = DIGEST;
      const { response } = await service.handle(m, USER_ID);
      expect(response.denialDetail).toBe(OPENSHELL_DETAIL_DIGEST_MISMATCH);
      expectNoDialog();
    });

    it("accepts the second golden vector when its digest matches", async () => {
      const m = message();
      (m.openshell as any).endpoints = vectors.vectors[1].endpoints;
      (m.openshell as any).policyDigest = OTHER_DIGEST;
      const { response } = await service.handle(m, USER_ID);
      expect(response.approved).toBe(true);
    });

    it("returns notFound for a missing item, with no dialog", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([]);
      const { response, outcome } = await service.handle(message(), USER_ID);
      expect(response).toEqual({ approved: false, reason: "notFound" });
      expect(outcome.status).toBe("not_found");
      expectNoDialog();
    });

    it.each([
      ["deleted", { isDeleted: true }],
      ["archived", { isArchived: true }],
      ["not a login", { type: CipherType.SecureNote }],
      ["empty password", { login: { username: "bot", password: "" } }],
    ])("returns notFound for a %s item", async (_label, change) => {
      cipherService.getAllDecrypted.mockResolvedValue([loginCipher(change as Partial<CipherView>)]);
      const { response } = await service.handle(message(), USER_ID);
      expect(response.reason).toBe("notFound");
      expectNoDialog();
    });

    it("returns notFound for a missing secret, with no dialog", async () => {
      secrets.findSecrets.mockResolvedValue([]);
      const { response } = await service.handle(message(), USER_ID);
      expect(response.reason).toBe("notFound");
      expectNoDialog();
    });

    it("denies a master-password-reprompt item, with no dialog", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([
        loginCipher({ reprompt: CipherRepromptType.Password }),
      ]);
      const { response } = await service.handle(message(), USER_ID);
      expect(response).toEqual({
        approved: false,
        reason: "denied",
        denialDetail: OPENSHELL_DETAIL_REPROMPT,
      });
      expectNoDialog();
    });

    it("denies an item whose password is hidden from the user, with no dialog", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([loginCipher({ viewPassword: false })]);
      const { response } = await service.handle(message(), USER_ID);
      expect(response).toEqual({
        approved: false,
        reason: "denied",
        denialDetail: OPENSHELL_DETAIL_HIDDEN_PASSWORD,
      });
      expectNoDialog();
    });

    it("still releases the username of an item whose password is hidden", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([loginCipher({ viewPassword: false })]);
      const m = itemOnlyMessage();
      (m.providerTargets as Array<{ field: string }>)[0].field = "username";
      const { response } = await service.handle(m, USER_ID);
      expect(response.approved).toBe(true);
      expect(response.openshellValues).toEqual([{ credentialKey: "GITHUB_TOKEN", value: "bot" }]);
    });

    it("times out without a dialog when too little of the deadline is left", async () => {
      const { response } = await service.handle(message({ receivedAtMs: NOW - 23_000 }), USER_ID);
      expect(response).toEqual({ approved: false, reason: "timeout" });
      expectNoDialog();
    });

    it("never fetches a secret value before approval", async () => {
      dialogResult = "denied";
      await service.handle(message(), USER_ID);
      expect(secrets.getSecretValue).not.toHaveBeenCalled();
    });
  });

  describe("dialog mode", () => {
    async function modeFor(found: AgentAccessGrant | null) {
      findGrant.mockResolvedValue(found);
      await service.handle(message(), USER_ID);
      return openedParams!;
    }

    it("is firstRequest without a grant, and looks the grant up by the OpenShell key", async () => {
      expect((await modeFor(null)).mode).toBe("firstRequest");
      expect(findGrant).toHaveBeenCalledWith({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAM:openshell-gateway",
        openshell: {
          gatewayEndpoint: "https://127.0.0.1:17670",
          sandboxId: "sbx-01J9Z6",
          providerId: "prov-7f3a",
        },
      });
    });

    it("is policyChanged when the digest differs, carrying the previous digest", async () => {
      const params = await modeFor(grant({ policyDigest: OTHER_DIGEST }));
      expect(params.mode).toBe("policyChanged");
      expect(params.previousPolicyDigest).toBe(OTHER_DIGEST);
    });

    it("is windowExpired when a ttl window ends within 30 s", async () => {
      expect((await modeFor(grant({ windowExpiresAtMs: NOW + 29_000 }))).mode).toBe(
        "windowExpired",
      );
      expect((await modeFor(grant({ windowExpiresAtMs: NOW - 1 }))).mode).toBe("windowExpired");
    });

    it("is previouslyApproved inside an open ttl window", async () => {
      expect((await modeFor(grant({}))).mode).toBe("previouslyApproved");
    });

    it.each([["sandboxLifetime"], ["perRequest"]] as const)(
      "is windowExpired for an expired ttl grant under a %s setting",
      async (settingMode) => {
        lifetime$.next({ mode: settingMode, ttlMinutes: 60 });
        const params = await modeFor(grant({ windowExpiresAtMs: NOW - 1 }));
        expect(params.mode).toBe("windowExpired");
      },
    );

    it("is previouslyApproved for a grant under a non-ttl setting", async () => {
      lifetime$.next({ mode: "sandboxLifetime", ttlMinutes: 60 });
      expect(
        (await modeFor(grant({ lifetimeMode: "sandboxLifetime", windowExpiresAtMs: undefined })))
          .mode,
      ).toBe("previouslyApproved");
    });

    it("shows names and context but never values in the dialog params", async () => {
      const params = await modeFor(null);
      expect(params.targets).toEqual([
        {
          credentialKey: "GITHUB_TOKEN",
          label: "GitHub bot",
          fieldLabel: "agentAccessOpenShellFieldPassword",
        },
        {
          credentialKey: "DB_PASSWORD",
          label: "DB password",
          fieldLabel: "agentAccessOpenShellFieldSecret",
        },
      ]);
      expect(JSON.stringify(params)).not.toContain("fixture-password");
      expect(JSON.stringify(params)).not.toContain("fixture-secret");
      // A secret target is fetched after Approve, so the decision is due 5 s early (24 s reply-by
      // − 5 s), and the coalesced dialog lingers 15 s past that for a retry (§M8.18).
      expect(params.deadlineMs).toBe(19_000 + 15_000);
      expect(params.gatewayIdentity).toEqual({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAM:openshell-gateway",
        exePath: "/opt/homebrew/bin/openshell-gateway",
        signatureValid: true,
      });
    });
  });

  describe("dialog deadline and lifetime preview", () => {
    it("uses the whole reply deadline plus the retry linger when no secret has to be fetched", async () => {
      await service.handle(itemOnlyMessage(), USER_ID);
      // Reply-by 24 s (25 s − 1 s margin) + 15 s linger (§M8.18).
      expect(openedParams!.deadlineMs).toBe(24_000 + 15_000);
    });

    it("states only the window end for a reused ttl window, never the setting's duration", async () => {
      findGrant.mockResolvedValue(grant({ windowExpiresAtMs: NOW + 200_000 }));
      await service.handle(message(), USER_ID);
      expect(openedParams!.mode).toBe("previouslyApproved");
      expect(openedParams!.lifetime).toEqual({
        mode: "ttl",
        expiresAtMs: NOW + 200_000,
        reusedWindow: true,
      });
    });

    it("does not reuse a ttl window that could end before a carried reply uses it", async () => {
      // 30 s builder floor + 60 s dialog + 60 s carry + 10 s dedupe = 160 s.
      findGrant.mockResolvedValue(grant({ windowExpiresAtMs: NOW + 160_000 }));
      await service.handle(message(), USER_ID);
      expect(openedParams!.mode).toBe("windowExpired");
    });

    it("states the duration when approving opens a new ttl window", async () => {
      await service.handle(message(), USER_ID);
      expect(openedParams!.lifetime).toEqual({
        mode: "ttl",
        expiresAtMs: NOW + 3_600_000,
        ttlMinutes: 60,
      });
    });
  });

  describe("delivery", () => {
    it("persists no grant and records no release until delivery is confirmed", async () => {
      const result = await service.handle(message(), USER_ID);
      expect(result.response.approved).toBe(true);
      expect(upsertGrant).not.toHaveBeenCalled();
      expect(eventCollection.collect).not.toHaveBeenCalled();
      await result.onDelivered!();
      expect(upsertGrant).toHaveBeenCalledTimes(1);
      expect(eventCollection.collect).toHaveBeenCalled();
    });

    it("times out with no values and nothing to record when the fetch outlasts the deadline", async () => {
      secrets.getSecretValue.mockImplementation(async () => {
        // The fetch finishes after Rust's own timeout (deadline from receivedAtMs, minus margin).
        (Date.now as jest.Mock).mockReturnValue(NOW + 24_500);
        return {
          secretId: SECRET_ID,
          name: "DB password",
          value: "fixture-secret",
          organizationId: "org-1",
        };
      });
      const result = await service.handle(message(), USER_ID);
      expect(result.response).toEqual({ approved: false, reason: "timeout" });
      expect(result.onDelivered).toBeUndefined();
      expect(upsertGrant).not.toHaveBeenCalled();
    });

    it("has nothing to record for a denial", async () => {
      dialogResult = "denied";
      const result = await service.handle(message(), USER_ID);
      expect(result.onDelivered).toBeUndefined();
    });
  });

  describe("approval", () => {
    it("returns values in target order with a perRequest expiry of now + 120 s", async () => {
      lifetime$.next({ mode: "perRequest", ttlMinutes: 60 });
      const { response, outcome } = await handleDelivered();
      expect(response).toEqual({
        approved: true,
        openshellValues: [
          { credentialKey: "GITHUB_TOKEN", value: "fixture-password" },
          { credentialKey: "DB_PASSWORD", value: "fixture-secret" },
        ],
        openshellLifetime: { mode: "perRequest", expiresAtMs: `${NOW + 120_000}` },
      });
      expect(outcome).toEqual({ status: "shared" });
      expect(secrets.getSecretValue).toHaveBeenCalledWith(SECRET_ID, "org-1", USER_ID);
    });

    it("reuses an open ttl window without extending it", async () => {
      findGrant.mockResolvedValue(grant({ windowExpiresAtMs: NOW + 1_000_000 }));
      const { response } = await handleDelivered();
      expect(response.openshellLifetime).toEqual({
        mode: "ttl",
        expiresAtMs: `${NOW + 1_000_000}`,
      });
      expect(upsertGrant.mock.calls[0][0].openshell.windowExpiresAtMs).toBe(NOW + 1_000_000);
    });

    it("opens a new ttl window of now + ttlMinutes and persists it", async () => {
      lifetime$.next({ mode: "ttl", ttlMinutes: 240 });
      const { response } = await handleDelivered();
      expect(response.openshellLifetime).toEqual({
        mode: "ttl",
        expiresAtMs: `${NOW + 240 * 60_000}`,
      });
      expect(upsertGrant).toHaveBeenCalledWith({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAM:openshell-gateway",
        displayName: "openshell-gateway",
        exePath: "/opt/homebrew/bin/openshell-gateway",
        scope: "openshellSandbox",
        openshell: {
          gatewayEndpoint: "https://127.0.0.1:17670",
          sandboxId: "sbx-01J9Z6",
          providerId: "prov-7f3a",
          gatewayName: "openshell",
          sandboxName: "agent-1",
          providerName: "gh-agent-1",
          policyDigest: DIGEST,
          lifetimeMode: "ttl",
          windowExpiresAtMs: NOW + 240 * 60_000,
        },
      });
    });

    it("sends no expiry for sandboxLifetime", async () => {
      lifetime$.next({ mode: "sandboxLifetime", ttlMinutes: 60 });
      const { response } = await handleDelivered();
      expect(response.openshellLifetime).toEqual({ mode: "sandboxLifetime" });
      expect(upsertGrant.mock.calls[0][0].openshell).not.toHaveProperty("windowExpiresAtMs");
    });

    it("records a release event for the released item", async () => {
      await handleDelivered();
      expect(eventCollection.collect).toHaveBeenCalledWith(expect.anything(), ITEM_ID, true);
    });

    it("errors (no values) when the approved secret can't be fetched", async () => {
      secrets.getSecretValue.mockRejectedValue(new Error("boom"));
      const { response } = await handleDelivered();
      expect(response.approved).toBe(false);
      expect(response.reason).toBe("error");
      expectNoValues(response);
    });
  });

  describe("deny, timeout, close", () => {
    it.each([
      ["denied", "denied"],
      ["timeout", "timeout"],
      [undefined, "denied"],
    ])("result %s replies %s with no values", async (result, reason) => {
      dialogResult = result as ApproveOpenShellResolveResult | undefined;
      const { response, outcome } = await service.handle(message(), USER_ID);
      expect(response).toEqual({ approved: false, reason });
      expect(outcome.status).toBe("denied");
      expect(upsertGrant).not.toHaveBeenCalled();
    });
  });

  describe("§M8.18 coalescing", () => {
    /** A dialog the test answers by hand. */
    let answer: (result: ApproveOpenShellResolveResult | undefined) => void;
    let dialogClose: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["Date"] });
      dialogClose = jest.fn();
      dialogService.open.mockImplementation(
        (_component: unknown, config: { data: ApproveOpenShellResolveParams }) => {
          openedParams = config.data;
          const closed = new Subject<ApproveOpenShellResolveResult | undefined>();
          answer = (result) => {
            closed.next(result);
            closed.complete();
          };
          return { closed, close: dialogClose };
        },
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const settle = () => jest.advanceTimersByTimeAsync(0);
    const at = (offsetMs: number) => (Date.now as jest.Mock).mockReturnValue(NOW + offsetMs);

    /** A fresh request as main would forward it `offsetMs` after NOW. */
    function retry(offsetMs: number, overrides: Record<string, unknown> = {}) {
      return message({ receivedAtMs: NOW + offsetMs, requestId: 100 + offsetMs, ...overrides });
    }

    it("attaches an identical request to the open dialog and answers both from one approval", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(1);

      at(2_000);
      const second = service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW + 2_000 }, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(1);

      answer("approved");
      const [a, b] = await Promise.all([first, second]);
      expect(a.response.approved).toBe(true);
      expect(b.response.approved).toBe(true);
      expect(a.response.openshellLifetime).toEqual(b.response.openshellLifetime);

      // Both delivered: the grant and the release event are written once.
      await a.onDelivered!();
      await b.onDelivered!();
      expect(upsertGrant).toHaveBeenCalledTimes(1);
      expect(eventCollection.collect).toHaveBeenCalledTimes(1);
    });

    it("extends the open dialog's countdown when a later retry attaches", async () => {
      const updates: number[] = [];
      void service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      openedParams!.deadlineUpdates!.subscribe((ms) => updates.push(ms));
      at(5_000);
      void service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW + 5_000 }, USER_ID);
      await settle();
      // New reply-by 29 s + 15 s linger, seen from 5 s in.
      expect(updates).toEqual([39_000]);
      answer("denied");
      await settle();
    });

    it("times a request out at its own deadline while the dialog stays open, then carries the approval to the next retry", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      at(24_001);
      await jest.advanceTimersByTimeAsync(24_000);
      const timedOut = await first;
      expect(timedOut.response).toEqual({ approved: false, reason: "timeout" });
      expect(dialogClose).not.toHaveBeenCalled();

      // The user approves after the first request gave up: nothing is sent, nothing recorded…
      answer("approved");
      await settle();
      await timedOut.holdUntil;
      expect(upsertGrant).not.toHaveBeenCalled();

      // …and the supervisor's retry is answered at once, with no new dialog.
      at(30_000);
      const next = await service.handle(
        { ...itemOnlyMessage(), receivedAtMs: NOW + 30_000 },
        USER_ID,
      );
      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(next.response.approved).toBe(true);
      expect(next.response.openshellValues).toEqual([
        { credentialKey: "GITHUB_TOKEN", value: "fixture-password" },
      ]);
      await next.onDelivered!();
      expect(upsertGrant).toHaveBeenCalledTimes(1);
      expect(eventCollection.collect).toHaveBeenCalledTimes(1);
    });

    it("re-resolves values for a carried approval instead of reusing any", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      const a = await first;
      // Delivery failed (main said false): the approval stays carried.
      expect(a.response.approved).toBe(true);

      cipherService.getAllDecrypted.mockResolvedValue([
        loginCipher({ login: { username: "bot", password: "rotated" } } as Partial<CipherView>),
      ]);
      at(5_000);
      const b = await service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW + 5_000 }, USER_ID);
      expect(b.response.openshellValues).toEqual([
        { credentialKey: "GITHUB_TOKEN", value: "rotated" },
      ]);
    });

    it("expires a carried approval after the carry window", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      await first;
      at(60_001);
      void service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW + 60_001 }, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
      answer("denied");
      await settle();
    });

    it("carries a denial for the window: a retry after Deny is denied with no dialog", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("denied");
      expect((await first).response).toEqual({ approved: false, reason: "denied" });

      at(10_000);
      const next = await service.handle(
        { ...itemOnlyMessage(), receivedAtMs: NOW + 10_000 },
        USER_ID,
      );
      expect(next.response).toEqual({ approved: false, reason: "denied" });
      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(cipherService.getAllDecrypted).toHaveBeenCalledTimes(2);
    });

    it("carries nothing from an unanswered dialog", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("timeout");
      expect((await first).response.reason).toBe("timeout");
      at(1_000);
      void service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW + 1_000 }, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
      answer("denied");
      await settle();
    });

    it.each([
      ["sandbox", { sandboxId: "sbx-other" }],
      ["sandbox name", { sandboxName: "agent-2" }],
      ["provider", { providerId: "prov-other" }],
      ["gateway endpoint", { gatewayEndpoint: "https://127.0.0.1:1" }],
    ])("never reuses a decision across a different %s", async (_label, change) => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      await first;

      const other = itemOnlyMessage();
      other.openshell = { ...(other.openshell as object), ...change };
      void service.handle(other, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
      answer("denied");
      await settle();
    });

    it("never reuses a decision across a different target set or policy digest", async () => {
      const first = service.handle(message(), USER_ID);
      await settle();
      answer("approved");
      await first;

      void service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
      answer("denied");
      await settle();

      const otherDigest = message();
      otherDigest.openshell = {
        ...(otherDigest.openshell as object),
        endpoints: vectors.vectors[1].endpoints,
        policyDigest: OTHER_DIGEST,
      };
      void service.handle(otherDigest, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(3);
      answer("denied");
      await settle();
    });

    it("never reuses a decision for another account", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      await first;
      void service.handle(itemOnlyMessage(), "user-2" as UserId);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
      answer("denied");
      await settle();
    });

    it("answers the second resolve of a delivered load without a dialog, within 10 s only", async () => {
      lifetime$.next({ mode: "perRequest", ttlMinutes: 60 });
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      const delivered = await first;
      at(3_000);
      await delivered.onDelivered!();
      expect(upsertGrant).toHaveBeenCalledTimes(1);

      at(12_000);
      const second = await service.handle(
        { ...itemOnlyMessage(), receivedAtMs: NOW + 12_000 },
        USER_ID,
      );
      expect(second.response.approved).toBe(true);
      // Same approval, same expiry: approved at NOW, usable until NOW + 120 s.
      expect(second.response.openshellLifetime).toEqual({
        mode: "perRequest",
        expiresAtMs: `${NOW + 120_000}`,
      });
      await second.onDelivered!();
      expect(upsertGrant).toHaveBeenCalledTimes(1);
      expect(eventCollection.collect).toHaveBeenCalledTimes(1);
      expect(dialogService.open).toHaveBeenCalledTimes(1);

      // 10 s after the delivery the dedupe window is over: the next load asks again.
      at(13_001);
      void service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW + 13_001 }, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);
      answer("denied");
      await settle();
    });

    it("resetCoalescing drops carried decisions and closes an open dialog", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      await first;
      service.resetCoalescing();
      void service.handle({ ...itemOnlyMessage(), receivedAtMs: NOW }, USER_ID);
      await settle();
      expect(dialogService.open).toHaveBeenCalledTimes(2);

      const waiting = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      service.resetCoalescing();
      expect(dialogClose).toHaveBeenCalled();
      expect((await waiting).response).toEqual({ approved: false, reason: "timeout" });
      // Whatever the closed dialog reports afterwards is ignored.
      answer("approved");
      await settle();
      expect(service.canAnswerWithoutQueue(itemOnlyMessage(), USER_ID)).toBe(false);
    });

    it("reports identical requests as answerable outside the queue, and only those", async () => {
      expect(service.canAnswerWithoutQueue(itemOnlyMessage(), USER_ID)).toBe(false);
      void service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      expect(service.canAnswerWithoutQueue(retry(1_000, {}), USER_ID)).toBe(false); // other targets
      expect(service.canAnswerWithoutQueue(itemOnlyMessage(), USER_ID)).toBe(true);
      expect(service.canAnswerWithoutQueue({ origin: "openshell" }, USER_ID)).toBe(false);
      answer("denied");
      await settle();
    });

    it("never opens a dialog for a request handled outside the queue", async () => {
      const result = await service.handle(itemOnlyMessage(), USER_ID, { mayOpenDialog: false });
      expect(result.response).toEqual({ approved: false, reason: "timeout" });
      expectNoDialog();
    });

    it("still answers a short-deadline retry from a carried decision", async () => {
      const first = service.handle(itemOnlyMessage(), USER_ID);
      await settle();
      answer("approved");
      await first;
      // 2.5 s deadline: far too short for a new dialog, but the decision is already made.
      const short = message({ receivedAtMs: NOW });
      short.providerTargets = itemOnlyMessage().providerTargets;
      short.openshell = { ...(short.openshell as object), deadlineMs: 2_500 };
      const result = await service.handle(short, USER_ID);
      expect(result.response.approved).toBe(true);
      expect(dialogService.open).toHaveBeenCalledTimes(1);
    });
  });
});
