import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LeasesService } from "@bitwarden/bit-common/pam/leases";
import {
  PAM_TEST_USER_ID,
  createPamSdkTestKit,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { registerServeRoutes } from "./serve";

const LEASE_ID = "55555555-5555-4555-8555-555555555555";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
type Reply = { status?: number; body?: { success: boolean; message?: string; data?: unknown } };

describe("leases serve routes", () => {
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let handlers: Map<string, Handler>;
  let organization: ReturnType<typeof pamTestOrganization>;

  const call = async (
    key: string,
    ctx: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<Reply> => {
    const response: Reply = {};
    await handlers.get(key)!(
      {
        response,
        params: { leaseId: LEASE_ID },
        query: ctx.query ?? {},
        request: { body: ctx.body },
      },
      async () => undefined,
    );
    return response;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    const kit = createPamSdkTestKit();
    organization = pamTestOrganization();
    Object.assign(container, {
      sdkService: kit.sdkService,
      accountService: kit.accountService,
      logService: kit.logService,
      configService,
      keyService,
      organizationService,
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    keyService.hasUserKey.mockResolvedValue(true);
    organizationService.organizations$.mockImplementation((() => of([organization])) as never);

    handlers = new Map();
    router.get.mockImplementation(((path: string, h: Handler) => {
      handlers.set(`GET ${path}`, h);
    }) as never);
    router.post.mockImplementation(((path: string, h: Handler) => {
      handlers.set(`POST ${path}`, h);
    }) as never);
    registerServeRoutes(router, container);
  });

  afterEach(() => jest.restoreAllMocks());

  it("registers only list, extend and end", () => {
    expect([...handlers.keys()].sort()).toEqual([
      "GET /pam/lease",
      "POST /pam/lease/:leaseId/end",
      "POST /pam/lease/:leaseId/extend",
    ]);
  });

  it("has no reveal route, because a reveal returns a secret", async () => {
    expect([...handlers.keys()].filter((k) => /reveal/i.test(k))).toEqual([]);
  });

  describe("end", () => {
    const key = "POST /pam/lease/:leaseId/end";

    it("refuses without yes and ends nothing", async () => {
      const end = jest.spyOn(LeasesService.prototype, "end");

      for (const body of [undefined, {}, { yes: false }, { yes: "true" }, { reason: "done" }]) {
        const reply = await call(key, { body });

        expect(reply.status).toBe(400);
        expect(reply.body?.message).toContain('"yes": true');
      }
      expect(end).not.toHaveBeenCalled();
    });

    it("ends the lease with yes and passes the reason from the body", async () => {
      const end = jest.spyOn(LeasesService.prototype, "end").mockResolvedValue(LEASE_ID);

      const reply = await call(key, { body: { yes: true, reason: "done" } });

      expect(reply.body).toMatchObject({
        success: true,
        data: { leaseId: LEASE_ID, status: "ended" },
      });
      expect(end).toHaveBeenCalledWith(PAM_TEST_USER_ID, LEASE_ID, "done");
    });

    it("passes no reason when the body has a non-string one", async () => {
      const end = jest.spyOn(LeasesService.prototype, "end").mockResolvedValue(LEASE_ID);

      await call(key, { body: { yes: true, reason: 5 } });

      expect(end).toHaveBeenCalledWith(PAM_TEST_USER_ID, LEASE_ID, undefined);
    });

    it("refuses an organization that does not use PAM before anything else", async () => {
      organization = pamTestOrganization({ usePam: false });
      const end = jest.spyOn(LeasesService.prototype, "end");

      const reply = await call(key, { body: { yes: true } });

      expect(reply.status).toBe(400);
      expect(end).not.toHaveBeenCalled();
    });
  });

  describe("extend", () => {
    const key = "POST /pam/lease/:leaseId/extend";

    it("extends with a duration and a reason, parsing the duration to seconds", async () => {
      const extend = jest
        .spyOn(LeasesService.prototype, "extend")
        .mockResolvedValue({ leaseId: LEASE_ID, status: "extended" } as never);

      const reply = await call(key, { body: { duration: "30m", reason: "still working" } });

      expect(reply.body?.success).toBe(true);
      expect(extend).toHaveBeenCalledWith(PAM_TEST_USER_ID, LEASE_ID, 1800, "still working");
    });

    it("accepts a numeric duration as seconds", async () => {
      const extend = jest
        .spyOn(LeasesService.prototype, "extend")
        .mockResolvedValue({ leaseId: LEASE_ID, status: "extended" } as never);

      await call(key, { body: { duration: 600, reason: "r" } });

      expect(extend).toHaveBeenCalledWith(PAM_TEST_USER_ID, LEASE_ID, 600, "r");
    });

    it.each([
      ["a missing duration", { reason: "r" }, "duration"],
      ["a missing reason", { duration: "5m" }, "reason"],
      ["an unparseable duration", { duration: "soon", reason: "r" }, "duration"],
      ["a zero duration", { duration: "0", reason: "r" }, "greater than zero"],
      ["a duration over a year", { duration: "366d", reason: "r" }, "365 days"],
    ])("rejects %s without calling the service", async (_name, body, message) => {
      const extend = jest.spyOn(LeasesService.prototype, "extend");

      const reply = await call(key, { body });

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain(message);
      expect(extend).not.toHaveBeenCalled();
    });

    it("refuses a member without a seat", async () => {
      organization = pamTestOrganization({ accessPam: false });
      const extend = jest.spyOn(LeasesService.prototype, "extend");

      const reply = await call(key, { body: { duration: "5m", reason: "r" } });

      expect(reply.status).toBe(400);
      expect(extend).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("lists all leases by default and only active ones with active=true", async () => {
      const list = jest.spyOn(LeasesService.prototype, "list").mockResolvedValue([]);

      await call("GET /pam/lease");
      await call("GET /pam/lease", { query: { active: "true" } });

      expect(list).toHaveBeenNthCalledWith(1, PAM_TEST_USER_ID, false);
      expect(list).toHaveBeenNthCalledWith(2, PAM_TEST_USER_ID, true);
    });

    it("refuses an organization that does not use PAM", async () => {
      organization = pamTestOrganization({ usePam: false });
      const list = jest.spyOn(LeasesService.prototype, "list");

      const reply = await call("GET /pam/lease");

      expect(reply.status).toBe(400);
      expect(list).not.toHaveBeenCalled();
    });
  });
});
