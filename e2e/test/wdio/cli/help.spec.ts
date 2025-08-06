import { execSync } from "node:child_process";

describe("cli app", () => {
  it("should output help", () => {
    const cmd = process.env.CLI_COMMAND || "node ./dist/apps/cli/index.js";
    const output = execSync(cmd + " --help").toString();
    expect(output.length).toBeGreaterThan(0);
  });
});
