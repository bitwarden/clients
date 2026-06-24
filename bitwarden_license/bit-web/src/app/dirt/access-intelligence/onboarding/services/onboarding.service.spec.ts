import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { StateProvider } from "@bitwarden/state";

import { OnboardingService } from "./onboarding.service";

const mockAccount = { id: "test-user-id-123" };

describe("OnboardingService", () => {
  let service: OnboardingService;
  let mockStateProvider: { getUserState$: jest.Mock; setUserState: jest.Mock };

  beforeEach(async () => {
    mockStateProvider = {
      getUserState$: jest.fn().mockReturnValue(of(null)),
      setUserState: jest.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      providers: [
        OnboardingService,
        { provide: AccountService, useValue: { activeAccount$: of(mockAccount) } },
        { provide: StateProvider, useValue: mockStateProvider },
      ],
    });

    service = TestBed.inject(OnboardingService);
  });

  describe("isNewAdminWelcomeDialogAcknowledged", () => {
    it("returns false when state is null", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(null));
      const result = await service.isNewAdminWelcomeDialogAcknowledged();
      expect(result).toBe(false);
    });

    it("returns false when state is false", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(false));
      const result = await service.isNewAdminWelcomeDialogAcknowledged();
      expect(result).toBe(false);
    });

    it("returns true when state is true", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(true));
      const result = await service.isNewAdminWelcomeDialogAcknowledged();
      expect(result).toBe(true);
    });

    it("returns false when there is no active account", async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [
          OnboardingService,
          { provide: AccountService, useValue: { activeAccount$: of(null) } },
          { provide: StateProvider, useValue: mockStateProvider },
        ],
      });
      const service = TestBed.inject(OnboardingService);
      const result = await service.isNewAdminWelcomeDialogAcknowledged();
      expect(result).toBe(false);
    });
  });

  describe("setNewAdminWelcomeDialogAcknowledged", () => {
    it("calls setUserState with true by default", async () => {
      await service.setNewAdminWelcomeDialogAcknowledged();
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "accessIntelligenceNewAdminWelcomeAcknowledged" }),
        true,
        mockAccount.id,
      );
    });

    it("calls setUserState with the provided value", async () => {
      await service.setNewAdminWelcomeDialogAcknowledged(false);
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "accessIntelligenceNewAdminWelcomeAcknowledged" }),
        false,
        mockAccount.id,
      );
    });

    it("does not call setUserState when there is no active account", async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [
          OnboardingService,
          { provide: AccountService, useValue: { activeAccount$: of(null) } },
          { provide: StateProvider, useValue: mockStateProvider },
        ],
      });
      const onboardingSvc = TestBed.inject(OnboardingService);
      await onboardingSvc.setNewAdminWelcomeDialogAcknowledged();
      expect(mockStateProvider.setUserState).not.toHaveBeenCalled();
    });
  });

  describe("isAICoachmarkTourCompleted", () => {
    it("returns false when state is null", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(null));
      const result = await service.isAICoachmarkTourCompleted();
      expect(result).toBe(false);
    });

    it("returns false when state is false", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(false));
      const result = await service.isAICoachmarkTourCompleted();
      expect(result).toBe(false);
    });

    it("returns true when state is true", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(true));
      const result = await service.isAICoachmarkTourCompleted();
      expect(result).toBe(true);
    });

    it("returns false when there is no active account", async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [
          OnboardingService,
          { provide: AccountService, useValue: { activeAccount$: of(null) } },
          { provide: StateProvider, useValue: mockStateProvider },
        ],
      });
      const svc = TestBed.inject(OnboardingService);
      const result = await svc.isAICoachmarkTourCompleted();
      expect(result).toBe(false);
    });
  });

  describe("setAICoachmarkTourCompleted", () => {
    it("calls setUserState with true by default", async () => {
      await service.setAICoachmarkTourCompleted();
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "aiCoachmarkTourCompleted" }),
        true,
        mockAccount.id,
      );
    });

    it("calls setUserState with the provided value", async () => {
      await service.setAICoachmarkTourCompleted(false);
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "aiCoachmarkTourCompleted" }),
        false,
        mockAccount.id,
      );
    });

    it("does not call setUserState when there is no active account", async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [
          OnboardingService,
          { provide: AccountService, useValue: { activeAccount$: of(null) } },
          { provide: StateProvider, useValue: mockStateProvider },
        ],
      });
      const svc = TestBed.inject(OnboardingService);
      await svc.setAICoachmarkTourCompleted();
      expect(mockStateProvider.setUserState).not.toHaveBeenCalled();
    });
  });
});
