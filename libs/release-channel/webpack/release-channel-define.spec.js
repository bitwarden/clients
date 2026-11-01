/* eslint-disable @typescript-eslint/no-require-imports */
const { releaseChannelDefinitions } = require("./release-channel-define");

describe("releaseChannelDefinitions", () => {
  it("injects the beta channel for CHANNEL=beta", () => {
    expect(releaseChannelDefinitions("beta")).toEqual({
      "process.env.RELEASE_CHANNEL": '"beta"',
    });
  });

  it.each([undefined, "", "rc", "production", "Beta"])(
    "injects the production channel for channel %p",
    (channel) => {
      expect(releaseChannelDefinitions(channel)).toEqual({
        "process.env.RELEASE_CHANNEL": '"production"',
      });
    },
  );

  it("injects the production channel when called with no argument", () => {
    expect(releaseChannelDefinitions()).toEqual({
      "process.env.RELEASE_CHANNEL": '"production"',
    });
  });
});
