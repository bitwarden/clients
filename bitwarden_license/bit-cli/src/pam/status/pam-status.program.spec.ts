import { Command } from "commander";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import {
  PAM_TEST_ORGANIZATION_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import type { ServiceContainer } from "../../service-container";

import { PamStatusProgram } from "./pam-status.program";

describe("PamStatusProgram", () => {
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const collectionService = mock<CollectionService>();
  const container = mock<ServiceContainer>();
  let enabled: Set<FeatureFlag>;
  let printed: Response[];
  let locked: jest.SpyInstance;

  async function run(...args: string[]) {
    const pam = new Command("pam").exitOverride();
    new PamStatusProgram(container).register(pam);
    await pam.parseAsync(["node", "bw", ...args], { from: "node" });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    enabled = new Set();
    printed = [];
    Object.assign(container, {
      configService,
      organizationService,
      collectionService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockImplementation(((f: FeatureFlag) =>
      of(enabled.has(f))) as never);
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    locked = jest
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
      .mockImplementation(((r: Response, exit?: boolean) => {
        printed.push(r);
        if (exit) {
          throw new Error("exit");
        }
      }) as never);
    jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it("status works with the Pam flag off and a locked vault", async () => {
    await run("status");

    expect(locked).not.toHaveBeenCalled();
    expect(printed).toHaveLength(1);
    expect(printed[0].success).toBe(true);
    expect(printed[0].data).toMatchObject({
      object: "pam-status",
      featurePam: false,
      loggedIn: true,
      organizations: [{ id: PAM_TEST_ORGANIZATION_ID, usePam: true, accessPam: true }],
    });
  });

  it("status refuses a malformed organization id as text", async () => {
    await run("status", "--organizationid", "nope");
    expect(printed[0].success).toBe(false);
  });

  it("collections is refused when the Pam flag is off", async () => {
    await expect(run("collections", "--organizationid", PAM_TEST_ORGANIZATION_ID)).rejects.toThrow(
      "exit",
    );

    expect(printed[0].success).toBe(false);
    expect(collectionService.decryptedCollections$).not.toHaveBeenCalled();
  });

  it("collections lists governed markers when Pam is on", async () => {
    enabled.add(FeatureFlag.Pam);
    const view = new CollectionView({
      id: "c1" as CollectionId,
      organizationId: PAM_TEST_ORGANIZATION_ID as OrganizationId,
      name: "Prod",
    });
    view.hasEnabledAccessRule = true;
    collectionService.decryptedCollections$.mockReturnValue(of([view]));

    await run("collections", "--organizationid", PAM_TEST_ORGANIZATION_ID);

    expect(printed[0].success).toBe(true);
    expect(JSON.parse(JSON.stringify(printed[0].data))).toMatchObject({
      object: "list",
      data: [{ object: "pam-collection", id: "c1", name: "Prod", hasEnabledAccessRule: true }],
    });
  });

  it("collections refuses an organization the caller is not a member of", async () => {
    enabled.add(FeatureFlag.Pam);
    organizationService.organizations$.mockReturnValue(of([]));

    await expect(run("collections", "--organizationid", PAM_TEST_ORGANIZATION_ID)).rejects.toThrow(
      "exit",
    );

    expect(printed[0].success).toBe(false);
    expect(collectionService.decryptedCollections$).not.toHaveBeenCalled();
  });

  it("collections requires --organizationid", async () => {
    await expect(run("collections")).rejects.toThrow();
  });
});
