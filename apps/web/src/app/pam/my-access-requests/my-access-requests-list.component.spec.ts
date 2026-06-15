import { ComponentFixture, TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { I18nMockService, ToastService } from "@bitwarden/components";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver, ResolvedNames } from "../access-request-name-resolver.service";

import { MyAccessRequestsListComponent } from "./my-access-requests-list.component";
import { MyAccessRequestsService } from "./my-access-requests.service";

function emptyResolvedNames(): ResolvedNames {
  return { cipherNameById: new Map(), collectionNameById: new Map(), cipherById: new Map() };
}

/** A Login cipher with a website URI, so `app-vault-icon` resolves a favicon. */
function loginCipher(id: string): CipherView {
  const login = Object.assign(new LoginView(), {
    uris: [Object.assign(new LoginUriView(), { uri: "https://example.com" })],
  });
  return Object.assign(new CipherView(), { id, name: id, type: CipherType.Login, login });
}

type ResponseFixture = {
  id: string;
  cipherId?: string;
  status: AccessRequestStatus;
  submittedAt?: string;
  resolvedAt?: string | null;
  approverId?: string | null;
  approverComment?: string | null;
  requestedNotBefore?: string | null;
  requestedNotAfter?: string | null;
  requestedTtlSeconds?: number;
};

function makeResponse(fixture: ResponseFixture): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: fixture.id,
    CipherId: fixture.cipherId ?? `cipher-${fixture.id}`,
    CollectionId: "col-1",
    RequesterUserId: "me",
    Status: fixture.status,
    RequestedNotBefore: fixture.requestedNotBefore ?? null,
    RequestedNotAfter: fixture.requestedNotAfter ?? null,
    RequestedTtlSeconds: fixture.requestedTtlSeconds ?? 3600,
    Reason: null,
    SubmittedAt: fixture.submittedAt ?? "2026-05-01T00:00:00Z",
    ResolvedAt: fixture.resolvedAt ?? null,
    ResolverUserId: fixture.approverId ?? null,
    ResolverComment: fixture.approverComment ?? null,
    LeaseId: null,
  });
}

function makeLease(id: string, cipherId: string): AccessLeaseResponse {
  const now = Date.now();
  return new AccessLeaseResponse({
    Id: id,
    RequestId: `req-${id}`,
    CipherId: cipherId,
    CollectionId: "col-1",
    GranteeUserId: "me",
    NotBefore: new Date(now - 60 * 60 * 1000).toISOString(),
    NotAfter: new Date(now + 60 * 60 * 1000).toISOString(),
    Status: "active",
  });
}

describe("MyAccessRequestsListComponent", () => {
  let pamApi: MockProxy<PamApiService>;
  let toast: MockProxy<ToastService>;
  let nameResolver: MockProxy<AccessRequestNameResolver>;

  const i18n = new I18nMockService({
    loading: "Loading…",
    cancel: "Cancel",
    window: "Window",
    pamMyRequestsEmptyTitle: "No access requests yet",
    pamMyRequestsEmptyDescription: "When you request access…",
    pamMyLeasesActiveSection: "Active leases",
    pamMyLeasesActiveEmpty: "No active leases",
    pamMyRequestsPendingSection: "Pending",
    pamMyRequestsHistorySection: "History",
    pamMyRequestsPendingEmpty: "No pending requests.",
    pamMyRequestsHistoryEmpty: "No request history.",
    pamMyRequestsLoadError: "Load error",
    pamMyRequestsCancelSuccess: "Cancelled",
    pamMyRequestsCancelError: "Cancel error",
    pamStatusPending: "Pending",
    pamStatusApproved: "Approved",
    pamStatusDenied: "Denied",
    pamStatusCancelled: "Cancelled",
    pamStatusExpired: "Expired",
    pamColumnItem: "Item",
    pamColumnRequestedWindow: "Requested window",
    pamColumnSubmitted: "Submitted",
    pamColumnRemaining: "Remaining",
    pamColumnStatus: "Status",
    pamColumnResolver: "Resolver",
    pamColumnComment: "Comment",
    pamColumnResolved: "Resolved",
    pamInboxInCollection: "in __$1__",
    pamResolverAccessRule: "Access rule",
    pamWindowUntil: "Until __$1__",
    pamWindowTtlSeconds: "__$1__s",
    pamStartLeaseButton: "Start access",
    pamStartLeaseSuccess: "Access started",
    pamStartLeaseError: "Start error",
    pamActivateWithin: "Activate within __$1__",
    actions: "Actions",
  });

  beforeEach(async () => {
    pamApi = mock<PamApiService>();
    pamApi.listMyAccessRequests.mockResolvedValue([]);
    pamApi.listActiveLeases.mockResolvedValue([]);

    toast = mock<ToastService>();

    nameResolver = mock<AccessRequestNameResolver>();
    nameResolver.resolveDisplayNames.mockResolvedValue(emptyResolvedNames());
    nameResolver.namesFor.mockResolvedValue(emptyResolvedNames());
    nameResolver.collectionNames$.mockReturnValue(of(new Map()));

    await TestBed.configureTestingModule({
      imports: [MyAccessRequestsListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        MyAccessRequestsService,
        { provide: PamApiService, useValue: pamApi },
        { provide: AccessRequestNameResolver, useValue: nameResolver },
        { provide: I18nService, useValue: i18n },
        { provide: ToastService, useValue: toast },
        { provide: LogService, useValue: { error: jest.fn() } },
        // `app-vault-icon` dependencies — only exercised by rows that resolve a cipher.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }).compileComponents();
  });

  // The component ticks a 1s interval for the countdown labels, so the zone never stabilizes and
  // `fixture.whenStable()` would hang — create inside fakeAsync and flush the load with tick().
  const create = (
    responses: AccessRequestDetailsResponse[],
    leases: AccessLeaseResponse[] = [],
  ): ComponentFixture<MyAccessRequestsListComponent> => {
    pamApi.listMyAccessRequests.mockResolvedValue(responses);
    pamApi.listActiveLeases.mockResolvedValue(leases);
    const fixture = TestBed.createComponent(MyAccessRequestsListComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    return fixture;
  };

  it("shows the global empty state when there are no requests or leases", fakeAsync(() => {
    const fixture = create([]);
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-empty"]')).not.toBeNull();
  }));

  it("places pending rows in the Pending section", fakeAsync(() => {
    const fixture = create([
      makeResponse({ id: "p1", status: "pending" }),
      makeResponse({ id: "p2", status: "pending" }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-row-p1"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-row-p2"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-history-empty"]'),
    ).not.toBeNull();
  }));

  it("renders an active lease with its resolved cipher name", fakeAsync(() => {
    nameResolver.namesFor.mockResolvedValue({
      cipherNameById: new Map([["cipher-1", "Prod DB"]]),
      collectionNameById: new Map([["col-1", "Production"]]),
      cipherById: new Map(),
    });
    const fixture = create([], [makeLease("lease-1", "cipher-1")]);
    const row = fixture.nativeElement.querySelector(
      '[data-testid="my-leases-row-lease-1"]',
    ) as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.textContent).toContain("Prod DB");
    expect(row.textContent).toContain("in Production");
  }));

  it("renders the cipher and collection names resolved from local vault state", fakeAsync(() => {
    nameResolver.resolveDisplayNames.mockImplementation(async (rows) => {
      rows.forEach((row) => {
        row.cipherName = "Production DB";
        row.collectionName = "Engineering";
      });
      return emptyResolvedNames();
    });

    const fixture = create([makeResponse({ id: "p1", cipherId: "cipher-p1", status: "pending" })]);

    const cell = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-pending-row-p1"] td',
    ) as HTMLElement;
    expect(nameResolver.resolveDisplayNames).toHaveBeenCalled();
    expect(cell.textContent).toContain("Production DB");
    expect(cell.textContent).toContain("in Engineering");
  }));

  it("renders a favicon for a request whose cipher is in local vault state", fakeAsync(() => {
    nameResolver.resolveDisplayNames.mockResolvedValue({
      ...emptyResolvedNames(),
      cipherById: new Map([["cipher-p1", loginCipher("cipher-p1")]]),
    });

    const fixture = create([makeResponse({ id: "p1", cipherId: "cipher-p1", status: "pending" })]);

    const row = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-pending-row-p1"]',
    ) as HTMLElement;
    expect(row.querySelector("app-vault-icon")).not.toBeNull();
  }));

  it("omits the favicon for a request whose cipher is absent from local vault state", fakeAsync(() => {
    const fixture = create([makeResponse({ id: "p1", cipherId: "cipher-xyz", status: "pending" })]);

    const row = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-pending-row-p1"]',
    ) as HTMLElement;
    expect(row.querySelector("app-vault-icon")).toBeNull();
  }));

  it("falls back to the cipher id when the cipher is not in local vault state", fakeAsync(() => {
    const fixture = create([makeResponse({ id: "p1", cipherId: "cipher-xyz", status: "pending" })]);

    const cell = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-pending-row-p1"] td',
    ) as HTMLElement;
    expect(cell.textContent).toContain("cipher-xyz");
  }));

  it("places every resolved row in the History section, regardless of age", fakeAsync(() => {
    const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const fixture = create([
      makeResponse({ id: "r1", status: "approved", resolvedAt: old, approverId: "user-7" }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-history-row-r1"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-empty"]'),
    ).not.toBeNull();
  }));

  it("offers Start for an approved request whose window can still produce access", fakeAsync(() => {
    const fixture = create([
      makeResponse({
        id: "a1",
        status: "approved",
        resolvedAt: new Date().toISOString(),
        approverId: "user-7",
        requestedNotAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-start-a1"]'),
    ).not.toBeNull();
  }));

  it("hides Start for an approved request whose window has lapsed — the server would reject it", fakeAsync(() => {
    const fixture = create([
      makeResponse({
        id: "a2",
        status: "approved",
        resolvedAt: new Date().toISOString(),
        approverId: "user-7",
        requestedNotAfter: new Date(Date.now() - 60 * 1000).toISOString(),
      }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-history-row-a2"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-start-a2"]')).toBeNull();
  }));

  it("cancels a pending request optimistically and calls the API", fakeAsync(() => {
    pamApi.listMyAccessRequests.mockResolvedValue([makeResponse({ id: "p1", status: "pending" })]);
    pamApi.cancelAccessRequest.mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(MyAccessRequestsListComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-cancel-p1"]',
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    fixture.detectChanges();

    // Optimistically moved to History as cancelled.
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-history-row-p1"]'),
    ).not.toBeNull();
    expect(pamApi.cancelAccessRequest).toHaveBeenCalledWith("p1");

    flush();
    fixture.detectChanges();
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  }));

  it("reverts the optimistic cancel when the API call fails", fakeAsync(() => {
    pamApi.listMyAccessRequests.mockResolvedValue([makeResponse({ id: "p1", status: "pending" })]);
    pamApi.cancelAccessRequest.mockRejectedValue(new Error("boom"));

    const fixture = TestBed.createComponent(MyAccessRequestsListComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="my-requests-cancel-p1"]',
    ) as HTMLButtonElement;
    button.click();
    flush();
    fixture.detectChanges();

    // Row reverted to pending.
    expect(
      fixture.nativeElement.querySelector('[data-testid="my-requests-pending-row-p1"]'),
    ).not.toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  }));

  it("shows a toast and renders the empty state when load fails", fakeAsync(() => {
    pamApi.listMyAccessRequests.mockRejectedValue(new Error("boom"));

    const fixture = TestBed.createComponent(MyAccessRequestsListComponent);
    fixture.detectChanges();
    flush();
    fixture.detectChanges();

    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(fixture.nativeElement.querySelector('[data-testid="my-requests-empty"]')).not.toBeNull();
  }));
});
