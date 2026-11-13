import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  createPamSdkTestKit,
  PAM_TEST_ORGANIZATION_ID,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";
import type { RotationClient, TargetSystemsClient } from "@bitwarden/sdk-internal";

import type { ServiceContainer } from "../../service-container";

import { registerServeRoutes } from "./serve";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
type Reply = { status?: number; body?: { success: boolean; message?: string } };

const TARGET_ID = "33333333-3333-4333-8333-333333333333";

describe("targets serve routes", () => {
  const targets = mock<TargetSystemsClient>();
  const rotation = mock<RotationClient>();
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let handlers: Map<string, Handler>;
  let organizationType: OrganizationUserType;
  let usePam: boolean;

  const call = async (
    key: string,
    ctx: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown },
  ): Promise<Reply> => {
    const response: Reply = {};
    await handlers.get(key)!(
      { response, params: ctx.params ?? {}, query: ctx.query ?? {}, request: { body: ctx.body } },
      async () => undefined,
    );
    return response;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    const kit = createPamSdkTestKit();
    rotation.target_systems.mockReturnValue(targets);
    kit.pam.rotation.mockReturnValue(rotation);
    organizationType = OrganizationUserType.Admin;
    usePam = true;
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
    organizationService.organizations$.mockImplementation((() =>
      of([pamTestOrganization({ type: organizationType, usePam })])) as never);

    handlers = new Map();
    router.get.mockImplementation(((path: string, h: Handler) => {
      handlers.set(`GET ${path}`, h);
    }) as never);
    router.post.mockImplementation(((path: string, h: Handler) => {
      handlers.set(`POST ${path}`, h);
    }) as never);
    registerServeRoutes(router, container);
  });

  it("registers only GET and POST routes under /pam", () => {
    expect([...handlers.keys()].sort()).toEqual([
      "GET /pam/target",
      "GET /pam/target/template",
      "POST /pam/target",
      "POST /pam/target/:id/delete",
      "POST /pam/target/:id/disable",
      "POST /pam/target/:id/enable",
      "POST /pam/target/:id/update",
    ]);
  });

  it("lists for an admin", async () => {
    targets.list.mockResolvedValue([]);

    const reply = await call("GET /pam/target", {
      query: { organizationid: PAM_TEST_ORGANIZATION_ID },
    });

    expect(reply.body?.success).toBe(true);
    expect(targets.list).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID);
  });

  it("refuses a caller who cannot manage rotation, with status 400", async () => {
    organizationType = OrganizationUserType.User;

    const reply = await call("GET /pam/target", {
      query: { organizationid: PAM_TEST_ORGANIZATION_ID },
    });

    expect(reply.status).toBe(400);
    expect(targets.list).not.toHaveBeenCalled();
  });

  it("refuses an organization that does not use PAM, without an SDK call", async () => {
    usePam = false;

    const reply = await call("GET /pam/target", {
      query: { organizationid: PAM_TEST_ORGANIZATION_ID },
    });

    expect(reply.status).toBe(400);
    expect(reply.body?.message).toBe("This organization does not use Privileged Controls.");
    expect(targets.list).not.toHaveBeenCalled();
  });

  it("refuses a missing organization id", async () => {
    const reply = await call("GET /pam/target", {});

    expect(reply.body?.success).toBe(false);
  });

  it("is unavailable when the connector flag is off", async () => {
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(flag === FeatureFlag.Pam)) as never);

    const reply = await call("GET /pam/target", {
      query: { organizationid: PAM_TEST_ORGANIZATION_ID },
    });

    expect(reply.body?.message).toContain("temporarily unavailable");
  });

  it("delete needs {yes: true} in the body", async () => {
    targets.delete.mockResolvedValue();
    const params = { id: TARGET_ID };
    const query = { organizationid: PAM_TEST_ORGANIZATION_ID };

    const refused = await call("POST /pam/target/:id/delete", { params, query, body: {} });
    expect(refused.body?.success).toBe(false);
    expect(targets.delete).not.toHaveBeenCalled();

    const done = await call("POST /pam/target/:id/delete", { params, query, body: { yes: true } });
    expect(done.body?.success).toBe(true);
    expect(targets.delete).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, TARGET_ID);
  });

  it("enables and disables", async () => {
    targets.enable.mockResolvedValue();
    targets.disable.mockResolvedValue();
    const params = { id: TARGET_ID };
    const query = { organizationid: PAM_TEST_ORGANIZATION_ID };

    await call("POST /pam/target/:id/enable", { params, query });
    await call("POST /pam/target/:id/disable", { params, query });

    expect(targets.enable).toHaveBeenCalledTimes(1);
    expect(targets.disable).toHaveBeenCalledTimes(1);
  });

  it("rejects a create body that is not an object", async () => {
    const reply = await call("POST /pam/target", {
      query: { organizationid: PAM_TEST_ORGANIZATION_ID },
      body: [],
    });

    expect(reply.body?.success).toBe(false);
    expect(targets.create).not.toHaveBeenCalled();
  });

  it("reports the pending id of a create whose seal failed", async () => {
    targets.create.mockRejectedValue({ id: TARGET_ID, message: "seal failed" });

    const reply = await call("POST /pam/target", {
      query: { organizationid: PAM_TEST_ORGANIZATION_ID },
      body: {
        method: "manual",
        name: "x",
        passwordPolicy: {
          minLength: 16,
          maxLength: 32,
          includeUppercase: true,
          includeLowercase: true,
          includeDigits: true,
          includeSymbols: true,
        },
      },
    });

    expect(reply.body?.message).toContain(TARGET_ID);
  });
});
