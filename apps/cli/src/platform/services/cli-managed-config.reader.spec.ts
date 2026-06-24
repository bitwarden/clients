import * as secure from "@bitwarden/node/managed-settings/secure-config-dir";

import { readCliManagedConfig } from "./cli-managed-config.reader";

describe("readCliManagedConfig", () => {
  const logger = { warning: jest.fn() };

  it("reads the POSIX policy directory", () => {
    const spy = jest
      .spyOn(secure, "readSecureManagedConfigDir")
      .mockReturnValue({ environment: { base: "https://x" } });

    const result = readCliManagedConfig("linux", logger);

    expect(spy).toHaveBeenCalledWith("/etc/bitwarden/policies", "linux", logger);
    expect(result).toEqual({ environment: { base: "https://x" } });
  });

  it("reads the Windows ProgramData policy directory", () => {
    const spy = jest.spyOn(secure, "readSecureManagedConfigDir").mockReturnValue({});
    const prev = process.env.ProgramData;
    process.env.ProgramData = "C:\\ProgramData";

    readCliManagedConfig("win32", logger);

    expect(spy).toHaveBeenCalledWith("C:\\ProgramData\\Bitwarden\\policies", "win32", logger);
    process.env.ProgramData = prev;
  });
});
