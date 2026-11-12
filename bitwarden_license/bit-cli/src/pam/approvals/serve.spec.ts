import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApprovalsService } from "@bitwarden/bit-common/pam/approvals";
import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { registerServeRoutes } from "./serve";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
type Reply = { status?: number; body?: { success: boolean; message?: string } };

describe("approvals serve routes", () => {
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const collectionService = mock<CollectionService>();
  const keyService = mock<KeyService>();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let handlers: Map<string, Handler>;

  const call = async (key: string, body?: unknown, query: Record<string, string> = {}) => {
    const response: Reply = {};
    await handlers.get(key)!(
      { response, params: { requestId: ID, leaseId: ID }, query, request: { body } },
      async () => undefined,
    );
    return response;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(container, {
      configService,
      organizationService,
      collectionService,
      keyService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    keyService.hasUserKey.mockResolvedValue(true);
    const view = new CollectionView({
      id: "c1" as CollectionId,
      organizationId: PAM_TEST_ORGANIZATION_ID as OrganizationId,
      name: "Prod",
    });
    view.manage = true;
    organizationService.organizations$.mockReturnValue(
      of([
        pamTestOrganization({
          type: OrganizationUserType.Admin,
          allowAdminAccessToAllCollectionItems: false,
        }),
      ]),
    );
    collectionService.decryptedCollections$.mockReturnValue(of([view]));

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

  it("registers only the approval reads, decide, withdraw and revoke", () => {
    expect([...handlers.keys()].sort()).toEqual([
      "GET /pam/approval/history",
      "GET /pam/approval/inbox",
      "GET /pam/approval/managed-leases",
      "POST /pam/approval/:requestId/decide",
      "POST /pam/approval/:requestId/withdraw",
      "POST /pam/approval/lease/:leaseId/revoke",
    ]);
  });

  it("has no route that reveals a secret", () => {
    expect([...handlers.keys()].filter((k) => /reveal|secret|password/i.test(k))).toEqual([]);
  });

  describe("destructive routes", () => {
    it.each([
      ["withdraw", "POST /pam/approval/:requestId/withdraw", "withdraw"],
      ["revoke", "POST /pam/approval/lease/:leaseId/revoke", "revokeLease"],
    ] as const)("%s refuses without yes and calls nothing", async (_name, key, method) => {
      const service = jest.spyOn(ApprovalsService.prototype, method).mockResolvedValue(undefined);

      for (const body of [undefined, {}, { yes: false }, { yes: "true" }, { yes: 1 }]) {
        const reply = await call(key, body);

        expect(reply.status).toBe(400);
        expect(reply.body?.success).toBe(false);
        expect(reply.body?.message).toContain('"yes": true');
      }
      expect(service).not.toHaveBeenCalled();
    });

    it("withdraws with yes", async () => {
      const withdraw = jest.spyOn(ApprovalsService.prototype, "withdraw").mockResolvedValue();

      const reply = await call("POST /pam/approval/:requestId/withdraw", { yes: true });

      expect(reply.body?.success).toBe(true);
      expect(withdraw).toHaveBeenCalledWith(PAM_TEST_USER_ID, ID);
    });

    it("revokes with yes and passes the reason from the body", async () => {
      const revoke = jest.spyOn(ApprovalsService.prototype, "revokeLease").mockResolvedValue();

      const reply = await call("POST /pam/approval/lease/:leaseId/revoke", {
        yes: true,
        reason: "left the team",
      });

      expect(reply.body?.success).toBe(true);
      expect(revoke).toHaveBeenCalledWith(PAM_TEST_USER_ID, ID, "left the team");
    });

    it("validates the id before asking for confirmation", async () => {
      const response: Reply = {};
      await handlers.get("POST /pam/approval/:requestId/withdraw")!(
        { response, params: { requestId: "nope" }, query: {}, request: { body: { yes: true } } },
        async () => undefined,
      );

      expect(response.status).toBe(400);
      expect(response.body?.message).toContain("request id");
    });
  });

  describe("decide", () => {
    it("rejects a verdict that is neither approve nor deny", async () => {
      const decide = jest.spyOn(ApprovalsService.prototype, "decide");

      for (const body of [undefined, {}, { verdict: "maybe" }, { verdict: "APPROVE" }]) {
        const reply = await call("POST /pam/approval/:requestId/decide", body);

        expect(reply.status).toBe(400);
        expect(reply.body?.message).toContain("approve");
      }
      expect(decide).not.toHaveBeenCalled();
    });

    it("needs no yes to approve and sends the comment from the body", async () => {
      const decide = jest
        .spyOn(ApprovalsService.prototype, "decide")
        .mockResolvedValue({ requestId: ID, status: "approved" } as never);

      const reply = await call("POST /pam/approval/:requestId/decide", {
        verdict: "approve",
        comment: "ok",
      });

      expect(reply.body?.success).toBe(true);
      expect(decide).toHaveBeenCalledWith(PAM_TEST_USER_ID, ID, "approve", "ok");
    });

    it("refuses a deny without a comment before calling the service", async () => {
      const decide = jest.spyOn(ApprovalsService.prototype, "decide");

      const reply = await call("POST /pam/approval/:requestId/decide", { verdict: "deny" });

      expect(reply.status).toBe(400);
      expect(reply.body?.message).toContain("comment");
      expect(decide).not.toHaveBeenCalled();
    });
  });

  describe("reads", () => {
    it.each([
      ["GET /pam/approval/inbox", "inbox"],
      ["GET /pam/approval/history", "history"],
    ] as const)("%s lists the rows for an approver", async (key, method) => {
      const service = jest.spyOn(ApprovalsService.prototype, method).mockResolvedValue([]);

      const reply = await call(key);

      expect(reply.body?.success).toBe(true);
      expect(service).toHaveBeenCalledWith(PAM_TEST_USER_ID);
    });

    it("passes all=true to managed leases only when asked", async () => {
      const managed = jest.spyOn(ApprovalsService.prototype, "managedLeases").mockResolvedValue([]);

      await call("GET /pam/approval/managed-leases");
      await call("GET /pam/approval/managed-leases", undefined, { all: "true" });

      expect(managed).toHaveBeenNthCalledWith(1, PAM_TEST_USER_ID, false);
      expect(managed).toHaveBeenNthCalledWith(2, PAM_TEST_USER_ID, true);
    });
  });
});
