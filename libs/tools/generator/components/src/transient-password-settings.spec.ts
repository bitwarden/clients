/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

import { firstValueFrom, of } from "rxjs";

import { GeneratorConstraints, PasswordGeneratorSettings } from "@bitwarden/generator-core";

import { TransientPasswordSettings } from "./transient-password-settings";

describe("TransientPasswordSettings", () => {
  const policy = {
    constraints: {},
    adjust: (s: PasswordGeneratorSettings) => ({ ...s, length: Math.max(s.length ?? 0, 14) }),
    fix: (s: PasswordGeneratorSettings) => s,
  } as GeneratorConstraints<PasswordGeneratorSettings>;

  it("applies policy", async () => {
    const settings = new TransientPasswordSettings({ length: 8 }, of(policy));

    const { state } = await firstValueFrom(settings.withConstraints$);

    expect(state.length).toBe(14);
  });

  it("replaces the settings on update but keeps the website's characters", async () => {
    const settings = new TransientPasswordSettings(
      {
        length: 16,
        lowercase: true,
        minLowercase: 1,
        customRequiredChars: "-_",
        maxConsecutive: 2,
      },
      of(policy),
    );

    settings.next({ length: 20, lowercase: false });

    expect(settings.value).toEqual({
      length: 20,
      lowercase: false,
      customRequiredChars: "-_",
      customAllowedChars: undefined,
      maxConsecutive: 2,
    });
    const { state } = await firstValueFrom(settings.withConstraints$);
    expect(state.lowercase).toBe(false);
  });
});
