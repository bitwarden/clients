import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { FakeStateProvider } from "@bitwarden/state-test-utils";
import { UserId } from "@bitwarden/user-core";

import { mockAccountServiceWith } from "../../../spec";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { PinService } from "./pin.service.implementation";

describe("PinService", () => {
  const userId = "00000000-0000-0000-0000-000000000000" as UserId;

  // SDK reference chain: sdk.take() -> ref.value.user_crypto_management().pin_settings()
  const pinSettings = { set_pin: jest.fn(), unset_pin: jest.fn() };
  const sdk = {
    take: jest.fn().mockReturnValue({
      value: { user_crypto_management: () => ({ pin_settings: () => pinSettings }) },
      [Symbol.dispose]: jest.fn(),
    }),
  };

  let stateProvider: FakeStateProvider;
  let sut: PinService;

  beforeEach(() => {
    jest.clearAllMocks();
    const sdkService = mock<SdkService>();
    sdkService.userClient$.mockReturnValue(of(sdk) as any);
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    sut = new PinService(sdkService, stateProvider);
  });

  it("saves the PIN's length when the PIN is set", async () => {
    await sut.setPin("123456", "BeforeFirstUnlock", userId);

    expect(pinSettings.set_pin).toHaveBeenCalledWith("123456", "BeforeFirstUnlock");
    expect(await firstValueFrom(sut.pinLength$(userId))).toBe(6);
  });

  it("forgets the PIN's length when the PIN is unset", async () => {
    await sut.setPin("1234", "AfterFirstUnlock", userId);

    await sut.unsetPin(userId);

    expect(pinSettings.unset_pin).toHaveBeenCalled();
    expect(await firstValueFrom(sut.pinLength$(userId))).toBeNull();
  });

  it("remembers the length of a PIN that unlocked", async () => {
    await sut.rememberPinLength("12345", userId);

    expect(await firstValueFrom(sut.pinLength$(userId))).toBe(5);
  });
});
