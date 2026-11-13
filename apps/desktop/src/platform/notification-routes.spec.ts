import { isAllowedNotificationRoute } from "./notification-routes";

describe("isAllowedNotificationRoute", () => {
  it.each([
    "/pam/approvals",
    "/pam/my-requests",
    "/pam/history",
    "/pam/requests/0b9f1c7e-2d3a-4c5b-8e6f-1a2b3c4d5e6f",
  ])("admits %s", (route) => {
    expect(isAllowedNotificationRoute(route)).toBe(true);
  });

  it.each([
    "/vault",
    "/pam",
    "/pam/approvals/",
    "/pam/approvals?x=1",
    "/pam/approvals#frag",
    "/pam/requests/not-a-guid",
    "/pam/requests/0b9f1c7e-2d3a-4c5b-8e6f-1a2b3c4d5e6f/extra",
    "//evil.example/pam/approvals",
    "https://evil.example/pam/approvals",
    "pam/approvals",
    "",
    undefined,
    null,
    42,
  ])("rejects %p", (route) => {
    expect(isAllowedNotificationRoute(route)).toBe(false);
  });
});
