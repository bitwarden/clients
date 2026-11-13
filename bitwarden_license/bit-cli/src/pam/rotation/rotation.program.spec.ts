import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { RotationService } from "@bitwarden/bit-common/pam/rotation";
import {
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import type { ServiceContainer } from "../../service-container";

import { RotationProgram } from "./rotation.program";

const ORG = "22222222-2222-4222-8222-222222222222";
const CONFIG = "55555555-5555-4555-8555-555555555555";

class ExitError extends Error {}

describe("RotationProgram", () => {
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  let flags: Set<FeatureFlag>;
  let output: string[];
  let role: OrganizationUserType;
  let usePam: boolean;

  const run = async (...args: string[]) => {
    const command = new RotationProgram(container).command();
    command.exitOverride();
    await command.parseAsync(["node", "rotation", ...args]).catch((): void => undefined);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    flags = new Set([FeatureFlag.Pam, FeatureFlag.PamAccessConnector]);
    role = OrganizationUserType.Admin;
    usePam = true;
    output = [];
    process.env.BW_RESPONSE = "true";
    delete process.env.BW_CLEANEXIT;
    Object.assign(container, {
      configService,
      organizationService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(flags.has(flag))) as never);
    organizationService.organizations$.mockImplementation((() =>
      of([pamTestOrganization({ id: ORG as never, type: role, usePam })])) as never);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue(undefined);
    jest.spyOn(process, "exit").mockImplementation((() => {
      throw new ExitError();
    }) as never);
    jest.spyOn(process.stdout, "write").mockImplementation(((text: string) => {
      output.push(text);
      return true;
    }) as never);
    jest.spyOn(process.stderr, "write").mockImplementation(((text: string) => {
      output.push(text);
      return true;
    }) as never);
  });

  afterEach(() => {
    delete process.env.BW_RESPONSE;
    jest.restoreAllMocks();
  });

  it("registers the documented verbs", () => {
    const names = new RotationProgram(container).command().commands.map((c) => c.name());
    expect(names).toEqual([
      "list",
      "get",
      "create",
      "update",
      "delete",
      "pause",
      "resume",
      "rotate",
      "record-manual",
      "actions",
      "schedule",
    ]);
  });

  it("is unavailable when the connector flag is off", async () => {
    flags.delete(FeatureFlag.PamAccessConnector);
    await run("list", "--organizationid", ORG);
    expect(output.join("")).toContain("temporarily unavailable");
  });

  it("refuses a member without rotation rights before any SDK call", async () => {
    role = OrganizationUserType.User;
    await run("list", "--organizationid", ORG);
    expect(output.join("")).toContain('"success":false');
  });

  it("refuses an organization that does not use PAM before any SDK call", async () => {
    usePam = false;
    const list = jest.spyOn(RotationService.prototype, "list");
    const get = jest.spyOn(RotationService.prototype, "get");

    await run("list", "--organizationid", ORG);
    await run("get", CONFIG, "--organizationid", ORG);

    const text = output.join("");
    expect(text.match(/This organization does not use Privileged Controls\./g)).toHaveLength(2);
    expect(list).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("requires --yes to rotate and to delete", async () => {
    await run("rotate", CONFIG, "--organizationid", ORG);
    await run("delete", CONFIG, "--organizationid", ORG);
    const text = output.join("");
    expect(text).toContain("--yes");
    expect(text.match(/"success":false/g)).toHaveLength(2);
  });

  it("refuses a bad config id", async () => {
    await run("get", "nope", "--organizationid", ORG);
    expect(output.join("")).toContain("not a valid config id");
  });

  it("refuses a bad --jobs", async () => {
    await run("get", CONFIG, "--organizationid", ORG, "--jobs", "-3");
    expect(output.join("")).toContain("--jobs");
  });
});
