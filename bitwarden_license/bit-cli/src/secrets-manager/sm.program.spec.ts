import { Command, program } from "commander";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ProjectService } from "@bitwarden/bit-sm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ServiceContainer } from "../service-container";

import { SmProgram } from "./sm.program";
import { mockSmOrganization, smOrgId } from "./spec/sm-test-utils";

describe("SmProgram", () => {
  const configService = mock<ConfigService>();
  const projectService = mock<ProjectService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const probe = jest.fn();
  let exitSpy: jest.SpyInstance;

  beforeAll(() => {
    new SmProgram(
      mock<ServiceContainer>({
        configService,
        projectService,
        organizationService,
        accountService,
      }),
    ).register();
    // Every `bw sm` subcommand runs through the parent's gate; a probe subcommand stands in for them.
    program.commands
      .find((command) => command.name() === "sm")!
      .addCommand(new Command("probe").action(probe));
  });

  beforeEach(() => {
    process.env.BW_QUIET = "true";
    probe.mockReset();
    projectService.getProjects.mockReset();
    mockSmOrganization(accountService, organizationService);
    configService.getFeatureFlag$.mockReturnValue(of(true));
    jest.spyOn(SmProgram.prototype as any, "exitIfLocked").mockResolvedValue(undefined);
    exitSpy = jest.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error("process.exit(" + code + ")");
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env.BW_QUIET;
  });

  it("hides the sm command from bw --help", () => {
    expect(program.helpInformation()).not.toMatch(/^\s+sm\b/m);
  });

  it("exits before running a subcommand when the SmCli flag is off", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await expect(program.parseAsync(["node", "bw", "sm", "probe"])).rejects.toThrow(
      "process.exit(1)",
    );

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.SmCli);
    expect(probe).not.toHaveBeenCalled();
  });

  it("runs the subcommand when the SmCli flag is on", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));

    await program.parseAsync(["node", "bw", "sm", "probe"]);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(probe).toHaveBeenCalled();
  });

  describe("organization validation", () => {
    afterEach(() => {
      process.exitCode = undefined;
    });

    it("hands a validated organization to the command", async () => {
      projectService.getProjects.mockResolvedValue([]);

      await program.parseAsync([
        "node",
        "bw",
        "sm",
        "project",
        "list",
        "--organizationid",
        smOrgId.toUpperCase(),
      ]);

      expect(projectService.getProjects).toHaveBeenCalledWith(smOrgId);
    });

    it("rejects an invalid organization id before the command runs", async () => {
      await program.parseAsync(["node", "bw", "sm", "project", "list", "--organizationid", "bad"]);

      expect(process.exitCode).toBe(1);
      expect(projectService.getProjects).not.toHaveBeenCalled();
    });
  });
});
