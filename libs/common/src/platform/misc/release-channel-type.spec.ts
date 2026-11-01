import { getReleaseChannelType, ReleaseChannelType } from "./release-channel-type";

describe("getReleaseChannelType", () => {
  afterEach(() => {
    delete process.env.RELEASE_CHANNEL;
  });

  it("returns Beta when the build injects beta", () => {
    process.env.RELEASE_CHANNEL = "beta";

    expect(getReleaseChannelType()).toBe(ReleaseChannelType.Beta);
  });

  it("returns Production when RELEASE_CHANNEL is not set", () => {
    delete process.env.RELEASE_CHANNEL;

    expect(getReleaseChannelType()).toBe(ReleaseChannelType.Production);
  });

  it.each(["production", "", "rc", "Beta", "BETA"])("returns Production for %p", (value) => {
    process.env.RELEASE_CHANNEL = value;

    expect(getReleaseChannelType()).toBe(ReleaseChannelType.Production);
  });
});
