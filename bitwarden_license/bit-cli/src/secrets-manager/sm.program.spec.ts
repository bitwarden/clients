import { Command, program } from "commander";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ServiceContainer } from "../service-container";

import { SmProgram } from "./sm.program";

describe("SmProgram", () => {
  const configService = mock<ConfigService>();
  const probe = jest.fn();
  let exitSpy: jest.SpyInstance;

  beforeAll(() => {
    new SmProgram(mock<ServiceContainer>({ configService })).register();
    // Every `bw sm` subcommand runs through the parent's gate; a probe subcommand stands in for them.
    program.commands
      .find((command) => command.name() === "sm")!
      .addCommand(new Command("probe").action(probe));
  });

  beforeEach(() => {
    process.env.BW_QUIET = "true";
    probe.mockReset();
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
});
