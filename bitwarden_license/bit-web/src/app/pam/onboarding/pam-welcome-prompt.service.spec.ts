import { BehaviorSubject, of, Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition } from "@bitwarden/state";
import {
  CoachmarkService,
  PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY,
  PAM_ADMIN_TOUR_COMPLETED_KEY,
  PAM_VAULT_TOUR_COMPLETED_KEY,
  PAM_WELCOME_ACKNOWLEDGED_KEY,
  PAM_WELCOME_TOUR_COMPLETED_KEY,
} from "@bitwarden/vault";

import { PamWelcomePromptService } from "./pam-welcome-prompt.service";
import {
  PamWelcomeDialogComponent,
  PamWelcomeDialogResult,
} from "./welcome/pam-welcome-dialog.component";

describe("PamWelcomePromptService", () => {
  const userId = "user-1" as UserId;

  let organizations: Partial<Organization>[];
  let flagOn: boolean;
  let setKeys: Set<UserKeyDefinition<boolean>>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let closed$: Subject<PamWelcomeDialogResult | undefined>;

  const setUserState = jest.fn();
  const startTour = jest.fn();
  const openSpy = jest.spyOn(PamWelcomeDialogComponent, "open");

  let service: PamWelcomePromptService;

  const pamOrg = { usePam: true, accessPam: true, isProviderUser: false };

  beforeEach(() => {
    jest.clearAllMocks();
    organizations = [pamOrg];
    flagOn = true;
    setKeys = new Set();
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);
    closed$ = new Subject();
    openSpy
      .mockReset()
      .mockReturnValue({ closed: closed$ } as unknown as DialogRef<
        PamWelcomeDialogResult | undefined
      >);
    setUserState.mockResolvedValue(undefined);
    startTour.mockResolvedValue(undefined);

    service = new PamWelcomePromptService(
      { activeAccount$ } as unknown as AccountService,
      { organizations$: () => of(organizations) } as unknown as OrganizationService,
      {
        getFeatureFlag: async (flag: FeatureFlag) => flag === FeatureFlag.Pam && flagOn,
      } as unknown as ConfigService,
      {
        getUserState$: (key: UserKeyDefinition<boolean>) => of(setKeys.has(key) ? true : null),
        setUserState,
      } as unknown as StateProvider,
      {} as DialogService,
      { startTour } as unknown as CoachmarkService,
    );
  });

  describe("shouldPrompt", () => {
    it("is true for an eligible member", async () => {
      expect(await service.shouldPrompt()).toBe(true);
    });

    it("is false when the PAM flag is off", async () => {
      flagOn = false;
      expect(await service.shouldPrompt()).toBe(false);
    });

    it("is false with no active account", async () => {
      activeAccount$.next(null);
      expect(await service.shouldPrompt()).toBe(false);
    });

    it.each([
      ["no organizations", []],
      ["usePam off", [{ ...pamOrg, usePam: false }]],
      ["accessPam false", [{ ...pamOrg, accessPam: false }]],
      ["accessPam undefined", [{ ...pamOrg, accessPam: undefined }]],
      ["provider-only access", [{ ...pamOrg, isProviderUser: true }]],
    ])("is false with %s", async (_name, orgs) => {
      organizations = orgs;
      expect(await service.shouldPrompt()).toBe(false);
    });

    it("is true when any one organization qualifies", async () => {
      organizations = [{ ...pamOrg, usePam: false }, { ...pamOrg, isProviderUser: true }, pamOrg];
      expect(await service.shouldPrompt()).toBe(true);
    });

    it("is false once acknowledged", async () => {
      setKeys.add(PAM_WELCOME_ACKNOWLEDGED_KEY);
      expect(await service.shouldPrompt()).toBe(false);
    });

    it.each([
      ["vault", PAM_VAULT_TOUR_COMPLETED_KEY],
      ["access requests", PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY],
      ["admin", PAM_ADMIN_TOUR_COMPLETED_KEY],
      ["welcome", PAM_WELCOME_TOUR_COMPLETED_KEY],
    ])("is false when the %s tour was completed", async (_name, key) => {
      setKeys.add(key);
      expect(await service.shouldPrompt()).toBe(false);
    });
  });

  describe("prompt", () => {
    it("acknowledges and starts nothing when dismissed", async () => {
      const done = service.prompt();
      await Promise.resolve();
      closed$.next(PamWelcomeDialogResult.Dismissed);
      await done;

      expect(setUserState).toHaveBeenCalledWith(PAM_WELCOME_ACKNOWLEDGED_KEY, true, userId);
      expect(startTour).not.toHaveBeenCalled();
    });

    it("acknowledges when closed without a result", async () => {
      const done = service.prompt();
      await Promise.resolve();
      closed$.next(undefined);
      await done;

      expect(setUserState).toHaveBeenCalledWith(PAM_WELCOME_ACKNOWLEDGED_KEY, true, userId);
      expect(startTour).not.toHaveBeenCalled();
    });

    it("starts the welcome tour only after the dialog closed, on StartTour", async () => {
      const done = service.prompt();
      await Promise.resolve();
      expect(startTour).not.toHaveBeenCalled();

      closed$.next(PamWelcomeDialogResult.StartTour);
      await done;

      expect(setUserState).toHaveBeenCalledWith(PAM_WELCOME_ACKNOWLEDGED_KEY, true, userId);
      expect(startTour).toHaveBeenCalledTimes(1);
    });

    it("opens nothing with no active account", async () => {
      activeAccount$.next(null);
      await service.prompt();
      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
