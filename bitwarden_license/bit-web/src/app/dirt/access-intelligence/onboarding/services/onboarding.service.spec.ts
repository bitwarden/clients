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

  describe("isCarouselAcknowledged", () => {
    it("returns false when state is null", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(null));
      const result = await service.isCarouselAcknowledged();
      expect(result).toBe(false);
    });

    it("returns false when state is false", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(false));
      const result = await service.isCarouselAcknowledged();
      expect(result).toBe(false);
    });

    it("returns true when state is true", async () => {
      mockStateProvider.getUserState$.mockReturnValue(of(true));
      const result = await service.isCarouselAcknowledged();
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
      const noAccountService = TestBed.inject(OnboardingService);
      const result = await noAccountService.isCarouselAcknowledged();
      expect(result).toBe(false);
    });
  });

  describe("setCarouselAcknowledged", () => {
    it("calls setUserState with true by default", async () => {
      await service.setCarouselAcknowledged();
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "accessIntelligenceCarouselAcknowledged" }),
        true,
        mockAccount.id,
      );
    });

    it("calls setUserState with the provided value", async () => {
      await service.setCarouselAcknowledged(false);
      expect(mockStateProvider.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "accessIntelligenceCarouselAcknowledged" }),
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
      const noAccountService = TestBed.inject(OnboardingService);
      await noAccountService.setCarouselAcknowledged();
      expect(mockStateProvider.setUserState).not.toHaveBeenCalled();
    });
  });
});
