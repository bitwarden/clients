import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { PamSdkService } from "./pam-sdk.service";
import {
  createPamSdkTestKit,
  PAM_TEST_USER_ID,
  pamTestAccountService,
} from "./testing/pam-test-helpers";

describe("PamSdkService", () => {
  describe("run", () => {
    it("hands the PAM client of the user to the callback and returns its result", async () => {
      const kit = createPamSdkTestKit();

      const result = await kit.pamSdkService.run(PAM_TEST_USER_ID, async (pam) => {
        expect(pam).toBe(kit.pam);
        return "done";
      });

      expect(result).toBe("done");
      expect(kit.sdkService.userClient$).toHaveBeenCalledWith(PAM_TEST_USER_ID);
    });

    it("releases the SDK reference after the callback", async () => {
      const kit = createPamSdkTestKit();

      await kit.pamSdkService.run(PAM_TEST_USER_ID, async (): Promise<void> => undefined);

      // The Rc is never marked for disposal, so release only drops the count; the value is not freed.
      expect(kit.freed).not.toHaveBeenCalled();
    });

    it("logs only the error's own text when the callback fails, then rethrows it", async () => {
      const kit = createPamSdkTestKit();
      const error = Object.assign(new Error("status code 403"), { name: "AccessLeaseError" });

      await expect(
        kit.pamSdkService.run(PAM_TEST_USER_ID, async () => {
          throw error;
        }),
      ).rejects.toBe(error);

      expect(kit.logService.error).toHaveBeenCalledTimes(1);
      expect(kit.logService.error).toHaveBeenCalledWith(
        "PAM SDK call failed: AccessLeaseError: status code 403",
      );
    });

    it("does not log what the callback received or returned", async () => {
      const kit = createPamSdkTestKit();

      await expect(
        kit.pamSdkService.run(PAM_TEST_USER_ID, async () => {
          throw new Error("failed");
        }),
      ).rejects.toThrow();

      const logged = JSON.stringify(kit.logService.error.mock.calls);
      expect(logged).not.toContain(PAM_TEST_USER_ID);
    });
  });

  describe("runAsActiveUser", () => {
    it("runs against the active account", async () => {
      const otherUser = "33333333-3333-4333-8333-333333333333" as UserId;
      const sdkService = mock<SdkService>();
      sdkService.userClient$.mockReturnValue(of());
      const service = new PamSdkService(
        sdkService,
        pamTestAccountService(otherUser),
        mock<LogService>(),
      );

      // userClient$ emits nothing here, which only proves which user it was asked for.
      await service.runAsActiveUser(async (): Promise<number> => 1).catch((): void => undefined);

      expect(sdkService.userClient$).toHaveBeenCalledWith(otherUser);
    });
  });

  describe("activeUserId", () => {
    it("is the id of the active account", async () => {
      const kit = createPamSdkTestKit();

      await expect(kit.pamSdkService.activeUserId()).resolves.toBe(PAM_TEST_USER_ID);
    });
  });
});
