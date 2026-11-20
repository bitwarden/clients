import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import {
  PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY,
  PAM_ADMIN_TOUR_COMPLETED_KEY,
  PAM_VAULT_TOUR_COMPLETED_KEY,
  PAM_WELCOME_ACKNOWLEDGED_KEY,
  PAM_WELCOME_TOUR_COMPLETED_KEY,
  pamAccessRequestsTour,
  pamAdminTour,
  pamVaultTour,
  pamWelcomeTour,
} from "./pam-tours";

describe("PAM tours", () => {
  const userId = "user-id" as UserId;
  let stateProvider: ReturnType<typeof mock<StateProvider>>;
  const ids = (t: { steps: { id: string }[] }) => t.steps.map((s) => s.id);

  beforeEach(() => {
    stateProvider = mock<StateProvider>();
  });

  it("vault tour has request access then my requests nav", () => {
    expect(ids(pamVaultTour(stateProvider))).toEqual(["pamRequestAccess", "pamMyRequestsNav"]);
  });

  it("welcome tour drops its column step when that anchor is not mounted", () => {
    const steps = pamWelcomeTour(stateProvider).steps;
    expect(ids({ steps })).toEqual(["pamPrivilegedItems", "pamMyRequestsNav"]);
    expect(steps.find((s) => s.id === "pamPrivilegedItems")?.skipWhenUnanchored).toBe(true);
    expect(steps.find((s) => s.id === "pamMyRequestsNav")?.skipWhenUnanchored).toBeFalsy();
  });

  it("vault tour ends rather than stalls when its request access anchor is gone", () => {
    expect(pamVaultTour(stateProvider).steps[0].endWhenUnanchored).toBe(true);
  });

  it("the active access step navigates to the My requests tab that mounts its anchor", () => {
    for (const canApprove of [true, false]) {
      const step = pamAccessRequestsTour(stateProvider, canApprove).steps.find(
        (s) => s.id === "pamActiveAccess",
      );
      expect(step?.route).toBe("/pam/my-requests");
    }
  });

  it("access requests tour omits approvals for non-approvers", () => {
    expect(ids(pamAccessRequestsTour(stateProvider, false))).toEqual([
      "pamMyRequestsTab",
      "pamActiveAccess",
      "pamHistoryTab",
    ]);
  });

  it("access requests tour includes approvals for approvers", () => {
    expect(ids(pamAccessRequestsTour(stateProvider, true))).toEqual([
      "pamApprovalsTab",
      "pamMyRequestsTab",
      "pamActiveAccess",
      "pamHistoryTab",
    ]);
  });

  it("admin tour always has the group step and only visible items, in order", () => {
    expect(ids(pamAdminTour(stateProvider, []))).toEqual(["pamOrgGroup"]);
    expect(ids(pamAdminTour(stateProvider, ["pamRotation", "pamAccessRules"]))).toEqual([
      "pamOrgGroup",
      "pamAccessRules",
      "pamRotation",
    ]);
  });

  it("admin tour locks the side nav", () => {
    expect(pamAdminTour(stateProvider, []).lockSideNav).toBe(true);
  });

  it.each([
    ["vault", () => pamVaultTour(stateProvider), PAM_VAULT_TOUR_COMPLETED_KEY],
    [
      "access requests",
      () => pamAccessRequestsTour(stateProvider, true),
      PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY,
    ],
    ["admin", () => pamAdminTour(stateProvider, []), PAM_ADMIN_TOUR_COMPLETED_KEY],
    ["welcome", () => pamWelcomeTour(stateProvider), PAM_WELCOME_TOUR_COMPLETED_KEY],
  ])("%s tour persists completion under its own key", async (_name, make, key) => {
    stateProvider.getUserState$.mockReturnValue(of(undefined));
    expect(await make().completed(userId)).toBe(false);
    expect(stateProvider.getUserState$).toHaveBeenCalledWith(key, userId);

    stateProvider.getUserState$.mockReturnValue(of(true));
    expect(await make().completed(userId)).toBe(true);

    await make().markCompleted(userId);
    expect(stateProvider.setUserState).toHaveBeenCalledWith(key, true, userId);
  });

  it("uses distinct state keys per tour", () => {
    const keys = [
      PAM_VAULT_TOUR_COMPLETED_KEY,
      PAM_ACCESS_REQUESTS_TOUR_COMPLETED_KEY,
      PAM_ADMIN_TOUR_COMPLETED_KEY,
      PAM_WELCOME_TOUR_COMPLETED_KEY,
      PAM_WELCOME_ACKNOWLEDGED_KEY,
    ].map((k) => k.key);
    expect(new Set(keys).size).toBe(5);
  });
});
