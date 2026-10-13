import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { UserId } from "@bitwarden/common/types/guid";

import { CoachmarkService } from "../components/coachmark/coachmark.service";

import { Vfo1TourCalloutService } from "./vfo1-tour-callout.service";

describe("Vfo1TourCalloutService", () => {
  let service: Vfo1TourCalloutService;
  let nudgesService: MockProxy<NudgesService>;
  let walkthroughPending: BehaviorSubject<boolean>;
  let newExperiencePending: BehaviorSubject<boolean>;
  let running: WritableSignal<boolean>;
  const userId = "user-id" as UserId;

  beforeEach(() => {
    walkthroughPending = new BehaviorSubject(true);
    newExperiencePending = new BehaviorSubject(false);
    running = signal(false);

    nudgesService = mock<NudgesService>();
    nudgesService.showNudgeSpotlight$.mockImplementation((nudge) =>
      nudge === NudgeType.Vfo1Walkthrough ? walkthroughPending : newExperiencePending,
    );

    TestBed.configureTestingModule({
      providers: [
        Vfo1TourCalloutService,
        { provide: NudgesService, useValue: nudgesService },
        { provide: CoachmarkService, useValue: { isRunning: running, startTour: jest.fn() } },
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

  describe("dismiss", () => {
    it("dismisses the walkthrough nudge", async () => {
      await service.dismiss(userId);

      expect(nudgesService.dismissNudge).toHaveBeenCalledWith(NudgeType.Vfo1Walkthrough, userId);
    });
  });
});
