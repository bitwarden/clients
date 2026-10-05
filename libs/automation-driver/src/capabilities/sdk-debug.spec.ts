import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { SdkDebugCapability } from "./sdk-debug";

describe("SdkDebugCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;

  let sdkService: ReturnType<typeof mock<SdkService>>;
  let sut: SdkDebugCapability;

  function provideClient(client: object) {
    const rc = new Rc({ free: jest.fn(), ...client } as unknown as PasswordManagerClient);
    sdkService.userClient$.mockReturnValue(of(rc));
    return rc;
  }

  beforeEach(() => {
    sdkService = mock<SdkService>();
    sut = new SdkDebugCapability(sdkService);
  });

  it("runs the callback against the user's debug tree", async () => {
    const debugTree = { state: () => ({ types: () => ["Cipher"] }) };
    provideClient({ debug: () => debugTree });

    await expect(sut.forUser(userId, (d: any) => d.state().types())).resolves.toEqual(["Cipher"]);
    expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
  });

  it("releases the client reference once the callback completes", async () => {
    const rc = provideClient({ debug: () => ({}) });
    const free = (rc as any).value.free;

    await sut.forUser(userId, () => undefined);
    rc.markForDisposal();

    expect(free).toHaveBeenCalled();
  });

  it("rejects when the SDK was built without debug capabilities", async () => {
    provideClient({});

    await expect(sut.forUser(userId, () => undefined)).rejects.toThrow(
      "This SDK build has no debug capabilities",
    );
  });
});
