import { ServerConfig } from "../platform/abstractions/config/server-config";

import { getFeatureFlagValue, FeatureFlag, DefaultFeatureFlagValue } from "./feature-flag.enum";

describe("getFeatureFlagValue", () => {
  const testFlag = Object.values(FeatureFlag)[0];
  const testFlagDefaultValue = DefaultFeatureFlagValue[testFlag];

  it("returns default flag value when serverConfig is null", () => {
    const result = getFeatureFlagValue(null, testFlag);
    expect(result).toBe(testFlagDefaultValue);
  });

  it("returns default flag value when serverConfig.featureStates is undefined", () => {
    const serverConfig = {} as ServerConfig;
    const result = getFeatureFlagValue(serverConfig, testFlag);
    expect(result).toBe(testFlagDefaultValue);
  });

  it("returns default flag value when the feature flag is not in serverConfig.featureStates", () => {
    const serverConfig = {
      featureStates: {},
    } as ServerConfig;
    const result = getFeatureFlagValue(serverConfig, testFlag);
    expect(result).toBe(testFlagDefaultValue);
  });

  it("returns the flag value from serverConfig.featureStates when the feature flag exists", () => {
    const expectedValue = true;
    const serverConfig = {
      featureStates: {
        [testFlag]: expectedValue,
      },
    } as unknown as ServerConfig;
    const result = getFeatureFlagValue(serverConfig, testFlag);
    expect(result).toBe(expectedValue);
  });
});
