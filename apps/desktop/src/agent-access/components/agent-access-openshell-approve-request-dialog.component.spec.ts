import { TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { OpenShellRequest } from "../models/openshell-requests";

import { AgentAccessOpenShellApproveRequestDialogComponent } from "./agent-access-openshell-approve-request-dialog.component";

function request(overrides: Partial<OpenShellRequest> = {}): OpenShellRequest {
  return {
    id: "927d2e27-780a-4efb-ba16-b8fc1cd0fe32",
    status: "pending",
    rule: "allow_api_stripe_com_443",
    endpoints: [{ host: "api.stripe.com", port: 8443, access: "read-only" }],
    programs: ["/usr/bin/curl"],
    rationale: "Charge a card",
    flagged: false,
    flagNote: "",
    hits: 3,
    firstSeen: "",
    lastSeen: "",
    ...overrides,
  };
}

describe("AgentAccessOpenShellApproveRequestDialogComponent", () => {
  let dialogRef: { close: jest.Mock };

  function render(req: OpenShellRequest) {
    dialogRef = { close: jest.fn() };
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, ...args: unknown[]) => [key, ...args].join("|"));
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellApproveRequestDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { sandboxName: "alpha", request: req } },
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellApproveRequestDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const byId = (root: HTMLElement, testId: string) =>
    root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  afterEach(() => TestBed.resetTestingModule());

  it("names the sandbox, the address (with a non-default port) and the program", () => {
    const root = render(request());

    expect(byId(root, "openshell-request-dialog-callout").textContent).toContain(
      "agentAccessOsReqDialogRequestedBy|alpha",
    );
    expect(byId(root, "openshell-request-dialog-endpoints").textContent).toContain(
      "api.stripe.com:8443",
    );
    expect(byId(root, "openshell-request-dialog-programs").textContent).toContain("/usr/bin/curl");
  });

  it("reports each decision and nothing else", () => {
    const root = render(request());

    byId(root, "openshell-request-dialog-approve").click();
    byId(root, "openshell-request-dialog-deny").click();
    byId(root, "openshell-request-dialog-create-permission").click();

    expect(dialogRef.close.mock.calls).toEqual([
      [{ decision: "approve" }],
      [{ decision: "deny" }],
      [{ decision: "createPermission" }],
    ]);
  });

  it("shows why a flagged request is risky and renders gateway text as text", () => {
    const root = render(request({ flagged: true, flagNote: "<img src=x onerror=alert(1)>" }));

    const callout = byId(root, "openshell-request-dialog-callout");
    expect(callout.textContent).toContain("agentAccessOsReqFlaggedBody");
    expect(callout.textContent).toContain("<img src=x");
    expect(callout.querySelector("img")).toBeNull();
  });

  it("hides Create permission when there is no address to prefill", () => {
    const root = render(request({ endpoints: [] }));
    expect(byId(root, "openshell-request-dialog-create-permission")).toBeNull();
  });
});
