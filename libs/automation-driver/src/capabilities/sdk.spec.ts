import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { SdkCapability } from "./sdk";

describe("SdkCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;

  let sdkService: ReturnType<typeof mock<SdkService>>;
  let client: PasswordManagerClient;
  let rc: Rc<PasswordManagerClient>;
  let sut: SdkCapability;

  beforeEach(() => {
    sdkService = mock<SdkService>();
    client = { free: jest.fn() } as unknown as PasswordManagerClient;
    rc = new Rc(client);
    sdkService.userClient$.mockReturnValue(of(rc));
    sut = new SdkCapability(sdkService);
  });

  it("runs the callback against the user's client", async () => {
    await expect(sut.forUser(userId, (c) => c)).resolves.toBe(client);
    expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
  });

  it("releases the client reference once the callback completes", async () => {
    await sut.forUser(userId, () => undefined);
    rc.markForDisposal();

    expect(client.free).toHaveBeenCalled();
  });

  it("propagates errors thrown by the callback", async () => {
    await expect(
      sut.forUser(userId, () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
