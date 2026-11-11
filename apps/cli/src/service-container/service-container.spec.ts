import { CliLicenseType } from "../platform/cli-license-type";

import { ServiceContainer } from "./service-container";

describe("ServiceContainer", () => {
  it("instantiates", async () => {
    expect(() => new ServiceContainer()).not.toThrow();
  });

  it("reports the oss license type", () => {
    expect(new ServiceContainer().licenseType).toBe(CliLicenseType.Oss);
  });
});
