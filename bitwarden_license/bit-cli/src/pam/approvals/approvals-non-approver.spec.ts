import { Router } from "@koa/router";
import { Command } from "commander";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApprovalsService, NOT_AN_APPROVER_MESSAGE } from "@bitwarden/bit-common/pam/approvals";
import {
  PAM_TEST_ORGANIZATION_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { ApprovalsProgram } from "./approvals.program";
import { registerServeRoutes } from "./serve";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;

describe("approvals for a non-approver", () => {
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const collectionService = mock<CollectionService>();
  const keyService = mock<KeyService>();
  const container = mock<ServiceContainer>();
  let printed: Response[];
  let serviceCalls: jest.SpyInstance[];

  const commands: [string, string[]][] = [
    ["inbox", ["inbox"]],
    ["history", ["history"]],
    ["approve", ["approve", ID]],
    ["deny", ["deny", ID, "--comment", "no"]],
    ["withdraw", ["withdraw", ID, "--yes"]],
    ["revoke-lease", ["revoke-lease", ID, "--yes"]],
    ["managed-leases", ["managed-leases"]],
  ];

  function useApprover(approver: boolean) {
    const organization = pamTestOrganization({
      type: OrganizationUserType.Admin,
      allowAdminAccessToAllCollectionItems: false,
    });
    const view = new CollectionView({
      id: "c1" as CollectionId,
      organizationId: PAM_TEST_ORGANIZATION_ID as OrganizationId,
      name: "Prod",
    });
    view.manage = approver;
    organizationService.organizations$.mockReturnValue(of([organization]));
    collectionService.decryptedCollections$.mockReturnValue(of([view]));
  }

  beforeEach(() => {
    jest.resetAllMocks();
    printed = [];
    Object.assign(container, {
      configService,
      organizationService,
      collectionService,
      keyService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    keyService.hasUserKey.mockResolvedValue(true);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue(undefined);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { processResponse: (r: Response) => void },
        "processResponse",
      )
      .mockImplementation(((r: Response) => {
        printed.push(r);
      }) as never);
    serviceCalls = (
      ["inbox", "history", "decide", "withdraw", "revokeLease", "managedLeases"] as const
    ).map((name) =>
      jest.spyOn(ApprovalsService.prototype, name as never).mockRejectedValue(new Error("sdk")),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  async function run(args: string[]) {
    const pam = new Command("pam").exitOverride();
    pam.addCommand(new ApprovalsProgram(container).command());
    await pam.parseAsync(["node", "bw", "approval", ...args], { from: "node" });
  }

  it.each(commands)("%s refuses up front and makes no SDK call", async (_name, args) => {
    useApprover(false);

    await run(args);

    expect(printed).toHaveLength(1);
    expect(printed[0].success).toBe(false);
    expect((printed[0] as { message?: string }).message).toBe(NOT_AN_APPROVER_MESSAGE);
    for (const call of serviceCalls) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  it("an approver is let through to the service", async () => {
    useApprover(true);
    const inbox = jest.spyOn(ApprovalsService.prototype, "inbox").mockResolvedValue([]);

    await run(["inbox"]);

    expect(inbox).toHaveBeenCalled();
    expect(printed[0].success).toBe(true);
  });

  describe("bw serve routes", () => {
    const routes: [string, "GET" | "POST", string, unknown][] = [
      ["inbox", "GET", "/pam/approval/inbox", undefined],
      ["history", "GET", "/pam/approval/history", undefined],
      ["managed-leases", "GET", "/pam/approval/managed-leases", undefined],
      ["decide", "POST", "/pam/approval/:requestId/decide", { verdict: "approve" }],
      ["withdraw", "POST", "/pam/approval/:requestId/withdraw", { yes: true }],
      ["revoke", "POST", "/pam/approval/lease/:leaseId/revoke", { yes: true }],
    ];

    it.each(routes)(
      "%s refuses a non-approver with no SDK call",
      async (_n, method, path, body) => {
        useApprover(false);
        const router = mock<Router>();
        registerServeRoutes(router, container);
        const registered = (method === "GET" ? router.get : router.post).mock.calls.find(
          (call) => call[0] === path,
        );
        const ctx = {
          response: {} as { status?: number; body?: Response },
          params: { requestId: ID, leaseId: ID },
          query: {},
          request: { body },
        };

        await (registered?.[1] as unknown as Handler)(ctx, async () => undefined);

        expect(ctx.response.status).toBe(400);
        expect(ctx.response.body?.success).toBe(false);
        expect((ctx.response.body as { message?: string }).message).toBe(NOT_AN_APPROVER_MESSAGE);
        for (const call of serviceCalls) {
          expect(call).not.toHaveBeenCalled();
        }
      },
    );
  });
});
