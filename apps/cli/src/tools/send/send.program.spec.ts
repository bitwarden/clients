import { program } from "commander";
import { mock } from "jest-mock-extended";

import { Response } from "../../models/response";
import { ServiceContainer } from "../../service-container/service-container";

import { SendReceiveCommand } from "./commands/receive.command";
import { SendProgram } from "./send.program";

// Regression coverage for PM-24945: `bw send receive <url> --password <pw>` must forward the
// password to the command. The `receive` subcommand is nested under `send`, which *also* declares
// `--password`, so commander binds the flag to the parent and the subcommand's own
// `options.password` is undefined. The action must therefore resolve the flag via
// `optsWithGlobals()`. This test exercises the real commander wiring (not the command in
// isolation), which is where the bug lived.
describe("SendProgram receive password wiring (PM-24945)", () => {
  const testUrl = "https://send.bitwarden.com/#/send/abc123/key456";
  let runSpy: jest.SpyInstance;

  beforeAll(async () => {
    const serviceContainer = mock<ServiceContainer>();
    await new SendProgram(serviceContainer).register();
  });

  beforeEach(() => {
    // Stub out the actual receive work; we only care about the args commander forwards.
    runSpy = jest.spyOn(SendReceiveCommand.prototype, "run").mockResolvedValue(Response.success());
  });

  afterEach(() => {
    runSpy.mockRestore();
    // processResponse sets process.exitCode on failure paths; keep tests isolated.
    process.exitCode = undefined;
  });

  it("forwards --password for `bw send receive` even though the parent `send` declares --password", async () => {
    await program.parseAsync(["node", "bw", "send", "receive", testUrl, "--password", "SECRET"]);

    expect(runSpy).toHaveBeenCalledWith(testUrl, expect.objectContaining({ password: "SECRET" }));
  });

  it("forwards --password for top-level `bw receive`", async () => {
    await program.parseAsync(["node", "bw", "receive", testUrl, "--password", "SECRET"]);

    expect(runSpy).toHaveBeenCalledWith(testUrl, expect.objectContaining({ password: "SECRET" }));
  });
});
