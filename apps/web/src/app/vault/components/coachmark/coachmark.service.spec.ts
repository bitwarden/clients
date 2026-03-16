import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { COACHMARK_STEPS } from "./coachmark-step";
import { CoachmarkService } from "./coachmark.service";

describe("CoachmarkService", () => {
  let service: CoachmarkService;

  const mockUserId = "user-123" as UserId;

  const getUserState$ = jest.fn().mockReturnValue(of(false));
  const setUserState = jest.fn().mockResolvedValue(undefined);
  const navigate = jest.fn().mockResolvedValue(true);
  const hasOrganizations = jest.fn().mockReturnValue(of(false));
  const t = jest.fn((key: string) => key);

  let activeAccount$: BehaviorSubject<Account | null>;

  function createAccount(overrides: Partial<Account> = {}): Account {
    return {
      id: mockUserId,
      creationDate: new Date(),
      ...overrides,
    } as Account;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    activeAccount$ = new BehaviorSubject<Account | null>(createAccount());

    TestBed.configureTestingModule({
      providers: [
        CoachmarkService,
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: OrganizationService, useValue: { hasOrganizations } },
        { provide: StateProvider, useValue: { getUserState$, setUserState } },
        { provide: I18nService, useValue: { t } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    service = TestBed.inject(CoachmarkService);
  });

  describe("getStepConfig", () => {
    it("returns the config for a known step", () => {
      const config = service.getStepConfig("importData");
      expect(config).toEqual(COACHMARK_STEPS[0]);
    });

    it("returns undefined for an unknown step", () => {
      const config = service.getStepConfig("nonExistent" as any);
      expect(config).toBeUndefined();
    });
  });

  describe("getStepTitle", () => {
    it("returns translated title for a valid step", () => {
      service.getStepTitle("importData");
      expect(t).toHaveBeenCalledWith("coachmarkImportTitle");
    });

    it("returns empty string for an unknown step", () => {
      const result = service.getStepTitle("nonExistent" as any);
      expect(result).toBe("");
    });
  });

  describe("getStepDescription", () => {
    it("returns translated description for a valid step", () => {
      service.getStepDescription("addItem");
      expect(t).toHaveBeenCalledWith("coachmarkAddItemDescription");
    });

    it("returns empty string for an unknown step", () => {
      const result = service.getStepDescription("nonExistent" as any);
      expect(result).toBe("");
    });
  });

  describe("getStepLearnMoreUrl", () => {
    it("returns the learn more URL for a step that has one", () => {
      const url = service.getStepLearnMoreUrl("importData");
      expect(url).toBe("https://bitwarden.com/help/import-data/");
    });

    it("returns undefined for an unknown step", () => {
      const url = service.getStepLearnMoreUrl("nonExistent" as any);
      expect(url).toBeUndefined();
    });
  });

  describe("getStepPosition", () => {
    it("returns the position for a valid step", () => {
      const position = service.getStepPosition("importData");
      expect(position).toBe("right-center");
    });

    it("returns undefined for an unknown step", () => {
      const position = service.getStepPosition("nonExistent" as any);
      expect(position).toBeUndefined();
    });
  });

  describe("startTour", () => {
    it("should not start if already running", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      expect(service.isRunning()).toBe(true);

      navigate.mockClear();
      void service.startTour();
      tick(200);

      expect(navigate).not.toHaveBeenCalled();
    }));

    it("should not start if there is no active account", fakeAsync(() => {
      activeAccount$.next(null);

      void service.startTour();
      tick(200);

      expect(service.isRunning()).toBe(false);
    }));

    it("should not start if tour has already been completed", fakeAsync(() => {
      getUserState$.mockReturnValue(of(true));

      void service.startTour();
      tick(200);

      expect(service.isRunning()).toBe(false);
    }));

    it("should start tour and navigate to first step for non-org user", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      expect(navigate).toHaveBeenCalledWith(["/tools/import"]);
      expect(service.activeStepId()).toBe("importData");
      expect(service.isRunning()).toBe(true);
      expect(service.currentStepNumber()).toBe(1);
    }));

    it("should include org-only steps for org users", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(true));

      void service.startTour();
      tick(200);

      expect(service.totalSteps()).toBe(4);
    }));

    it("should exclude org-only steps for non-org users", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      // shareWithCollections step is excluded
      expect(service.totalSteps()).toBe(3);
    }));
  });

  describe("nextStep", () => {
    beforeEach(fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      navigate.mockClear();
    }));

    it("should advance to the next step", fakeAsync(() => {
      void service.nextStep();
      tick(200);

      expect(service.activeStepId()).toBe("addItem");
      expect(service.currentStepNumber()).toBe(2);
      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    }));

    it("should complete tour when on the last step", fakeAsync(() => {
      // Advance to step 2
      void service.nextStep();
      tick(200);

      // Advance to step 3 (last for non-org)
      void service.nextStep();
      tick(200);

      expect(service.activeStepId()).toBe("monitorSecurity");

      // Next completes the tour
      void service.nextStep();
      tick(200);

      expect(service.isRunning()).toBe(false);
      expect(setUserState).toHaveBeenCalled();
    }));

    it("should do nothing if tour is not running", fakeAsync(() => {
      void service.completeTour();
      tick(200);
      navigate.mockClear();

      void service.nextStep();
      tick(200);

      expect(navigate).not.toHaveBeenCalled();
    }));
  });

  describe("previousStep", () => {
    beforeEach(fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      navigate.mockClear();
    }));

    it("should not go back from the first step", fakeAsync(() => {
      void service.previousStep();
      tick(200);

      expect(navigate).not.toHaveBeenCalled();
      expect(service.activeStepId()).toBe("importData");
    }));

    it("should go back to the previous step", fakeAsync(() => {
      // Advance to step 2
      void service.nextStep();
      tick(200);

      expect(service.activeStepId()).toBe("addItem");
      navigate.mockClear();

      // Go back
      void service.previousStep();
      tick(200);

      expect(service.activeStepId()).toBe("importData");
      expect(navigate).toHaveBeenCalledWith(["/tools/import"]);
    }));

    it("should do nothing if tour is not running", fakeAsync(() => {
      void service.completeTour();
      tick(200);
      navigate.mockClear();

      void service.previousStep();
      tick(200);

      expect(navigate).not.toHaveBeenCalled();
    }));
  });

  describe("completeTour", () => {
    it("should reset state and persist completion", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      expect(service.isRunning()).toBe(true);

      void service.completeTour();
      tick(200);

      expect(service.isRunning()).toBe(false);
      expect(service.activeStepId()).toBeNull();
      expect(service.totalSteps()).toBe(0);
      expect(setUserState).toHaveBeenCalledWith(expect.anything(), true, mockUserId);
    }));

    it("should not persist if no active account", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour();
      tick(200);

      activeAccount$.next(null);

      void service.completeTour();
      tick(200);

      expect(setUserState).not.toHaveBeenCalled();
    }));
  });

  describe("computed signals", () => {
    it("currentStepNumber returns 0 when not running", () => {
      expect(service.currentStepNumber()).toBe(0);
    });

    it("totalSteps returns 0 when not running", () => {
      expect(service.totalSteps()).toBe(0);
    });

    it("isRunning returns false when not running", () => {
      expect(service.isRunning()).toBe(false);
    });
  });
});
