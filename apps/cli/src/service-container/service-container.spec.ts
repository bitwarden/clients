import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/user-core";

import { CliSharedUnlockService } from "../key-management/cli-shared-unlock.service";
import { CliSessionKeyService } from "../platform/services/cli-session-key.service";

import { ServiceContainer } from "./service-container";

describe("ServiceContainer", () => {
  it("instantiates", async () => {
    expect(() => new ServiceContainer()).not.toThrow();
  });

  describe("shared unlock", () => {
    const userId = "user-id" as UserId;

    let container: ServiceContainer;
    let sharedUnlockService: MockProxy<CliSharedUnlockService>;
    let sessionKeyService: MockProxy<CliSessionKeyService>;
    let authService: MockProxy<AuthService>;

    /** Runs the acquisition step `init` performs, without standing up the whole container. */
    async function startSharedUnlock(): Promise<void> {
      await (
        container as unknown as { startSharedUnlock(userId: UserId): Promise<void> }
      ).startSharedUnlock(userId);
    }

    // One container for the whole block: constructing it spins up schedulers that outlive the
    // test, and the collaborators under test are swapped in per case anyway.
    beforeAll(() => {
      container = new ServiceContainer();
    });

    beforeEach(() => {
      sharedUnlockService = mock<CliSharedUnlockService>();
      sessionKeyService = mock<CliSessionKeyService>();
      authService = mock<AuthService>();

      sharedUnlockService.start.mockResolvedValue(true);
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      Object.assign(container, { sharedUnlockService, sessionKeyService, authService });
    });

    it("borrows the desktop app's unlock state while the vault is locked", async () => {
      await startSharedUnlock();

      expect(sharedUnlockService.waitForRemoteUnlock).toHaveBeenCalledWith(userId);
    });

    it("makes a session key available before the peer could unlock anything", async () => {
      await startSharedUnlock();

      expect(sessionKeyService.ensure.mock.invocationCallOrder[0]).toBeLessThan(
        sharedUnlockService.start.mock.invocationCallOrder[0],
      );
    });

    it("does not wait when the vault is already unlocked", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));

      await startSharedUnlock();

      expect(sharedUnlockService.waitForRemoteUnlock).not.toHaveBeenCalled();
    });

    it("does not wait when there is no desktop app to wait for", async () => {
      sharedUnlockService.start.mockResolvedValue(false);

      await startSharedUnlock();

      expect(authService.authStatusFor$).not.toHaveBeenCalled();
      expect(sharedUnlockService.waitForRemoteUnlock).not.toHaveBeenCalled();
    });

    it("releases the peer on dispose, so the process can exit", () => {
      container.dispose();

      expect(sharedUnlockService.abort).toHaveBeenCalled();
    });
  });
});
