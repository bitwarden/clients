import { CliLicenseType } from "@bitwarden/cli/platform/cli-license-type";

import { ServiceContainer } from "./service-container";

describe("ServiceContainer", () => {
  it("instantiates", async () => {
    expect(() => new ServiceContainer()).not.toThrow();
  });

  it("reports the bit license type", () => {
    expect(new ServiceContainer().licenseType).toBe(CliLicenseType.Bit);
  });
});
