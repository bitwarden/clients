import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { CoachmarkService } from "../components/coachmark/coachmark.service";
import {
  VFO1_SHARED_FOLDERS_STEP,
  VFO1_SWITCH_PRODUCTS_STEP,
  VFO1_VAULT_LIST_STEP,
  VFO1_WALKTHROUGH_STEPS,
} from "../components/coachmark/tours/vfo1-walkthrough-tour";
import { VaultsNavViewModel } from "../models/vault-nav-view-model";

import { VaultNavService } from "./vault-nav.service";
import { Vfo1TourCalloutService } from "./vfo1-tour-callout.service";

describe("Vfo1TourCalloutService", () => {
  let service: Vfo1TourCalloutService;
  let nudgesService: MockProxy<NudgesService>;
  let walkthroughPending: BehaviorSubject<boolean>;
  let newExperiencePending: BehaviorSubject<boolean>;
  let running: WritableSignal<boolean>;
  const startTour = jest.fn();
  const viewModel$ = jest.fn();
  const userId = "user-id" as UserId;

  beforeEach(() => {
    walkthroughPending = new BehaviorSubject(true);
    newExperiencePending = new BehaviorSubject(false);
    running = signal(false);
    startTour.mockClear();

    nudgesService = mock<NudgesService>();
    nudgesService.showNudgeSpotlight$.mockImplementation((nudge) =>
      nudge === NudgeType.Vfo1Walkthrough ? walkthroughPending : newExperiencePending,
    );

    TestBed.configureTestingModule({
      providers: [
        Vfo1TourCalloutService,
        { provide: NudgesService, useValue: nudgesService },
        { provide: CoachmarkService, useValue: { isRunning: running, startTour } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId } as Account) } },
        { provide: VaultNavService, useValue: { viewModel$ } },
        {
          provide: VFO1_WALKTHROUGH_STEPS,
          useValue: [VFO1_SWITCH_PRODUCTS_STEP, VFO1_VAULT_LIST_STEP, VFO1_SHARED_FOLDERS_STEP],
        },
      ],
    });

    service = TestBed.inject(Vfo1TourCalloutService);
  });

  describe("show$", () => {
    it("shows once the new-look dialog is dismissed and the walkthrough is pending", async () => {
      expect(await firstValueFrom(service.show$(userId))).toBe(true);
    });

    it("hides while the new-look dialog is still pending", async () => {
      newExperiencePending.next(true);

      expect(await firstValueFrom(service.show$(userId))).toBe(false);
    });

    it("hides while a tour is running", async () => {
      running.set(true);
      TestBed.tick();

      expect(await firstValueFrom(service.show$(userId))).toBe(false);
    });

    it("hides once the walkthrough is dismissed", async () => {
      walkthroughPending.next(false);

      expect(await firstValueFrom(service.show$(userId))).toBe(false);
    });
  });

  describe("claimsSlot$", () => {
    it("stays true while a tour runs", async () => {
      running.set(true);
      TestBed.tick();

      expect(await firstValueFrom(service.claimsSlot$(userId))).toBe(true);
    });

    it("is false while the new-look dialog is still pending", async () => {
      newExperiencePending.next(true);

      expect(await firstValueFrom(service.claimsSlot$(userId))).toBe(false);
    });

    it("is false once the walkthrough is dismissed", async () => {
      walkthroughPending.next(false);

      expect(await firstValueFrom(service.claimsSlot$(userId))).toBe(false);
    });
  });

  describe("startTour", () => {
    const startedStepIds = async (nav: VaultsNavViewModel) => {
      viewModel$.mockReturnValue(of(nav));

      await service.startTour();

      return startTour.mock.calls[0][0].steps.map((step: { id: string }) => step.id);
    };

    const vaultsNav = (
      vaultCount: number,
      organizationDataOwnership = false,
    ): VaultsNavViewModel => ({
      vaults: Array.from({ length: vaultCount }, (_, i) => ({ id: `vault-${i}` })) as never,
      organizationDataOwnership,
    });

    it("keeps the vault list step when the nav lists several vaults under a Vaults header", async () => {
      expect(await startedStepIds(vaultsNav(2))).toEqual([
        "switchProducts",
        "vaultList",
        "sharedFolders",
      ]);
    });

    it("drops the vault list step for an account with only its personal vault", async () => {
      expect(await startedStepIds(vaultsNav(1))).toEqual(["switchProducts", "sharedFolders"]);
    });

    it("drops the vault list step for an account under data ownership", async () => {
      expect(await startedStepIds(vaultsNav(2, true))).toEqual(["switchProducts", "sharedFolders"]);
    });
  });

  describe("dismiss", () => {
    it("dismisses the walkthrough nudge", async () => {
      await service.dismiss(userId);

      expect(nudgesService.dismissNudge).toHaveBeenCalledWith(NudgeType.Vfo1Walkthrough, userId);
    });
  });
});
