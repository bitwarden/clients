import { SdkRandomNumberClient } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { Utils } from "../../../platform/misc/utils";

import { DefaultAgentAccessPskGenerator } from "./default-agent-access-psk-generator";

jest.mock("@bitwarden/sdk-internal");

describe("DefaultAgentAccessPskGenerator", () => {
  let genBytes: jest.Mock;
  let generator: DefaultAgentAccessPskGenerator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Deterministic 32 bytes so the base64 output is assertable.
    const bytes = new Uint8Array(32).map((_, i) => i);
    genBytes = jest.fn().mockReturnValue(bytes);
    jest
      .mocked(SdkRandomNumberClient)
      .mockImplementation(() => ({ gen_bytes: genBytes }) as unknown as SdkRandomNumberClient);

    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });

    generator = new DefaultAgentAccessPskGenerator();
  });

  it("returns 32 SDK-generated random bytes as a base64 string", async () => {
    const psk = await generator.generate();

    expect(genBytes).toHaveBeenCalledWith(32);
    expect(psk).toEqual(Utils.fromBufferToB64(new Uint8Array(32).map((_, i) => i)));
  });

  it("awaits SDK readiness before generating", async () => {
    let resolveReady: () => void;
    Object.defineProperty(SdkLoadService, "Ready", {
      value: new Promise<void>((resolve) => (resolveReady = resolve)),
      configurable: true,
    });

    const pending = generator.generate();

    // The SDK client must not be touched until readiness resolves.
    expect(SdkRandomNumberClient).not.toHaveBeenCalled();

    resolveReady!();
    await pending;

    expect(SdkRandomNumberClient).toHaveBeenCalledTimes(1);
    expect(genBytes).toHaveBeenCalledWith(32);
  });
});
