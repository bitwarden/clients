import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import type { ServiceContainer } from "../../service-container";

import { PamOrganizationRequirement } from "./organization-requirements";
import { PamBaseProgram, PamContext, PamGuard } from "./pam-base.program";

class ExitError extends Error {
  constructor(readonly code: number | undefined) {
    super(`exit ${code}`);
  }
}

class TestProgram extends PamBaseProgram {
  guard(guard: PamGuard, run: (context: PamContext) => Promise<Response>) {
    return this.runPam(guard, run);
  }
}

describe("PamBaseProgram", () => {
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const accountService = pamTestAccountService();
  const container = mock<ServiceContainer>();
  let program: TestProgram;
  let order: string[];
  let enabledFlags: Set<FeatureFlag>;
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;

  const ok = () => Promise.resolve(Response.success(new MessageResponse("done", null)));

  beforeEach(() => {
    jest.resetAllMocks();
    order = [];
    enabledFlags = new Set([FeatureFlag.Pam]);
    for (const key of ["BW_RESPONSE", "BW_QUIET", "BW_RAW", "BW_CLEANEXIT", "BW_PRETTY"]) {
      delete process.env[key];
    }
    process.exitCode = undefined;

    Object.assign(container, { configService, organizationService, accountService });
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) => {
      order.push(`flag:${flag}`);
      return of(enabledFlags.has(flag));
    }) as never);
    organizationService.organizations$.mockImplementation((() => {
      order.push("organizations");
      return of([pamTestOrganization({ type: OrganizationUserType.Admin })]);
    }) as never);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockImplementation(async () => {
        order.push("locked");
      });
    jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(code);
    }) as never);
    stdout = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    stderr = jest.spyOn(process.stderr, "write").mockReturnValue(true);
    program = new TestProgram(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("checks flags, then the lock, then the organization", async () => {
    enabledFlags.add(FeatureFlag.PamAccessConnector);

    await program.guard(
      {
        flags: [FeatureFlag.PamAccessConnector],
        organizationId: PAM_TEST_ORGANIZATION_ID,
        requirement: PamOrganizationRequirement.ManageRotation,
      },
      ok,
    );

    expect(order).toEqual([
      `flag:${FeatureFlag.Pam}`,
      `flag:${FeatureFlag.PamAccessConnector}`,
      "locked",
      "organizations",
    ]);
  });

  it("exits before the lock check when FeatureFlag.Pam is off", async () => {
    enabledFlags.clear();

    await expect(program.guard({}, ok)).rejects.toBeInstanceOf(ExitError);

    expect(order).toEqual([`flag:${FeatureFlag.Pam}`]);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("temporarily unavailable"));
  });

  it("exits when an extra flag is off, before the lock check", async () => {
    await expect(
      program.guard({ flags: [FeatureFlag.PamAccessConnector] }, ok),
    ).rejects.toBeInstanceOf(ExitError);

    expect(order).toEqual([`flag:${FeatureFlag.Pam}`, `flag:${FeatureFlag.PamAccessConnector}`]);
  });

  it("does not run the action when a guard fails", async () => {
    enabledFlags.clear();
    const run = jest.fn(ok);

    await expect(program.guard({}, run)).rejects.toBeInstanceOf(ExitError);

    expect(run).not.toHaveBeenCalled();
  });

  it("passes the user and the validated, lowercased organization id to the action", async () => {
    const run = jest.fn(ok);

    await program.guard(
      {
        organizationId: PAM_TEST_ORGANIZATION_ID.toUpperCase(),
        requirement: PamOrganizationRequirement.UsePam,
      },
      run,
    );

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: PAM_TEST_USER_ID,
        organizationId: PAM_TEST_ORGANIZATION_ID,
        organization: expect.objectContaining({ id: PAM_TEST_ORGANIZATION_ID }),
      }),
    );
  });

  it("exits on an organization id that is not a GUID, before reading organizations", async () => {
    await expect(
      program.guard({ organizationId: "nope", requirement: PamOrganizationRequirement.UsePam }, ok),
    ).rejects.toBeInstanceOf(ExitError);

    expect(order).not.toContain("organizations");
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("not a valid organization id"));
  });

  it("exits with the requirement's message when the caller lacks it", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));

    await expect(
      program.guard(
        {
          organizationId: PAM_TEST_ORGANIZATION_ID,
          requirement: PamOrganizationRequirement.ManageAccessRules,
        },
        ok,
      ),
    ).rejects.toBeInstanceOf(ExitError);

    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("manage access rules"));
  });

  it("exits when the organization is not one the caller belongs to", async () => {
    organizationService.organizations$.mockReturnValue(of([]));

    await expect(
      program.guard(
        {
          organizationId: PAM_TEST_ORGANIZATION_ID,
          requirement: PamOrganizationRequirement.UsePam,
        },
        ok,
      ),
    ).rejects.toBeInstanceOf(ExitError);

    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("not a member"));
  });

  it("checks any organization when a requirement has no organization id", async () => {
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization()]));
    const run = jest.fn(ok);

    await program.guard({ requirement: PamOrganizationRequirement.AccessPam }, run);

    expect(run).toHaveBeenCalledWith(expect.objectContaining({ organization: undefined }));
  });

  it("reads no organizations when the guard has no requirement, as for an approver", async () => {
    await program.guard({}, ok);

    expect(order).not.toContain("organizations");
  });

  describe("output", () => {
    it("prints the response and exits 0", async () => {
      await program.guard({}, ok);

      expect(stdout).toHaveBeenCalledWith(expect.stringContaining("done"));
      expect(process.exitCode).toBe(0);
    });

    it("prints BW_RESPONSE JSON", async () => {
      process.env.BW_RESPONSE = "true";

      await program.guard({}, ok);

      expect(JSON.parse(String(stdout.mock.calls[0][0]))).toMatchObject({ success: true });
    });

    it("prints nothing under BW_QUIET but still sets the exit code", async () => {
      process.env.BW_QUIET = "true";

      await program.guard({}, () => Promise.resolve(Response.error("nope")));

      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("prints the raw message under BW_RAW", async () => {
      process.env.BW_RAW = "true";
      const message = new MessageResponse("Title", "body");
      message.raw = "just-this";

      await program.guard({}, () => Promise.resolve(Response.success(message)));

      expect(stdout).toHaveBeenCalledWith(expect.stringContaining("just-this"));
    });

    it("exits 0 on failure under BW_CLEANEXIT, with the failure in the response", async () => {
      process.env.BW_CLEANEXIT = "true";
      process.env.BW_RESPONSE = "true";

      await program.guard({}, () => Promise.resolve(Response.error("nope")));

      expect(process.exitCode).toBe(0);
      expect(JSON.parse(String(stdout.mock.calls[0][0]))).toMatchObject({
        success: false,
        message: "nope",
      });
    });
  });

  describe("errors thrown by the action", () => {
    it("become a failed response with the decoded text", async () => {
      const failure = Object.assign(
        new Error('error in response: status code 403 Forbidden: {"message":"Denied"}'),
        { name: "AccessLeaseError", variant: "Api" },
      );

      await program.guard({}, () => Promise.reject(failure));

      expect(process.exitCode).toBe(1);
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("You do not have permission to do this."),
      );
    });

    it("never print the text of an unknown error", async () => {
      await program.guard({}, () => Promise.reject(new Error("token=abc123")));

      const printed = JSON.stringify([...stderr.mock.calls, ...stdout.mock.calls]);
      expect(printed).not.toContain("abc123");
      expect(process.exitCode).toBe(1);
    });

    it("carry a pam-error object under BW_RESPONSE", async () => {
      process.env.BW_RESPONSE = "true";

      await program.guard({}, () =>
        Promise.reject(
          Object.assign(new Error("error in response: status code 404 Not Found: {}"), {
            name: "AccessRuleError",
            variant: "Api",
          }),
        ),
      );

      expect(JSON.parse(String(stdout.mock.calls[0][0])).data).toMatchObject({
        object: "pam-error",
        kind: "notFound",
        status: 404,
        variant: "Api",
      });
    });
  });
});
