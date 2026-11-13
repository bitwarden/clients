import { Command } from "commander";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccessRulesService } from "@bitwarden/bit-common/pam/rules";
import { PamSdkService } from "@bitwarden/bit-common/pam/shared/pam-sdk.service";
import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import type { ServiceContainer } from "../../service-container";

import { bypassWarning, RuleOperations } from "./rule-operations";
import { RuleProgram } from "./rule.program";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  is_valid_cidr: (v: string) => v === "10.0.0.0/8",
}));

describe("RuleProgram", () => {
  const container = mock<ServiceContainer>();
  const organizationService = mock<OrganizationService>();
  const configService = mock<ConfigService>();
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;
  let organization = pamTestOrganization({ type: OrganizationUserType.User });

  const run = async (...args: string[]) => {
    const program = new Command("pam")
      .exitOverride()
      .addCommand(new RuleProgram(container).command());
    await program.parseAsync(["rule", ...args], { from: "user" });
  };
  const org = ["--organizationid", PAM_TEST_ORGANIZATION_ID];

  beforeEach(() => {
    jest.resetAllMocks();
    process.exitCode = undefined;
    delete process.env.BW_RESPONSE;
    Object.assign(container, {
      organizationService,
      configService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organization = pamTestOrganization({ type: OrganizationUserType.User });
    organizationService.organizations$.mockImplementation((() => of([organization])) as never);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue(undefined);
    jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    stdout = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    stderr = jest.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it("refuses a write from a plain member before reading any input", async () => {
    await expect(run("create", "{}", ...org)).rejects.toThrow("exit 1");
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("permission to manage access rules"),
    );
  });

  it("refuses a write when the organization does not use PAM", async () => {
    organization = pamTestOrganization({ type: OrganizationUserType.Admin, usePam: false });
    await expect(run("enable", "x", ...org)).rejects.toThrow("exit 1");
  });

  describe("reads in an organization that cannot use Privileged Controls", () => {
    const RULE_ID = "44444444-4444-4444-8444-444444444444";
    const NOT_USED = "This organization does not use Privileged Controls.";
    const NOT_A_MEMBER = "Organization not found, or you are not a member of it.";
    const reads = [["list"], ["get", RULE_ID], ["bypassable", RULE_ID]];
    let list: jest.SpyInstance;
    let get: jest.SpyInstance;
    let bypassable: jest.SpyInstance;

    beforeEach(() => {
      list = jest.spyOn(AccessRulesService.prototype, "list");
      get = jest.spyOn(AccessRulesService.prototype, "get");
      bypassable = jest.spyOn(AccessRulesService.prototype, "bypassable");
    });

    const expectNoSdkCall = () => {
      expect(list).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      expect(bypassable).not.toHaveBeenCalled();
    };

    it.each(reads)("refuses `%s` when the organization does not use PAM", async (...args) => {
      organization = pamTestOrganization({ type: OrganizationUserType.Owner, usePam: false });
      await expect(run(...args, ...org)).rejects.toThrow("exit 1");
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining(NOT_USED));
      expectNoSdkCall();
    });

    it.each(reads)("refuses `%s` for a provider user", async (...args) => {
      organization = pamTestOrganization({ isProviderUser: true });
      await expect(run(...args, ...org)).rejects.toThrow("exit 1");
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining("provider users"));
      expectNoSdkCall();
    });

    it.each(reads)("refuses `%s` for an organization the user is not in", async (...args) => {
      await expect(
        run(...args, "--organizationid", "99999999-9999-4999-8999-999999999999"),
      ).rejects.toThrow("exit 1");
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining(NOT_A_MEMBER));
      expectNoSdkCall();
    });

    it("refuseIfCannotRead passes a plain member of a PAM organization", async () => {
      const operations = new RuleOperations(container);
      await expect(
        operations.refuseIfCannotRead(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID),
      ).resolves.toBeUndefined();
    });
  });

  it("does not gate reads on admin rights", async () => {
    // Passes the guard, then fails on the id (not on permission).
    await run("get", "not-a-guid", ...org);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("valid rule id"));
    expect(process.exitCode).toBe(1);
  });

  it("requires --yes for disable and delete, after the permission check", async () => {
    organization = pamTestOrganization({ type: OrganizationUserType.Admin });
    for (const verb of ["disable", "delete"]) {
      await run(verb, "44444444-4444-4444-8444-444444444444", ...org);
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining("--yes"));
    }
  });

  describe("update", () => {
    const RULE_ID = "44444444-4444-4444-8444-444444444444";
    const C1 = "33333333-3333-4333-8333-333333333333";
    const rule = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        name: "r",
        enabled: true,
        conditions: [{ kind: "human_approval" }],
        singleActiveLease: false,
        allowsExtensions: false,
        collections: [C1],
        ...overrides,
      });
    const current = {
      id: RULE_ID,
      organizationId: PAM_TEST_ORGANIZATION_ID,
      name: "r",
      enabled: true,
      conditions: [{ kind: "human_approval" }],
      singleActiveLease: false,
      allowsExtensions: false,
      collections: [C1],
    };
    // The only SDK call left unmocked is the write itself, so this is the write spy.
    let write: jest.SpyInstance;

    beforeEach(() => {
      organization = pamTestOrganization({ type: OrganizationUserType.Admin });
      jest.spyOn(AccessRulesService.prototype, "get").mockResolvedValue(current as never);
      jest.spyOn(AccessRulesService.prototype, "list").mockResolvedValue([]);
      jest.spyOn(AccessRulesService.prototype, "bypassable").mockResolvedValue([]);
      write = jest.spyOn(PamSdkService.prototype, "run").mockResolvedValue({
        ...current,
        collections: [],
      } as never);
    });

    it("refuses a weakening update without --yes and writes nothing", async () => {
      await run("update", RULE_ID, rule({ collections: [] }), ...org);
      expect(process.exitCode).toBe(1);
      expect(stderr.mock.calls.join("")).toContain("--yes");
      expect(stderr.mock.calls.join("")).toContain(C1);
      expect(write).not.toHaveBeenCalled();
    });

    it("allows a weakening update with --yes and warns with the ungoverned collections", async () => {
      await run("update", RULE_ID, rule({ collections: [] }), ...org, "--yes");
      expect(process.exitCode).not.toBe(1);
      expect(write).toHaveBeenCalled();
      expect(stderr.mock.calls.join("")).toContain("no longer governed");
      expect(stderr.mock.calls.join("")).toContain(C1);
    });

    it("needs no --yes for a non-weakening update", async () => {
      await run("update", RULE_ID, rule({ name: "renamed" }), ...org);
      expect(process.exitCode).not.toBe(1);
      expect(write).toHaveBeenCalled();
    });
  });

  it("requires --organizationid", async () => {
    await expect(run("list")).rejects.toThrow();
  });

  it("prints the template as JSON", async () => {
    await run("template");
    expect(stdout.mock.calls.join("")).toContain('"conditions"');
  });

  it("validate-cidr succeeds for valid values and fails for invalid ones", async () => {
    await run("validate-cidr", "10.0.0.0/8");
    expect(process.exitCode).not.toBe(1);
    await run("validate-cidr", "10.0.0.0/8", "bad");
    expect(process.exitCode).toBe(1);
    expect(stderr.mock.calls.join("")).toContain("bad");
  });
});

describe("bypassWarning", () => {
  it("lists ids only and is silent when nothing is exposed", () => {
    expect(bypassWarning("disabled", ["a", "b"])).toContain("a, b");
    expect(bypassWarning("updated", [])).toBeUndefined();
    expect(bypassWarning("updated", undefined)).toContain("could not be read");
    expect(bypassWarning("deleted", [], ["c"])).toContain("no longer governed");
  });
});
