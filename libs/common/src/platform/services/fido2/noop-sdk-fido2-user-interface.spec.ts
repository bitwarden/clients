import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "../../abstractions/log.service";

import { NoopSdkFido2UserInterface } from "./noop-sdk-fido2-user-interface";

describe("NoopSdkFido2UserInterface", () => {
  let logService: MockProxy<LogService>;
  let userInterface: NoopSdkFido2UserInterface;

  beforeEach(() => {
    logService = mock<LogService>();
    userInterface = new NoopSdkFido2UserInterface(logService);
  });

  it("reports verification as enabled, matching the prompting adapter", () => {
    expect(userInterface.is_verification_enabled).toBe(true);
  });

  it("declines check_user and warns", async () => {
    await expect(userInterface.check_user()).resolves.toEqual({
      userPresent: false,
      userVerified: false,
    });
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining("NoopSdkFido2UserInterface.check_user"),
    );
  });

  it.each([
    [
      "pick_credential_for_authentication",
      () => userInterface.pick_credential_for_authentication(),
    ],
    [
      "check_user_and_pick_credential_for_creation",
      () => userInterface.check_user_and_pick_credential_for_creation(),
    ],
  ])("warns and rejects %s, since no value picks nothing", async (name, call) => {
    await expect(call()).rejects.toThrow(`NoopSdkFido2UserInterface.${name}`);
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining(`NoopSdkFido2UserInterface.${name}`),
    );
  });
});
