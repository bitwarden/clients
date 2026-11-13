import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ConnectorService } from "@bitwarden/bit-common/pam/connectors";
import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  createPamSdkTestKit,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { registerServeRoutes } from "./serve";

const CONNECTOR_ID = "66666666-6666-4666-8666-666666666666";
const TARGET_ID = "77777777-7777-4777-8777-777777777777";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
type Reply = { status?: number; body?: { success: boolean; message?: string; data?: unknown } };

describe("connectors serve routes", () => {
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let handlers: Map<string, Handler>;
  let organization: ReturnType<typeof pamTestOrganization>;

  const call = async (
    key: string,
    query: Record<string, string> = { organizationid: PAM_TEST_ORGANIZATION_ID },
  ): Promise<Reply> => {
    const response: Reply = {};
    await handlers.get(key)!(
      {
        response,
        params: { id: CONNECTOR_ID, targetSystemId: TARGET_ID },
        query,
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

  it("registers the reads and the reversible changes, nothing else", () => {
    expect([...handlers.keys()].sort()).toEqual([
      "GET /pam/connector",
      "GET /pam/connector/:id",
      "POST /pam/connector/:id/assign/:targetSystemId",
      "POST /pam/connector/:id/disable",
      "POST /pam/connector/:id/enable",
      "POST /pam/connector/:id/unassign/:targetSystemId",
    ]);
  });

  it("has no register route, because a one-time token must never travel over serve", () => {
    expect([...handlers.keys()].filter((k) => /register|token/i.test(k))).toEqual([]);
  });

  it("has no delete route, because deleting is permanent and needs --yes on the command line", () => {
    expect([...handlers.keys()].filter((k) => /delete/i.test(k))).toEqual([]);
    expect([...handlers.keys()].filter((k) => k.startsWith("DELETE"))).toEqual([]);
  });

  it("requires the connector feature flag besides the PAM flag", async () => {
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(flag !== FeatureFlag.PamAccessConnector)) as never);
    const list = jest.spyOn(ConnectorService.prototype, "list");

    const reply = await call("GET /pam/connector");

    expect(reply.status).toBe(400);
    expect(reply.body?.message).toContain("temporarily unavailable");
    expect(list).not.toHaveBeenCalled();
  });

  it("lists the connectors of the organization in the query", async () => {
    const list = jest.spyOn(ConnectorService.prototype, "list").mockResolvedValue([]);

    const reply = await call("GET /pam/connector");

    expect(reply.body?.success).toBe(true);
    expect(list).toHaveBeenCalledWith(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID);
  });

  it("rejects a missing or malformed organization id before any SDK call", async () => {
    const list = jest.spyOn(ConnectorService.prototype, "list");

    for (const query of [{}, { organizationid: "not-a-guid" }]) {
      const reply = await call("GET /pam/connector", query);

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("organization id");
    }
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses an organization the caller is not a member of", async () => {
    const list = jest.spyOn(ConnectorService.prototype, "list");

    const reply = await call("GET /pam/connector", {
      organizationid: "99999999-9999-4999-8999-999999999999",
    });

    expect(reply.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  describe("changes", () => {
    it.each([
      ["POST /pam/connector/:id/enable", "enable", "enabled", [CONNECTOR_ID]],
      ["POST /pam/connector/:id/disable", "disable", "disabled", [CONNECTOR_ID]],
      [
        "POST /pam/connector/:id/assign/:targetSystemId",
        "assign",
        "assigned",
        [CONNECTOR_ID, TARGET_ID],
      ],
      [
        "POST /pam/connector/:id/unassign/:targetSystemId",
        "unassign",
        "unassigned",
        [CONNECTOR_ID, TARGET_ID],
      ],
    ] as const)("%s runs for an admin and reports the action", async (key, method, action, ids) => {
      const service = jest.spyOn(ConnectorService.prototype, method).mockResolvedValue();

      const reply = await call(key);

      expect(reply.body).toMatchObject({ success: true, data: { action, id: CONNECTOR_ID } });
      expect(service).toHaveBeenCalledWith(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, ...ids);
    });

    it.each([
      ["POST /pam/connector/:id/enable", "enable"],
      ["POST /pam/connector/:id/disable", "disable"],
      ["POST /pam/connector/:id/assign/:targetSystemId", "assign"],
      ["POST /pam/connector/:id/unassign/:targetSystemId", "unassign"],
    ] as const)("%s refuses a plain member before any SDK call", async (key, method) => {
      organization = pamTestOrganization({ type: OrganizationUserType.User });
      const service = jest.spyOn(ConnectorService.prototype, method);

      const reply = await call(key);

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("permission");
      expect(service).not.toHaveBeenCalled();
    });
  });
});
