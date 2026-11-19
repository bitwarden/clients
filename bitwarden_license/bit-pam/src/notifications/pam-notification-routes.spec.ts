import { groupPamNotificationEvents, pamNotificationRoute } from "./pam-notification-routes";

describe("groupPamNotificationEvents", () => {
  it("batches by kind in announcement order and drops empty kinds", () => {
    const groups = groupPamNotificationEvents([
      { kind: "leaseEnded", id: "l1" },
      { kind: "approvalRequested", id: "a1" },
      { kind: "leaseEnded", id: "l2" },
    ]);

    expect(groups).toEqual([
      { kind: "approvalRequested", ids: ["a1"] },
      { kind: "leaseEnded", ids: ["l1", "l2"] },
    ]);
  });

  it("is empty for no events", () => {
    expect(groupPamNotificationEvents([])).toEqual([]);
  });
});

describe("pamNotificationRoute", () => {
  it("opens the approvals list for approval requests", () => {
    expect(pamNotificationRoute({ kind: "approvalRequested", ids: ["a", "b"] })).toBe(
      "/pam/approvals",
    );
  });

  it("opens the request when one decision is announced, else the list", () => {
    expect(pamNotificationRoute({ kind: "requestApproved", ids: ["r1"] })).toBe("/pam/requests/r1");
    expect(pamNotificationRoute({ kind: "requestDenied", ids: ["r1", "r2"] })).toBe(
      "/pam/my-requests",
    );
  });

  it("opens my requests for lease events", () => {
    expect(pamNotificationRoute({ kind: "leaseEnded", ids: ["l1"] })).toBe("/pam/my-requests");
    expect(pamNotificationRoute({ kind: "leaseEndingSoon", ids: ["l1"] })).toBe("/pam/my-requests");
  });
});
