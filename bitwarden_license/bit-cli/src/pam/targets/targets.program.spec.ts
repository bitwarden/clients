import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  createPamSdkTestKit,
  PAM_TEST_ORGANIZATION_ID,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import type { RotationClient, TargetSystemsClient } from "@bitwarden/sdk-internal";

import type { ServiceContainer } from "../../service-container";

import { TargetsProgram } from "./targets.program";

const TARGET_ID = "33333333-3333-4333-8333-333333333333";
const ORG = PAM_TEST_ORGANIZATION_ID;
const POLICY = {
  minLength: 16,
  maxLength: 32,
  includeUppercase: true,
  includeLowercase: true,
  includeDigits: true,
  includeSymbols: true,
};

class ExitError extends Error {}

describe("TargetsProgram", () => {
  let kit: ReturnType<typeof createPamSdkTestKit>;
  const targets = mock<TargetSystemsClient>();
  const rotation = mock<RotationClient>();
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  let enabled: Set<FeatureFlag>;
  let organization: ReturnType<typeof pamTestOrganization>;
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;

  const run = async (...args: string[]) => {
    stdout.mockClear();
    stderr.mockClear();
    await new TargetsProgram(container).command().exitOverride().parseAsync(args, { from: "user" });
    const written = [...stdout.mock.calls, ...stderr.mock.calls].map((c) => String(c[0])).join("");
    return JSON.parse(written) as {
      success: boolean;
      message?: string;
      data?: Record<string, unknown>;
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    kit = createPamSdkTestKit();
    process.env.BW_RESPONSE = "true";
    process.env.BW_CLEANEXIT = "true";
    enabled = new Set([FeatureFlag.Pam, FeatureFlag.PamAccessConnector]);
    organization = pamTestOrganization({ type: OrganizationUserType.Admin });
    rotation.target_systems.mockReturnValue(targets);
    kit.pam.rotation.mockReturnValue(rotation);
    Object.assign(container, {
      sdkService: kit.sdkService,
      accountService: kit.accountService,
      logService: kit.logService,
      configService,
      organizationService,
    });
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(enabled.has(flag))) as never);
    organizationService.organizations$.mockImplementation((() => of([organization])) as never);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue();
    jest.spyOn(process, "exit").mockImplementation((() => {
      throw new ExitError();
    }) as never);
    stdout = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    stderr = jest.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.BW_RESPONSE;
    delete process.env.BW_CLEANEXIT;
    process.exitCode = undefined;
  });

  it("defines the seven verbs", () => {
    const names = new TargetsProgram(container).command().commands.map((c) => c.name());
    expect(names).toEqual(["list", "template", "create", "update", "enable", "disable", "delete"]);
  });

  it("lists targets as pam-target-system objects without sealed fields", async () => {
    targets.list.mockResolvedValue([
      {
        id: TARGET_ID,
        organizationId: ORG,
        name: "Vendor",
        method: "automatic",
        status: "active",
        sealed: { kind: "entra", passwordPolicy: POLICY, supportsSessionTermination: true },
        creationDate: "2026-01-01T00:00:00Z",
        revisionDate: "2026-01-02T00:00:00Z",
      },
    ] as never);

    const out = await run("list", "--organizationid", ORG);

    expect(out.success).toBe(true);
    const text = JSON.stringify(out);
    expect(text).toContain("pam-target-system");
    expect(text).toContain(TARGET_ID);
    expect(text).not.toContain("entra");
    expect(text).not.toContain("passwordPolicy");
  });

  it("exits when the PamAccessConnector flag is off, before calling the SDK", async () => {
    enabled.delete(FeatureFlag.PamAccessConnector);

    await expect(run("list", "--organizationid", ORG)).rejects.toBeInstanceOf(ExitError);

    expect(targets.list).not.toHaveBeenCalled();
  });

  it("refuses a caller who cannot manage rotation", async () => {
    organization = pamTestOrganization({ type: OrganizationUserType.User });

    await expect(run("list", "--organizationid", ORG)).rejects.toBeInstanceOf(ExitError);

    expect(targets.list).not.toHaveBeenCalled();
    expect([...stdout.mock.calls, ...stderr.mock.calls].join("")).toContain("credential rotation");
  });

  it("refuses an organization that does not use PAM, before calling the SDK", async () => {
    organization = pamTestOrganization({ type: OrganizationUserType.Owner, usePam: false });

    await expect(run("list", "--organizationid", ORG)).rejects.toBeInstanceOf(ExitError);

    expect(targets.list).not.toHaveBeenCalled();
    expect([...stdout.mock.calls, ...stderr.mock.calls].join("")).toContain(
      "This organization does not use Privileged Controls.",
    );
  });

  it("requires --organizationid", async () => {
    await expect(run("list")).rejects.toThrow();
  });

  it("prints a template for each method", async () => {
    const automatic = await run("template");
    const manual = await run("template", "--method", "manual");

    expect(automatic.data).toMatchObject({ method: "automatic", kind: "entra" });
    expect(manual.data).toMatchObject({ method: "manual" });
    expect(manual.data).not.toHaveProperty("kind");
  });

  it("creates from inline JSON", async () => {
    targets.create.mockResolvedValue({
      id: TARGET_ID,
      organizationId: ORG,
      name: "Vendor",
      method: "manual",
      status: "active",
      sealed: { passwordPolicy: POLICY },
      creationDate: "2026-01-01T00:00:00Z",
      revisionDate: "2026-01-01T00:00:00Z",
    } as never);

    const out = await run(
      "create",
      JSON.stringify({ method: "manual", name: "Vendor", passwordPolicy: POLICY }),
      "--organizationid",
      ORG,
    );

    expect(out.success).toBe(true);
    expect(targets.create).toHaveBeenCalledWith(ORG, {
      method: "manual",
      name: "Vendor",
      passwordPolicy: POLICY,
    });
  });

  it("rejects an invalid request before calling the SDK, and never echoes it", async () => {
    const out = await run(
      "create",
      JSON.stringify({
        method: "manual",
        name: "Vendor",
        passwordPolicy: { ...POLICY, minLength: 99 },
      }),
      "--organizationid",
      ORG,
    );

    expect(out.success).toBe(false);
    expect(targets.create).not.toHaveBeenCalled();
  });

  it("names the pending id and the next steps when sealing fails", async () => {
    targets.create.mockRejectedValue({ id: TARGET_ID, message: "seal failed" });

    const out = await run(
      "create",
      JSON.stringify({ method: "manual", name: "Vendor", passwordPolicy: POLICY }),
      "--organizationid",
      ORG,
    );

    expect(out.success).toBe(false);
    expect(out.message).toContain(TARGET_ID);
    expect(out.message).toContain("pending_seal");
    expect(out.message).toContain(`bw pam target update ${TARGET_ID}`);
    expect(out.message).toContain(`bw pam target delete ${TARGET_ID}`);
    expect(out.data).toMatchObject({ object: "pam-error", pendingId: TARGET_ID });
  });

  it("updates with the existing name and method", async () => {
    targets.list.mockResolvedValue([
      { id: TARGET_ID, organizationId: ORG, name: "Existing", method: "manual" },
    ] as never);
    targets.update.mockResolvedValue();

    const out = await run(
      "update",
      TARGET_ID,
      JSON.stringify({ passwordPolicy: POLICY }),
      "--organizationid",
      ORG,
    );

    expect(out.success).toBe(true);
    expect(targets.update).toHaveBeenCalledWith(ORG, TARGET_ID, {
      method: "manual",
      name: "Existing",
      passwordPolicy: POLICY,
    });
  });

  it("maps the method-immutable refusal", async () => {
    const e = new Error(
      `error in response: status code 400 Bad Request: ${JSON.stringify({ message: "Target system method cannot be changed" })}`,
    );
    e.name = "RotationError";
    (e as Error & { variant: string }).variant = "Api";
    targets.update.mockRejectedValue(e);

    const out = await run(
      "update",
      TARGET_ID,
      JSON.stringify({
        method: "automatic",
        name: "x",
        kind: "entra",
        supportsSessionTermination: false,
        passwordPolicy: POLICY,
      }),
      "--organizationid",
      ORG,
    );

    expect(out.success).toBe(false);
    expect(out.data).toMatchObject({ code: "target-system-method-immutable" });
  });

  it("disable says in-flight jobs keep running", async () => {
    targets.disable.mockResolvedValue();

    const out = await run("disable", TARGET_ID, "--organizationid", ORG);

    expect(out.success).toBe(true);
    expect(JSON.stringify(out)).toContain("in flight");
    expect(targets.disable).toHaveBeenCalledWith(ORG, TARGET_ID);
  });

  it("enable calls the SDK", async () => {
    targets.enable.mockResolvedValue();

    await run("enable", TARGET_ID, "--organizationid", ORG);

    expect(targets.enable).toHaveBeenCalledWith(ORG, TARGET_ID);
  });

  it("delete is refused without --yes", async () => {
    const out = await run("delete", TARGET_ID, "--organizationid", ORG);

    expect(out.success).toBe(false);
    expect(out.message).toContain("--yes");
    expect(targets.delete).not.toHaveBeenCalled();
  });

  it("deletes with --yes", async () => {
    targets.delete.mockResolvedValue();

    const out = await run("delete", TARGET_ID, "--organizationid", ORG, "--yes");

    expect(out.success).toBe(true);
    expect(targets.delete).toHaveBeenCalledWith(ORG, TARGET_ID);
  });

  it("maps the refusal while a rotation config names the target", async () => {
    const e = new Error(
      `error in response: status code 400 Bad Request: ${JSON.stringify({ message: "This target system still has rotation configs. Delete them before deleting the target system." })}`,
    );
    e.name = "RotationError";
    (e as Error & { variant: string }).variant = "Api";
    targets.delete.mockRejectedValue(e);

    const out = await run("delete", TARGET_ID, "--organizationid", ORG, "--yes");

    expect(out.success).toBe(false);
    expect(out.data).toMatchObject({ code: "target-system-has-rotation-configs" });
  });

  it("refuses a bad id without calling the SDK", async () => {
    const out = await run("enable", "nope", "--organizationid", ORG);

    expect(out.success).toBe(false);
    expect(targets.enable).not.toHaveBeenCalled();
  });
});
