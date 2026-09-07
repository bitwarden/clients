import { NativeMessagingCapability } from "./native-messaging";

describe("NativeMessagingCapability", () => {
  it("asks the client to create the manifests", async () => {
    const generateManifests = jest.fn().mockResolvedValue(null);

    await new NativeMessagingCapability({ generateManifests }).regenerateManifests();

    expect(generateManifests).toHaveBeenCalledWith(true);
  });

  it("surfaces a generation failure", async () => {
    const generateManifests = jest.fn().mockResolvedValue(new Error("no proxy binary"));

    await expect(
      new NativeMessagingCapability({ generateManifests }).regenerateManifests(),
    ).rejects.toThrow("no proxy binary");
  });
});
