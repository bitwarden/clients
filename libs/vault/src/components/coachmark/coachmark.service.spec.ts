import { signal } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SideNavService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

import { CoachmarkStep } from "./coachmark-step";
import { CoachmarkTour } from "./coachmark-tour";
import { CoachmarkService } from "./coachmark.service";
import { newUserTour } from "./tours/new-user-tour";

describe("CoachmarkService", () => {
  let service: CoachmarkService;

  const mockUserId = "user-123" as UserId;

  const getUserState$ = jest.fn().mockReturnValue(of(false));
  const setUserState = jest.fn().mockResolvedValue(undefined);
  const navigate = jest.fn().mockResolvedValue(true);
  const hasOrganizations = jest.fn().mockReturnValue(of(false));
  const decryptedCollections$ = jest.fn().mockReturnValue(of([{} as CollectionView]));
  const t = jest.fn((key: string) => key);
  const vfo1Enabled = jest.fn().mockReturnValue(false);
  const sideNavOpen = signal(false);

  let activeAccount$: BehaviorSubject<Account | null>;
  let tour: CoachmarkTour;

  function createAccount(overrides: Partial<Account> = {}): Account {
    return {
      id: mockUserId,
      creationDate: new Date(),
      ...overrides,
    } as Account;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    vfo1Enabled.mockReturnValue(false);
    decryptedCollections$.mockReturnValue(of([{} as CollectionView]));
    sideNavOpen.set(false);

    activeAccount$ = new BehaviorSubject<Account | null>(createAccount());

    TestBed.configureTestingModule({
      providers: [
        CoachmarkService,
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: OrganizationService, useValue: { hasOrganizations } },
        { provide: StateProvider, useValue: { getUserState$, setUserState } },
        { provide: I18nService, useValue: { t } },
        { provide: Router, useValue: { navigate } },
        { provide: Vfo1TerminologyService, useValue: { enabled: vfo1Enabled } },
        { provide: CollectionService, useValue: { decryptedCollections$ } },
        { provide: SideNavService, useValue: { open: sideNavOpen } },
      ],
    });

    service = TestBed.inject(CoachmarkService);
    tour = newUserTour(TestBed.inject(StateProvider));
  });

  const startTour = fakeAsync(() => {
    void service.startTour(tour);
    tick(200);
  });

  describe("getStepConfig", () => {
    beforeEach(startTour);

    it("returns the config for a known step", () => {
      const config = service.getStepConfig("importData");
      expect(config).toEqual(tour.steps[0]);
    });

    it("returns undefined for an unknown step", () => {
      const config = service.getStepConfig("nonExistent" as any);
      expect(config).toBeUndefined();
    });
  });

  describe("getStepTitle", () => {
    beforeEach(startTour);

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
    beforeEach(startTour);

    it("returns translated description for a valid step", () => {
      service.getStepDescription("addItem");
      expect(t).toHaveBeenCalledWith("coachmarkAddItemDescription");
    });

    it("returns empty string for an unknown step", () => {
      const result = service.getStepDescription("nonExistent" as any);
      expect(result).toBe("");
    });

    it("uses the VFO1 description key for shareWithCollections when terminology is enabled", () => {
      vfo1Enabled.mockReturnValue(true);
      service.getStepDescription("shareWithCollections");
      expect(t).toHaveBeenCalledWith("coachmarkShareWithSharedFoldersDescription");
    });

    it("uses the legacy description key for shareWithCollections when terminology is disabled", () => {
      service.getStepDescription("shareWithCollections");
      expect(t).toHaveBeenCalledWith("coachmarkShareWithCollectionsDescription");
    });
  });

  describe("getStepLearnMoreUrl", () => {
    beforeEach(startTour);

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
    beforeEach(startTour);

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

      void service.startTour(tour);
      tick(200);

      expect(service.isRunning()).toBe(true);

      navigate.mockClear();
      void service.startTour(tour);
      tick(200);

      expect(navigate).not.toHaveBeenCalled();
    }));

    it("should not start if there is no active account", fakeAsync(() => {
      activeAccount$.next(null);

      void service.startTour(tour);
      tick(200);

      expect(service.isRunning()).toBe(false);
    }));

    it("should not start if tour has already been completed", fakeAsync(() => {
      getUserState$.mockReturnValue(of(true));

      void service.startTour(tour);
      tick(200);

      expect(service.isRunning()).toBe(false);
    }));

    it("should start tour and navigate to first step for non-org user", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour(tour);
      tick(200);

      expect(navigate).toHaveBeenCalledWith(["/tools/import"]);
      expect(service.activeStepId()).toBe("importData");
      expect(service.isRunning()).toBe(true);
      expect(service.currentStepNumber()).toBe(1);
    }));

    it("should navigate to the vault for the import step when VFO1 is enabled", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));
      vfo1Enabled.mockReturnValue(true);

      void service.startTour(tour);
      tick(200);

      expect(navigate).toHaveBeenCalledWith(["/vault"]);
      expect(service.activeStepId()).toBe("importData");
    }));

    it("should open the side nav before a step that anchors a nav entry", fakeAsync(() => {
      // See {@link CoachmarkStep.opensSideNav}.
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(true));

      void service.startTour(tour);
      tick(200);

      // The tour starts on importData, which anchors the vault page rather than the nav.
      expect(sideNavOpen()).toBe(false);

      void service.nextStep();
      tick(200);
      void service.nextStep();
      tick(200);

      expect(service.activeStepId()).toBe("shareWithCollections");
      expect(sideNavOpen()).toBe(true);
    }));

    it("should include org-only steps for org users", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(true));
      decryptedCollections$.mockReturnValue(of([{} as CollectionView]));

      void service.startTour(tour);
      tick(200);

      expect(service.totalSteps()).toBe(4);
    }));

    it("should exclude collection-only steps for org users without collections", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(true));
      decryptedCollections$.mockReturnValue(of([]));

      void service.startTour(tour);
      tick(200);

      expect(service.totalSteps()).toBe(3);
    }));

    it("should exclude org-only steps for non-org users", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour(tour);
      tick(200);

      // shareWithCollections step is excluded
      expect(service.totalSteps()).toBe(3);
    }));
  });

  describe("nextStep", () => {
    beforeEach(fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour(tour);
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
      expect(navigate).toHaveBeenCalledWith(["/vault"]);
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

      void service.startTour(tour);
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

      void service.startTour(tour);
      tick(200);

      expect(service.isRunning()).toBe(true);

      navigate.mockClear();
      void service.completeTour();
      tick(200);

      expect(service.isRunning()).toBe(false);
      expect(service.activeStepId()).toBeNull();
      expect(service.totalSteps()).toBe(0);
      expect(setUserState).toHaveBeenCalledWith(expect.anything(), true, mockUserId);
      expect(navigate).toHaveBeenCalledWith(["/vault"]);
    }));

    it("should not persist if no active account", fakeAsync(() => {
      getUserState$.mockReturnValue(of(false));
      hasOrganizations.mockReturnValue(of(false));

      void service.startTour(tour);
      tick(200);

      activeAccount$.next(null);

      void service.completeTour();
      tick(200);

      expect(setUserState).not.toHaveBeenCalled();
    }));
  });

  describe("custom tours", () => {
    function testTour(
      overrides: Partial<CoachmarkTour> & { steps: CoachmarkStep[] },
    ): CoachmarkTour {
      return {
        completed: jest.fn().mockResolvedValue(false),
        markCompleted: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      };
    }

    const step = (overrides: Partial<CoachmarkStep> = {}): CoachmarkStep => ({
      id: "addItem",
      titleKey: "tourATitle",
      descriptionKey: "tourADescription",
      position: "below-center",
      ...overrides,
    });

    it("ignores a second startTour while a tour is running", fakeAsync(() => {
      const tourA = testTour({ steps: [step({ id: "importData" }), step({ id: "addItem" })] });
      const tourB = testTour({ steps: [step({ id: "monitorSecurity" })] });

      void service.startTour(tourA);
      tick(200);
      void service.startTour(tourB);
      tick(200);

      expect(service.activeStepId()).toBe("importData");
      expect(service.totalSteps()).toBe(2);
      expect(tourB.completed).not.toHaveBeenCalled();
    }));

    it("reopens the side nav while a lockSideNav tour runs", fakeAsync(() => {
      void service.startTour(testTour({ steps: [step()], lockSideNav: true }));
      tick(200);
      TestBed.tick();

      sideNavOpen.set(false);
      TestBed.tick();

      expect(sideNavOpen()).toBe(true);
    }));

    it("leaves the side nav closed when the tour does not set lockSideNav", fakeAsync(() => {
      void service.startTour(testTour({ steps: [step()] }));
      tick(200);
      TestBed.tick();

      sideNavOpen.set(false);
      TestBed.tick();

      expect(sideNavOpen()).toBe(false);
    }));

    it("resolves a shared step id against the running tour", fakeAsync(() => {
      const tourB = testTour({ steps: [step({ titleKey: "tourBTitle" })] });

      void service.startTour(tourB);
      tick(200);

      expect(service.getStepTitle("addItem")).toBe("tourBTitle");
    }));

    it("navigates to the tour's endRoute on completion", fakeAsync(() => {
      void service.startTour(testTour({ steps: [step()], endRoute: "/somewhere" }));
      tick(200);
      navigate.mockClear();

      void service.completeTour();
      tick(200);

      expect(navigate).toHaveBeenCalledWith(["/somewhere"]);
    }));

    it("does not navigate on completion when the tour has no endRoute", fakeAsync(() => {
      void service.startTour(testTour({ steps: [step()] }));
      tick(200);
      navigate.mockClear();

      void service.completeTour();
      tick(200);

      expect(navigate).not.toHaveBeenCalled();
    }));
  });

  describe("holdStarts", () => {
    const makeTour = (id: string, overrides: Partial<CoachmarkTour> = {}): CoachmarkTour => ({
      id,
      steps: [
        {
          id: "addItem",
          titleKey: id,
          descriptionKey: id,
          position: "below-center",
        },
      ],
      completed: jest.fn().mockResolvedValue(false),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    it("defers startTour while held and replays it on release", fakeAsync(() => {
      const t1 = makeTour("a");
      const release = service.holdStarts();

      void service.startTour(t1);
      tick(200);
      expect(service.isRunning()).toBe(false);
      expect(t1.completed).not.toHaveBeenCalled();

      release();
      tick(200);
      expect(service.isRunning()).toBe(true);
      expect(service.getStepTitle("addItem")).toBe("a");
    }));

    it("keeps only the latest request per tour id", fakeAsync(() => {
      const first = makeTour("a");
      const second = makeTour("a");
      const release = service.holdStarts();

      void service.startTour(first);
      void service.startTour(second);
      release();
      tick(200);

      expect(first.completed).not.toHaveBeenCalled();
      expect(second.completed).toHaveBeenCalledTimes(1);
    }));

    it("replays in order of arrival through the normal checks", fakeAsync(() => {
      const t1 = makeTour("a");
      const t2 = makeTour("b");
      const release = service.holdStarts();

      void service.startTour(t1);
      void service.startTour(t2);
      release();
      tick(200);

      expect(service.getStepTitle("addItem")).toBe("a");
      expect(t1.completed).toHaveBeenCalled();
      expect(t2.completed).not.toHaveBeenCalled();
    }));

    it("does not replay tours that are already completed", fakeAsync(() => {
      const done = makeTour("a", { completed: jest.fn().mockResolvedValue(true) });
      const release = service.holdStarts();

      void service.startTour(done);
      release();
      tick(200);

      expect(done.completed).toHaveBeenCalled();
      expect(service.isRunning()).toBe(false);
    }));

    it("waits for the last of multiple holds", fakeAsync(() => {
      const t1 = makeTour("a");
      const releaseOne = service.holdStarts();
      const releaseTwo = service.holdStarts();

      void service.startTour(t1);
      releaseOne();
      tick(200);
      expect(service.isRunning()).toBe(false);

      releaseTwo();
      tick(200);
      expect(service.isRunning()).toBe(true);
    }));

    it("treats a second release of the same hold as a no-op", fakeAsync(() => {
      const t1 = makeTour("a");
      const releaseOne = service.holdStarts();
      const releaseTwo = service.holdStarts();

      void service.startTour(t1);
      releaseOne();
      releaseOne();
      tick(200);
      expect(service.isRunning()).toBe(false);

      releaseTwo();
      tick(200);
      expect(service.isRunning()).toBe(true);
    }));

    it("starts tours immediately again after release", fakeAsync(() => {
      service.holdStarts()();
      tick(200);

      void service.startTour(makeTour("a"));
      tick(200);

      expect(service.isRunning()).toBe(true);
    }));
  });

  describe("skipWhenUnanchored", () => {
    const makeTour = (steps: CoachmarkStep[]): CoachmarkTour => ({
      steps,
      completed: jest.fn().mockResolvedValue(false),
      markCompleted: jest.fn().mockResolvedValue(undefined),
    });
    const step = (id: CoachmarkStep["id"], skip = false): CoachmarkStep => ({
      id,
      titleKey: id,
      descriptionKey: id,
      position: "below-center",
      skipWhenUnanchored: skip,
    });

    const mountAnchor = (id: string) => {
      const el = document.createElement("vault-coachmark");
      el.setAttribute("data-coachmark-step", id);
      document.body.appendChild(el);
      return el;
    };
    afterEach(() => document.querySelectorAll("vault-coachmark").forEach((e) => e.remove()));

    it("drops an unanchored first step and starts on the next one", fakeAsync(() => {
      const t = makeTour([step("addItem", true), step("importData")]);
      void service.startTour(t);
      tick(2000);

      expect(service.activeStepId()).toBe("importData");
      expect(service.totalSteps()).toBe(1);
      expect(service.currentStepNumber()).toBe(1);
    }));

    it("starts on an anchored step", fakeAsync(() => {
      mountAnchor("addItem");
      void service.startTour(makeTour([step("addItem", true), step("importData")]));
      tick(2000);

      expect(service.activeStepId()).toBe("addItem");
      expect(service.totalSteps()).toBe(2);
    }));

    it("waits for a slow anchor", fakeAsync(() => {
      void service.startTour(makeTour([step("addItem", true), step("importData")]));
      tick(300);
      mountAnchor("addItem");
      tick(500);

      expect(service.activeStepId()).toBe("addItem");
    }));

    it("ends without completing when no step has an anchor", fakeAsync(() => {
      const t = makeTour([step("addItem", true)]);
      void service.startTour(t);
      tick(2000);

      expect(service.isRunning()).toBe(false);
      expect(t.markCompleted).not.toHaveBeenCalled();
      // And a later start is not blocked by a half-started tour.
      mountAnchor("addItem");
      void service.startTour(t);
      tick(2000);
      expect(service.activeStepId()).toBe("addItem");
    }));

    it("completes when the last step is dropped after earlier ones were shown", fakeAsync(() => {
      const t = makeTour([step("importData"), step("addItem", true)]);
      void service.startTour(t);
      tick(200);
      void service.nextStep();
      tick(2000);

      expect(service.isRunning()).toBe(false);
      expect(t.markCompleted).toHaveBeenCalled();
    }));

    it("stays on the current step when going back onto a dropped step", fakeAsync(() => {
      const t = makeTour([step("addItem", true), step("importData")]);
      void service.startTour(t);
      tick(2000);
      void service.previousStep();
      tick(2000);

      expect(service.activeStepId()).toBe("importData");
    }));

    it("ends a tour whose first step must be anchored, without completing it", fakeAsync(() => {
      const t = makeTour([{ ...step("addItem"), endWhenUnanchored: true }, step("importData")]);
      void service.startTour(t);
      tick(2000);

      expect(service.isRunning()).toBe(false);
      expect(t.markCompleted).not.toHaveBeenCalled();

      // The engine is free again, and the tour can start once its anchor is there.
      mountAnchor("addItem");
      void service.startTour(t);
      tick(200);
      expect(service.activeStepId()).toBe("addItem");
    }));

    it("does not start a second tour while the first waits for its anchor", fakeAsync(() => {
      const first = makeTour([step("addItem", true)]);
      const second = makeTour([step("importData")]);
      void service.startTour(first);
      tick(300);
      void service.startTour(second);
      tick(2000);

      expect(second.completed).not.toHaveBeenCalled();
    }));

    it("does not wait for steps that are not flagged", fakeAsync(() => {
      void service.startTour(makeTour([step("addItem")]));
      tick(200);

      expect(service.activeStepId()).toBe("addItem");
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
