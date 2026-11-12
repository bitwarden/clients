import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { RotationService } from "@bitwarden/bit-common/pam/rotation";
import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  createPamSdkTestKit,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { registerServeRoutes } from "./serve";

const CONFIG_ID = "88888888-8888-4888-8888-888888888888";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
type Reply = { status?: number; body?: { success: boolean; message?: string; data?: unknown } };

describe("rotation serve routes", () => {
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let handlers: Map<string, Handler>;
  let organization: ReturnType<typeof pamTestOrganization>;

  const call = async (
    key: string,
    ctx: { params?: Record<string, string>; query?: Record<string, string | string[]> } = {},
  ): Promise<Reply> => {
    const response: Reply = {};
    await handlers.get(key)!(
      {
        response,
        params: ctx.params ?? { configId: CONFIG_ID },
        query: ctx.query ?? { organizationid: PAM_TEST_ORGANIZATION_ID },
        request: { body: {} },
      },
      async () => undefined,
    );
    return response;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    const kit = createPamSdkTestKit();
    organization = pamTestOrganization({ type: OrganizationUserType.Admin });
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

  it("registers reads only: delete and rotate stay on the command line, where they need --yes", () => {
    expect([...handlers.keys()].sort()).toEqual([
      "GET /pam/rotation",
      "GET /pam/rotation/:configId",
      "GET /pam/rotation/schedule/:value",
    ]);
    expect(router.post).not.toHaveBeenCalled();
  });

  describe("list", () => {
    it("lists the configs of the organization in the query", async () => {
      const list = jest.spyOn(RotationService.prototype, "list").mockResolvedValue([]);

      const reply = await call("GET /pam/rotation");

      expect(reply.body?.success).toBe(true);
      expect(list).toHaveBeenCalledWith(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID);
    });

    it("uses the first value when the organization id is repeated", async () => {
      const list = jest.spyOn(RotationService.prototype, "list").mockResolvedValue([]);

      await call("GET /pam/rotation", {
        query: { organizationid: [PAM_TEST_ORGANIZATION_ID, "ignored"] },
      });

      expect(list).toHaveBeenCalledWith(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID);
    });

    it.each([
      ["missing", {}],
      ["not a guid", { organizationid: "nope" }],
    ])("rejects an organization id that is %s", async (_name, query) => {
      const list = jest.spyOn(RotationService.prototype, "list");

      const reply = await call("GET /pam/rotation", { query });

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("organization id");
      expect(list).not.toHaveBeenCalled();
    });

    it("refuses a plain member before any SDK call", async () => {
      organization = pamTestOrganization({ type: OrganizationUserType.User });
      const list = jest.spyOn(RotationService.prototype, "list");

      const reply = await call("GET /pam/rotation");

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("permission");
      expect(list).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("rejects a config id that is not a guid before any SDK call", async () => {
      const get = jest.spyOn(RotationService.prototype, "get");

      const reply = await call("GET /pam/rotation/:configId", {
        params: { configId: "nope" },
      });

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("config id");
      expect(get).not.toHaveBeenCalled();
    });

    it("refuses a plain member before any SDK call", async () => {
      organization = pamTestOrganization({ type: OrganizationUserType.User });
      const get = jest.spyOn(RotationService.prototype, "get");

      const reply = await call("GET /pam/rotation/:configId");

      expect(reply.status).toBe(400);
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe("schedule", () => {
    it("resolves a preset through the service", async () => {
      const resolve = jest.spyOn(RotationService.prototype, "resolveSchedule").mockResolvedValue({
        preset: "daily",
        cron: "0 0 * * *",
        likelyQuartz: false,
      } as never);

      const reply = await call("GET /pam/rotation/schedule/:value", {
        params: { value: "daily" },
      });

      expect(resolve).toHaveBeenCalledWith(PAM_TEST_USER_ID, "daily");
      expect(reply.body).toMatchObject({
        success: true,
        data: { preset: "daily", scheduleCron: "0 0 * * *" },
      });
    });
  });
});
