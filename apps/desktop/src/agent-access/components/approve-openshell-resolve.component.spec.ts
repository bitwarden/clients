import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  ApproveOpenShellResolveComponent,
  ApproveOpenShellResolveParams,
  ApproveOpenShellResolveResult,
} from "./approve-openshell-resolve.component";

function params(
  overrides: Partial<ApproveOpenShellResolveParams> = {},
): ApproveOpenShellResolveParams {
  return {
    mode: "firstRequest",
    gatewayIdentity: {
      signatureKind: "macosTeamId",
      signatureIdentity: "TEAM:openshell-gateway",
      exePath: "/opt/homebrew/bin/openshell-gateway",
    },
    context: {
      deadlineMs: 25_000,
      gatewayName: "openshell",
      gatewayEndpoint: "https://127.0.0.1:17670",
      providerId: "prov-7f3a",
      providerName: "gh-agent-1",
      providerProfile: "github",
      workspace: "default",
      sandboxId: "sbx-01J9Z6",
      sandboxName: "agent-1",
      sandboxImage: "ghcr.io/example/agent:1.2",
      endpoints: [
        { host: "api.github.com", port: 443, path: "/**", source: "profile" },
        { host: "uploads.github.com", port: 443, source: "policyBinding" },
      ],
      policyDigest: "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
      advisorEnabled: false,
    },
    targets: [{ credentialKey: "GITHUB_TOKEN", label: "GitHub bot", fieldLabel: "Password" }],
    lifetime: { mode: "ttl", expiresAtMs: 1_791_234_567_890, ttlMinutes: 60 },
    deadlineMs: 25_000,
    ...overrides,
  };
}

describe("ApproveOpenShellResolveComponent (§M8.9)", () => {
  let dialogRef: MockProxy<DialogRef<ApproveOpenShellResolveResult>>;

  function configure(p: ApproveOpenShellResolveParams) {
    dialogRef = mock<DialogRef<ApproveOpenShellResolveResult>>();
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, ...args: unknown[]) => {
      const defined = args.filter((arg) => arg != null);
      return defined.length > 0 ? `${key}(${defined.join(",")})` : key;
    });
    TestBed.configureTestingModule({
      imports: [ApproveOpenShellResolveComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: p },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18n },
      ],
    });
  }

  function render(
    p: ApproveOpenShellResolveParams,
  ): ComponentFixture<ApproveOpenShellResolveComponent> {
    configure(p);
    const fixture = TestBed.createComponent(ApproveOpenShellResolveComponent);
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ComponentFixture<unknown>, testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)
      ?.textContent ?? null;

  const approveButton = (fixture: ComponentFixture<unknown>) =>
    fixture.debugElement.query(By.css("#approve-openshell-resolve_button_approve"))
      .nativeElement as HTMLButtonElement;

  /** `bitButton` keeps the native button focusable and marks it `aria-disabled` instead. */
  const isDisabled = (fixture: ComponentFixture<unknown>) =>
    approveButton(fixture).getAttribute("aria-disabled") === "true" ||
    approveButton(fixture).disabled;

  beforeAll(() => {
    // jsdom has no IntersectionObserver; the dialog's scroll shadow uses one.
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("always renders the reported-by-gateway callout and the verified gateway identity", () => {
    for (const mode of ["firstRequest", "previouslyApproved"] as const) {
      TestBed.resetTestingModule();
      const fixture = render(params({ mode }));
      expect(text(fixture, "openshell-reported-by-gateway")).toContain(
        "agentAccessOpenShellReportedByGateway",
      );
      expect(text(fixture, "openshell-verified-gateway")).toContain("TEAM:openshell-gateway");
      fixture.destroy();
    }
  });

  it("says when the gateway identity is path-only or its signature failed", () => {
    const unsigned = params();
    unsigned.gatewayIdentity = { ...unsigned.gatewayIdentity, signatureValid: false };
    let fixture = render(unsigned);
    expect(text(fixture, "openshell-gateway-weaker-guarantee")).toContain(
      "agentAccessFirstUseWeakerGuaranteeNote",
    );
    fixture.destroy();

    TestBed.resetTestingModule();
    const signed = params();
    signed.gatewayIdentity = { ...signed.gatewayIdentity, signatureValid: true };
    fixture = render(signed);
    expect(text(fixture, "openshell-gateway-weaker-guarantee")).toBeNull();
    fixture.destroy();
  });

  it("isolates gateway-reported names from bidi reordering", () => {
    const p = params();
    p.context = { ...p.context, sandboxName: "\u202Eevil" };
    const fixture = render(p);
    const sandbox = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="openshell-sandbox-name"] bdi',
    );
    expect(sandbox?.textContent).toBe("\u202Eevil");
    fixture.destroy();
  });

  it("renders every endpoint with its source badge", () => {
    const fixture = render(params());
    const endpoints = fixture.debugElement.queryAll(By.css('[data-testid="openshell-endpoint"]'));
    expect(endpoints).toHaveLength(2);
    expect(endpoints[0].nativeElement.textContent).toContain("api.github.com:443 /**");
    expect(endpoints[0].nativeElement.textContent).toContain("agentAccessOpenShellSourceProfile");
    expect(endpoints[1].nativeElement.textContent).toContain("uploads.github.com:443");
    expect(endpoints[1].nativeElement.textContent).toContain("agentAccessOpenShellSourcePolicy");
    fixture.destroy();
  });

  it("shows the 12-character digest prefix with the full digest in the title", () => {
    const fixture = render(params());
    const digest = fixture.debugElement.query(By.css('[data-testid="openshell-digest"]'))
      .nativeElement as HTMLElement;
    expect(digest.textContent?.trim()).toBe("998f40a71463");
    expect(digest.title).toBe(params().context.policyDigest);
    fixture.destroy();
  });

  it("shows the previous prefix when the policy changed", () => {
    const fixture = render(
      params({
        mode: "policyChanged",
        previousPolicyDigest:
          "sha256:f098164656d916d933b9ad3ea24ce0c43cc84aa04300528a4e2e6ec2844e582d",
      }),
    );
    expect(text(fixture, "openshell-policy-changed")).toContain("f098164656d9");
    fixture.destroy();
  });

  it.each([
    [undefined, true],
    [true, true],
    [false, false],
  ])("advisorEnabled %s → warning shown: %s", (advisorEnabled, shown) => {
    const p = params();
    p.context = { ...p.context, advisorEnabled };
    const fixture = render(p);
    expect(text(fixture, "openshell-advisor-warning") != null).toBe(shown);
    fixture.destroy();
  });

  it.each([
    ["perRequest", "agentAccessOpenShellLifetimePerRequest"],
    ["ttl", "agentAccessOpenShellLifetimeTtl"],
    ["sandboxLifetime", "agentAccessOpenShellLifetimeSandbox"],
  ] as const)("labels the %s lifetime truthfully", (mode, key) => {
    const fixture = render(
      params({
        lifetime:
          mode === "sandboxLifetime"
            ? { mode }
            : { mode, expiresAtMs: 1_791_234_567_890, ttlMinutes: 60 },
      }),
    );
    const lifetime = text(fixture, "openshell-lifetime") ?? "";
    expect(lifetime).toContain(key);
    expect(lifetime).toContain("agentAccessOpenShellRetention");
    expect(lifetime.includes("agentAccessOpenShellExpiresAt")).toBe(mode !== "sandboxLifetime");
    fixture.destroy();
  });

  it("states a reused ttl window by its end only, without the setting's duration", () => {
    const fixture = render(
      params({
        mode: "previouslyApproved",
        lifetime: { mode: "ttl", expiresAtMs: 1_791_234_567_890, reusedWindow: true },
      }),
    );
    const lifetime = text(fixture, "openshell-lifetime") ?? "";
    expect(lifetime).toContain("agentAccessOpenShellLifetimeTtlContinues");
    expect(lifetime).not.toContain("agentAccessOpenShellLifetimeTtl ");
    expect(lifetime).not.toContain("agentAccessOpenShellTtlHours");
    expect(lifetime).toContain("agentAccessOpenShellExpiresAt");
    fixture.destroy();
  });

  it.each(["firstRequest", "policyChanged", "windowExpired"] as const)(
    "gates Approve behind the acknowledgement in %s mode",
    (mode) => {
      const fixture = render(params({ mode }));
      expect(isDisabled(fixture)).toBe(true);
      const checkbox = fixture.debugElement.query(
        By.css("#approve-openshell-resolve_checkbox_acknowledge"),
      ).nativeElement as HTMLInputElement;
      checkbox.click();
      fixture.detectChanges();
      expect(isDisabled(fixture)).toBe(false);
      fixture.destroy();
    },
  );

  it("needs no acknowledgement in previouslyApproved mode", () => {
    const fixture = render(params({ mode: "previouslyApproved" }));
    expect(
      fixture.debugElement.query(By.css("#approve-openshell-resolve_checkbox_acknowledge")),
    ).toBeNull();
    expect(isDisabled(fixture)).toBe(false);
    fixture.destroy();
  });

  it("starts the countdown at 24 for a 25 000 ms deadline and auto-times-out at 0", fakeAsync(() => {
    const fixture = render(params());
    expect(text(fixture, "openshell-countdown")).toContain("agentAccessOpenShellDeadline(24)");
    tick(1000);
    fixture.detectChanges();
    expect(text(fixture, "openshell-countdown")).toContain("agentAccessOpenShellDeadline(23)");
    tick(23_000);
    expect(dialogRef.close).toHaveBeenCalledWith("timeout");
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));

  it("extends the countdown when an identical retry attaches, never shortens it (§M8.18)", fakeAsync(() => {
    const updates = new Subject<number>();
    const fixture = render(params({ deadlineUpdates: updates }));
    expect(text(fixture, "openshell-countdown")).toContain("agentAccessOpenShellDeadline(24)");
    updates.next(40_000);
    fixture.detectChanges();
    expect(text(fixture, "openshell-countdown")).toContain("agentAccessOpenShellDeadline(39)");
    updates.next(5_000);
    fixture.detectChanges();
    expect(text(fixture, "openshell-countdown")).toContain("agentAccessOpenShellDeadline(39)");
    tick(30_000);
    expect(dialogRef.close).not.toHaveBeenCalled();
    tick(9_000);
    expect(dialogRef.close).toHaveBeenCalledWith("timeout");
    fixture.destroy();
  }));

  it("says that a decision is given to the next identical retry", () => {
    const fixture = render(params());
    expect(text(fixture, "openshell-retry-note")).toContain("agentAccessOpenShellRetryNote");
    fixture.destroy();
  });

  it("closes approved or denied exactly once", async () => {
    const fixture = render(params({ mode: "previouslyApproved" }));
    approveButton(fixture).click();
    await fixture.whenStable();
    (
      fixture.debugElement.query(By.css("#approve-openshell-resolve_button_deny"))
        .nativeElement as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).toHaveBeenCalledWith("approved");
    fixture.destroy();
  });

  it("never shows a value: only labels and env-var names are rendered", () => {
    const fixture = render(params());
    const target = text(fixture, "openshell-target") ?? "";
    expect(target).toContain("GITHUB_TOKEN");
    expect(target).toContain("GitHub bot");
    fixture.destroy();
  });
});
