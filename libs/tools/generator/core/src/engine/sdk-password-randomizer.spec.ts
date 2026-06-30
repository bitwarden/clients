/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

import { mock, MockProxy } from "jest-mock-extended";

import { GeneratorClient, PasswordManagerClient } from "@bitwarden/sdk-internal";

import { Algorithm, Type } from "../metadata";
import { PassphraseGenerationOptions, PasswordGenerationOptions } from "../types";

import { SdkPasswordRandomizer } from "./sdk-password-randomizer";

function createMockClient(): {
  client: MockProxy<PasswordManagerClient>;
  generator: MockProxy<GeneratorClient>;
} {
  const generator = mock<GeneratorClient>();
  const client = mock<PasswordManagerClient>();
  client.generator.mockReturnValue(generator);
  return { client, generator };
}

describe("SdkPasswordRandomizer", () => {
  describe("generate", () => {
    it("calls client.generator().password with the converted PasswordGeneratorRequest", async () => {
      const { client, generator } = createMockClient();
      generator.password.mockReturnValue("generated-password");

      const settings: PasswordGenerationOptions = {
        length: 16,
        ambiguous: true,
        uppercase: true,
        minUppercase: 1,
        lowercase: true,
        minLowercase: 2,
        number: true,
        minNumber: 3,
        special: true,
        minSpecial: 4,
      };
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => 0,
      );

      await sdk.generate({ algorithm: Algorithm.password }, settings);

      // `ambiguous: true` means ambiguous characters MAY be included, so the
      // SDK's `avoidAmbiguous` (the exclude flag) must be `false`.
      expect(generator.password).toHaveBeenCalledWith({
        lowercase: true,
        uppercase: true,
        numbers: true,
        special: true,
        length: 16,
        avoidAmbiguous: false,
        minLowercase: 2,
        minUppercase: 1,
        minNumber: 3,
        minSpecial: 4,
      });
    });

    it("passes ambiguous: false through to the SDK as avoidAmbiguous: true", async () => {
      // Regression test for the semantic-inversion bug where `avoidAmbiguous` was
      // mapped directly from `ambiguous` instead of being negated. Storage
      // semantic: `ambiguous: false` means ambiguous chars should NOT be included,
      // which the SDK expresses as `avoidAmbiguous: true`.
      const { client, generator } = createMockClient();
      generator.password.mockReturnValue("generated-password");

      const settings: PasswordGenerationOptions = {
        length: 16,
        ambiguous: false,
        uppercase: true,
        minUppercase: 1,
        lowercase: true,
        minLowercase: 1,
        number: true,
        minNumber: 1,
        special: true,
        minSpecial: 1,
      };
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => 0,
      );

      await sdk.generate({ algorithm: Algorithm.password }, settings);

      expect(generator.password).toHaveBeenCalledWith(
        expect.objectContaining({ avoidAmbiguous: true }),
      );
    });

    it("passes non-ambiguous password fields through to the SDK unchanged", async () => {
      // Guards against future regressions where another field is accidentally
      // inverted. Uses values inverted from the first test to catch any field
      // that's secretly being negated.
      const { client, generator } = createMockClient();
      generator.password.mockReturnValue("generated-password");

      const settings: PasswordGenerationOptions = {
        length: 24,
        ambiguous: false,
        uppercase: false,
        minUppercase: 0,
        lowercase: false,
        minLowercase: 0,
        number: false,
        minNumber: 0,
        special: false,
        minSpecial: 0,
      };
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => 0,
      );

      await sdk.generate({ algorithm: Algorithm.password }, settings);

      expect(generator.password).toHaveBeenCalledWith({
        lowercase: false,
        uppercase: false,
        numbers: false,
        special: false,
        length: 24,
        avoidAmbiguous: true,
        minLowercase: 0,
        minUppercase: 0,
        minNumber: 0,
        minSpecial: 0,
      });
    });

    it("calls client.generator().passphrase with the converted PassphraseGeneratorRequest", async () => {
      const { client, generator } = createMockClient();
      generator.passphrase.mockReturnValue("generated-passphrase");

      const settings: PassphraseGenerationOptions = {
        numWords: 5,
        wordSeparator: "-",
        capitalize: true,
        includeNumber: false,
      };
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => 0,
      );

      await sdk.generate({ algorithm: Algorithm.passphrase }, settings);

      expect(generator.passphrase).toHaveBeenCalledWith({
        numWords: 5,
        wordSeparator: "-",
        capitalize: true,
        includeNumber: false,
      });
    });

    it("returns a GeneratedCredential populated from the SDK response and the request", async () => {
      const { client, generator } = createMockClient();
      generator.password.mockReturnValue("generated-password");
      const now = 1_700_000_000_000;
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => now,
      );

      const result = await sdk.generate(
        { algorithm: Algorithm.password, source: "test-source", website: "example.com" },
        { length: 10 },
      );

      expect(result.credential).toEqual("generated-password");
      expect(result.category).toEqual(Type.password);
      expect(result.generationDate.valueOf()).toEqual(now);
      expect(result.source).toEqual("test-source");
      expect(result.website).toEqual("example.com");
    });

    it("returns a passphrase-flavored GeneratedCredential when given passphrase options", async () => {
      const { client, generator } = createMockClient();
      generator.passphrase.mockReturnValue("correct-horse-battery-staple");
      const now = 1_700_000_000_000;
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => now,
      );

      const result = await sdk.generate(
        { algorithm: Algorithm.passphrase, source: "passphrase-source" },
        { numWords: 4 },
      );

      expect(result.credential).toEqual("correct-horse-battery-staple");
      expect(result.category).toEqual(Type.password);
      expect(result.generationDate.valueOf()).toEqual(now);
      expect(result.source).toEqual("passphrase-source");
    });

    it("throws when the settings match neither password nor passphrase options", async () => {
      const { client } = createMockClient();
      const sdk = new SdkPasswordRandomizer(
        () => Promise.resolve(client),
        () => 0,
      );

      const result = sdk.generate(
        { algorithm: Algorithm.password },
        {} as PasswordGenerationOptions,
      );

      await expect(result).rejects.toThrow("Invalid settings received by generator.");
    });

    it("invokes the client factory on every generate() call", async () => {
      const { client, generator } = createMockClient();
      generator.password.mockReturnValue("generated-password");
      const clientFactory = jest.fn().mockResolvedValue(client);
      const sdk = new SdkPasswordRandomizer(clientFactory, () => 0);

      await sdk.generate({ algorithm: Algorithm.password }, { length: 10 });
      await sdk.generate({ algorithm: Algorithm.password }, { length: 10 });
      await sdk.generate({ algorithm: Algorithm.password }, { length: 10 });

      expect(clientFactory).toHaveBeenCalledTimes(3);
    });

    it("invokes currentTime on every generate() call and uses its value as the timestamp", async () => {
      const { client, generator } = createMockClient();
      generator.password.mockReturnValue("generated-password");
      const currentTime = jest.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);
      const sdk = new SdkPasswordRandomizer(() => Promise.resolve(client), currentTime);

      const first = await sdk.generate({ algorithm: Algorithm.password }, { length: 10 });
      const second = await sdk.generate({ algorithm: Algorithm.password }, { length: 10 });

      expect(currentTime).toHaveBeenCalledTimes(2);
      expect(first.generationDate.valueOf()).toEqual(1_000);
      expect(second.generationDate.valueOf()).toEqual(2_000);
    });
  });
});
