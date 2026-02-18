import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import { WebVaultExtensionPromptDialogComponent } from "../components/web-vault-extension-prompt/web-vault-extension-prompt-dialog.component";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";
import { WebVaultExtensionPromptService } from "./web-vault-extension-prompt.service";

describe("WebVaultExtensionPromptService", () => {
  let service: WebVaultExtensionPromptService;

  const mockUserId = "user-123" as UserId;
  const mockAccountCreationDate = new Date("2026-01-15");

  const getFeatureFlag = jest.fn();
  const extensionInstalled$ = new BehaviorSubject<boolean>(false);
  const mockStateSubject = new BehaviorSubject<boolean>(false);
  const activeAccountSubject = new BehaviorSubject<{ id: UserId; creationDate: Date | null }>({
    id: mockUserId,
    creationDate: mockAccountCreationDate,
  });
  const getUser = jest.fn().mockReturnValue({ state$: mockStateSubject.asObservable() });

  beforeEach(() => {
    jest.clearAllMocks();
    getFeatureFlag.mockResolvedValue(false);
    extensionInstalled$.next(false);
    mockStateSubject.next(false);
    activeAccountSubject.next({ id: mockUserId, creationDate: mockAccountCreationDate });

    TestBed.configureTestingModule({
      providers: [
        WebVaultExtensionPromptService,
        {
          provide: StateProvider,
          useValue: {
            getUser,
          },
        },
        {
          provide: WebBrowserInteractionService,
          useValue: {
            extensionInstalled$: extensionInstalled$.asObservable(),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: activeAccountSubject.asObservable(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag,
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: jest.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(WebVaultExtensionPromptService);
  });

  describe("conditionallyPromptUserForExtension", () => {
    it("returns false when feature flag is disabled", async () => {
      getFeatureFlag.mockResolvedValueOnce(false);

      const result = await service.conditionallyPromptUserForExtension(mockUserId);

      expect(result).toBe(false);
      expect(getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM29438_WelcomeDialogWithExtensionPrompt,
      );
    });

    it("returns false when dialog has been dismissed", async () => {
      getFeatureFlag.mockResolvedValueOnce(true);
      mockStateSubject.next(true);
      extensionInstalled$.next(false);

      const result = await service.conditionallyPromptUserForExtension(mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when profile is not within thresholds (too old)", async () => {
      getFeatureFlag
        .mockResolvedValueOnce(true) // Main feature flag
        .mockResolvedValueOnce(0); // Min age days
      mockStateSubject.next(false);
      extensionInstalled$.next(false);
      const oldAccountDate = new Date("2025-12-01"); // More than 30 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: oldAccountDate });

      const result = await service.conditionallyPromptUserForExtension(mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when profile is not within thresholds (too young)", async () => {
      getFeatureFlag
        .mockResolvedValueOnce(true) // Main feature flag
        .mockResolvedValueOnce(10); // Min age days = 10
      mockStateSubject.next(false);
      extensionInstalled$.next(false);
      const youngAccountDate = new Date(); // Today
      youngAccountDate.setDate(youngAccountDate.getDate() - 5); // 5 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: youngAccountDate });

      const result = await service.conditionallyPromptUserForExtension(mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when extension is installed", async () => {
      getFeatureFlag
        .mockResolvedValueOnce(true) // Main feature flag
        .mockResolvedValueOnce(0); // Min age days
      mockStateSubject.next(false);
      extensionInstalled$.next(true);

      const result = await service.conditionallyPromptUserForExtension(mockUserId);

      expect(result).toBe(false);
    });

    it("returns true and opens dialog when all conditions are met", async () => {
      getFeatureFlag
        .mockResolvedValueOnce(true) // Main feature flag
        .mockResolvedValueOnce(0); // Min age days
      mockStateSubject.next(false);
      extensionInstalled$.next(false);

      // Set account creation date to be within threshold (15 days old)
      const validCreationDate = new Date();
      validCreationDate.setDate(validCreationDate.getDate() - 15);
      activeAccountSubject.next({ id: mockUserId, creationDate: validCreationDate });

      const dialogClosedSubject = new BehaviorSubject<void>(undefined);
      const openSpy = jest
        .spyOn(WebVaultExtensionPromptDialogComponent, "open")
        .mockReturnValue({ closed: dialogClosedSubject.asObservable() } as any);

      const resultPromise = service.conditionallyPromptUserForExtension(mockUserId);

      // Close the dialog
      dialogClosedSubject.next(undefined);

      const result = await resultPromise;

      expect(openSpy).toHaveBeenCalledWith(expect.anything());
      expect(result).toBe(true);
    });
  });

  describe("profileIsWithinThresholds", () => {
    it("returns false when account is younger than min threshold", async () => {
      const minAgeDays = 7;
      getFeatureFlag.mockResolvedValueOnce(minAgeDays);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: recentDate });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(false);
    });

    it("returns true when account is exactly at min threshold", async () => {
      const minAgeDays = 7;
      getFeatureFlag.mockResolvedValueOnce(minAgeDays);

      const exactDate = new Date();
      exactDate.setDate(exactDate.getDate() - 7); // Exactly 7 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: exactDate });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(true);
    });

    it("returns true when account is within the thresholds", async () => {
      const minAgeDays = 0;
      getFeatureFlag.mockResolvedValueOnce(minAgeDays);

      const validDate = new Date();
      validDate.setDate(validDate.getDate() - 15); // 15 days old (between 0 and 30)
      activeAccountSubject.next({ id: mockUserId, creationDate: validDate });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(true);
    });

    it("returns false when account is older than max threshold (30 days)", async () => {
      const minAgeDays = 0;
      getFeatureFlag.mockResolvedValueOnce(minAgeDays);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: oldDate });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(false);
    });

    it("returns false when account is exactly 30 days old", async () => {
      const minAgeDays = 0;
      getFeatureFlag.mockResolvedValueOnce(minAgeDays);

      const exactDate = new Date();
      exactDate.setDate(exactDate.getDate() - 30); // Exactly 30 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: exactDate });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(false);
    });

    it("uses default min age of 0 when feature flag is null", async () => {
      getFeatureFlag.mockResolvedValueOnce(null);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days old
      activeAccountSubject.next({ id: mockUserId, creationDate: recentDate });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(true);
    });

    it("defaults to false", async () => {
      getFeatureFlag.mockResolvedValueOnce(0);
      activeAccountSubject.next({ id: mockUserId, creationDate: null });

      const result = await service["profileIsWithinThresholds"]();

      expect(result).toBe(false);
    });
  });

  describe("getDialogDismissedState", () => {
    it("returns the SingleUserState for the dialog dismissed state", () => {
      service.getDialogDismissedState(mockUserId);

      expect(getUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          key: "vaultWelcomeExtensionDialogDismissed",
        }),
      );
    });
  });
});
