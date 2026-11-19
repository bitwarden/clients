import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DesktopPamNotificationSink } from "./desktop-pam-notification-sink";

describe("DesktopPamNotificationSink", () => {
  let showNotification: jest.Mock;
  let sink: DesktopPamNotificationSink;

  beforeEach(() => {
    showNotification = jest.fn().mockResolvedValue(true);
    (global as any).ipc = { platform: { showNotification } };
    const i18n = {
      t: jest.fn((key: string, count?: string) => (count == null ? key : `${key}:${count}`)),
    } as unknown as I18nService;
    sink = new DesktopPamNotificationSink(i18n);
  });

  afterEach(() => {
    delete (global as any).ipc;
  });

  it("shows one generic notification for a single event, routed to its request", async () => {
    await sink.notify([{ kind: "requestApproved", id: "0b9f1c7e-2d3a-4c5b-8e6f-1a2b3c4d5e6f" }]);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith({
      title: "pamAccessRequestsTitle",
      body: "pamNotificationRequestApprovedOne",
      route: "/pam/requests/0b9f1c7e-2d3a-4c5b-8e6f-1a2b3c4d5e6f",
    });
  });

  it("states a count when several events of a kind arrive together", async () => {
    await sink.notify([
      { kind: "approvalRequested", id: "a" },
      { kind: "approvalRequested", id: "b" },
      { kind: "approvalRequested", id: "c" },
    ]);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith({
      title: "pamAccessRequestsTitle",
      body: "pamNotificationApprovalRequestedMany:3",
      route: "/pam/approvals",
    });
  });

  it("shows one notification per kind", async () => {
    await sink.notify([
      { kind: "leaseEnded", id: "l1" },
      { kind: "approvalRequested", id: "a" },
    ]);

    expect(showNotification.mock.calls.map(([options]) => options.route)).toEqual([
      "/pam/approvals",
      "/pam/my-requests",
    ]);
  });

  it("never puts event ids in the text", async () => {
    await sink.notify([{ kind: "requestDenied", id: "secret-id" }]);

    const { title, body } = showNotification.mock.calls[0][0];
    expect(`${title} ${body}`).not.toContain("secret-id");
  });

  it("shows nothing for no events", async () => {
    await sink.notify([]);

    expect(showNotification).not.toHaveBeenCalled();
  });
});
