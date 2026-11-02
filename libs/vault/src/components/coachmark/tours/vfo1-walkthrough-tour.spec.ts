import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { UserId } from "@bitwarden/common/types/guid";

import { vfo1WalkthroughTour } from "./vfo1-walkthrough-tour";

describe("vfo1WalkthroughTour", () => {
  const userId = "user-id" as UserId;
  const nudgesService = mock<NudgesService>();

  const tour = () => vfo1WalkthroughTour(nudgesService, []);

  it("is completed once the walkthrough nudge is no longer shown", async () => {
    nudgesService.showNudgeSpotlight$.mockReturnValue(of(false));

    expect(await tour().completed(userId)).toBe(true);
    expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
      NudgeType.Vfo1Walkthrough,
      userId,
    );
  });

  it("is not completed while the walkthrough nudge is shown", async () => {
    nudgesService.showNudgeSpotlight$.mockReturnValue(of(true));

    expect(await tour().completed(userId)).toBe(false);
  });

  it("dismisses the walkthrough nudge when completed", async () => {
    await tour().markCompleted(userId);

    expect(nudgesService.dismissNudge).toHaveBeenCalledWith(NudgeType.Vfo1Walkthrough, userId);
  });

  it("keeps the side nav open", () => {
    expect(tour().lockSideNav).toBe(true);
  });
});
