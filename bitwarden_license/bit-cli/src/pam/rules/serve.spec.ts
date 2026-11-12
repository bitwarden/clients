import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccessRulesService } from "@bitwarden/bit-common/pam/rules";
import { PamSdkService } from "@bitwarden/bit-common/pam/shared/pam-sdk.service";
import {
  createPamSdkTestKit,
  PAM_TEST_ORGANIZATION_ID,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { registerServeRoutes } from "./serve";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
type Reply = { status?: number; body?: { success: boolean; message?: string } };

const RULE_ID = "44444444-4444-4444-8444-444444444444";

describe("rules serve routes", () => {
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let handlers: Map<string, Handler>;
  let organization: ReturnType<typeof pamTestOrganization>;
  let list: jest.SpyInstance;
  let get: jest.SpyInstance;
  let bypassable: jest.SpyInstance;

  const call = async (
    key: string,
    query: Record<string, string>,
    body: unknown = {},
  ): Promise<Reply> => {
    const response: Reply = {};
    await handlers.get(key)!(
      { response, params: { ruleId: RULE_ID }, query, request: { body } },
      async () => undefined,
    );
    return response;
  };
  const query = { organizationid: PAM_TEST_ORGANIZATION_ID };

  beforeEach(() => {
    jest.resetAllMocks();
    const kit = createPamSdkTestKit();
    organization = pamTestOrganization({ type: OrganizationUserType.Owner, usePam: false });
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
    list = jest.spyOn(AccessRulesService.prototype, "list");
    get = jest.spyOn(AccessRulesService.prototype, "get");
    bypassable = jest.spyOn(AccessRulesService.prototype, "bypassable");

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

  it.each(["GET /pam/rule", "GET /pam/rule/:ruleId", "GET /pam/rule/:ruleId/bypassable"])(
    "refuses %s when the organization does not use PAM, without an SDK call",
    async (route) => {
      const reply = await call(route, query);

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toBe("This organization does not use Privileged Controls.");
      expect(list).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      expect(bypassable).not.toHaveBeenCalled();
    },
  );

  it("refuses a read for an organization the user is not in, without an SDK call", async () => {
    const reply = await call("GET /pam/rule", {
      organizationid: "99999999-9999-4999-8999-999999999999",
    });

    expect(reply.body?.message).toBe("Organization not found, or you are not a member of it.");
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses a read for a provider user, without an SDK call", async () => {
    organization = pamTestOrganization({ isProviderUser: true });

    const reply = await call("GET /pam/rule", query);

    expect(reply.body?.success).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses a write when the organization does not use PAM, without an SDK call", async () => {
    const reply = await call("POST /pam/rule/:ruleId/enable", query);

    expect(reply.body?.message).toBe("This organization does not use Privileged Controls.");
  });

  describe("POST /pam/rule/:ruleId", () => {
    const C1 = "33333333-3333-4333-8333-333333333333";
    const rule = (overrides: Record<string, unknown> = {}) => ({
      name: "r",
      enabled: true,
      conditions: [{ kind: "human_approval" }],
      singleActiveLease: false,
      allowsExtensions: false,
      collections: [C1],
      ...overrides,
    });
    let write: jest.SpyInstance;

    beforeEach(() => {
      organization = pamTestOrganization({ type: OrganizationUserType.Admin });
      jest.spyOn(AccessRulesService.prototype, "get").mockResolvedValue({
        ...rule(),
        id: RULE_ID,
        organizationId: PAM_TEST_ORGANIZATION_ID,
      } as never);
      list.mockResolvedValue([]);
      bypassable.mockResolvedValue([]);
      write = jest.spyOn(PamSdkService.prototype, "run").mockResolvedValue({
        ...rule(),
        id: RULE_ID,
        organizationId: PAM_TEST_ORGANIZATION_ID,
        collections: [],
      } as never);
    });

    it('requires "yes": true for an update that weakens governance, and writes nothing', async () => {
      const reply = await call("POST /pam/rule/:ruleId", query, rule({ collections: [] }));

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("--yes");
      expect(reply.body?.message).toContain(C1);
      expect(write).not.toHaveBeenCalled();
    });

    it("does not take a non-true yes as confirmation", async () => {
      const reply = await call(
        "POST /pam/rule/:ruleId",
        query,
        rule({ enabled: false, yes: "true" }),
      );

      expect(reply.body?.success).toBe(false);
      expect(write).not.toHaveBeenCalled();
    });

    it('applies a weakening update with "yes": true, which is not a rule field', async () => {
      const reply = await call(
        "POST /pam/rule/:ruleId",
        query,
        rule({ collections: [], yes: true }),
      );

      expect(reply.body?.success).toBe(true);
      expect(write).toHaveBeenCalled();
    });

    it("applies a non-weakening update without yes", async () => {
      const reply = await call("POST /pam/rule/:ruleId", query, rule({ name: "renamed" }));

      expect(reply.body?.success).toBe(true);
      expect(write).toHaveBeenCalled();
    });
  });

  it("lets a PAM organization read", async () => {
    organization = pamTestOrganization({ type: OrganizationUserType.User });
    list.mockResolvedValue([]);

    const reply = await call("GET /pam/rule", query);

    expect(reply.body?.success).toBe(true);
    expect(list).toHaveBeenCalled();
  });
});
