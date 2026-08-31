import { DatePipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import * as papa from "papaparse";
import { Subject, of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserUserMiniResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DialogService,
  DrawerRef,
  FilterMenuComponent,
  FilterOptionComponent,
  I18nMockService,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessNameResolverService,
  emptyResolvedNames,
} from "../access-requests/access-name-resolver.service";

import { AccessAuditComponent } from "./access-audit.component";
import { AuditApiService, AuditTrailFilter, AuditTrailPage } from "./audit-api.service";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";
import { AccessAuditItemResponse } from "./responses/access-audit-item.response";

const ORGANIZATION_ID = "org-1";

function event(overrides: Record<string, unknown> = {}): AccessAuditEventResponse {
  return new AccessAuditEventResponse({
    Kind: "requestApproved",
    OccurredAt: "2026-08-18T09:00:00.000Z",
    OrganizationId: ORGANIZATION_ID,
    ActorId: "user-1",
    ActorName: "Ada",
    ActorEmail: "ada@example.com",
    RequesterId: "user-2",
    RequesterName: "Grace",
    RequesterEmail: "grace@example.com",
    Automated: false,
    Incomplete: false,
    ...overrides,
  });
}

/** A subject the trail names, as the Item menu read returns it. */
function cipherItem(cipherId: string, collectionId: string | null = null): AccessAuditItemResponse {
  return new AccessAuditItemResponse({ CipherId: cipherId, CollectionId: collectionId });
}

function ruleItem(ruleId: string, ruleName: string): AccessAuditItemResponse {
  return new AccessAuditItemResponse({ RuleId: ruleId, RuleName: ruleName });
}

/**
 * One entry of `getAllMiniUserDetails`, which is what bridges the PLATFORM user id an audit row carries
 * to the ORGANIZATION USER id the entity-events dialog is keyed on.
 */
function member(userId: string, organizationUserId: string, name: string, email: string) {
  return { userId, id: organizationUserId, name, email };
}

function miniUserDetails(members: ReturnType<typeof member>[]) {
  return { data: members } as unknown as ListResponse<OrganizationUserUserMiniResponse>;
}

describe("AccessAuditComponent", () => {
  let fixture: ComponentFixture<AccessAuditComponent>;
  let auditApiService: MockProxy<AuditApiService>;
  let nameResolver: MockProxy<AccessNameResolverService>;
  let fileDownloadService: MockProxy<FileDownloadService>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let dialogService: MockProxy<DialogService>;

  const configureTestBed = async (canManageAccessRules = true, canViewAllCollections = true) => {
    await TestBed.configureTestingModule({
      imports: [AccessAuditComponent],
      providers: [
        provideRouter([]),
        { provide: AuditApiService, useValue: auditApiService },
        { provide: AccessNameResolverService, useValue: nameResolver },
        { provide: FileDownloadService, useValue: fileDownloadService },
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: DialogService, useValue: dialogService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: ORGANIZATION_ID }) },
        },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: OrganizationService,
          useValue: {
            organizations$: () =>
              of([{ id: ORGANIZATION_ID, canManageAccessRules, canViewAllCollections }]),
          },
        },
        {
          provide: I18nService,
          // I18nMockService throws on an unknown key, so this covers every key the template can
          // render across all four status branches.
          useValue: new I18nMockService({
            loading: "Loading",
            errorOccurred: "An error has occurred",
            pamAuditLog: "Audit log",
            pamAuditLoadError: "Could not load the audit trail",
            tryAgain: "Try again",
            pamAuditEmptyTitle: "No audit activity",
            pamAuditEmptyMessage: "Activity will appear here.",
            pamAccessRules: "Access rules",
            backTo: "Back to __$1__",
            viewItemsIn: "View items in __$1__",
            removeItem: "Remove __$1__",
            all: "All",
            clear: "Clear",
            noMatchingItems: "No matching items",
            search: "Search",
            resetSearch: "Reset search",
            timePeriod: "Time period",
            allTime: "All time",
            recentlyActiveToday: "Today",
            recentlyActivePast7Days: "Past 7 days",
            recentlyActivePast30Days: "Past 30 days",
            custom: "Custom",
            edit: "Edit",
            clearAll: "Clear all",
            pamAuditNoMatchesTitle: "No matching events",
            pamAuditNoMatchesMessage: "No events match the current filters.",
            timestamp: "Timestamp",
            pamAuditColumnEvent: "Event",
            pamAuditColumnActor: "Actor",
            pamAuditColumnRequester: "Requester",
            pamAuditColumnItem: "Item",
            pamAuditColumnDuration: "Duration",
            pamAuditColumnDetail: "Detail",
            pamAuditDurationExtendedTo: "Extended to __$1__",
            pamInboxDurationMinutes: "__$1__ min",
            pamInboxDuration1Hour: "1 hour",
            pamInboxDurationHours: "__$1__ hours",
            pamAuditSystem: "System",
            pamAuditIncomplete: "Incomplete",
            pamAuditIncompleteTooltip: "Outcome never confirmed.",
            // Every kind, because the Event menu is now the vocabulary rather than what the page holds.
            pamAuditKindRequestSubmitted: "Access requested",
            pamAuditKindRequestApproved: "Request approved",
            pamAuditKindRequestDenied: "Request denied",
            pamAuditKindRequestCanceled: "Request canceled",
            pamAuditKindRequestExpiredUnanswered: "Request expired without a decision",
            pamAuditKindRequestExpiredUnactivated: "Approval expired unused",
            pamAuditKindLeaseActivated: "Lease activated",
            pamAuditKindLeaseActivationRejected: "Activation rejected",
            pamAuditKindLeaseExtended: "Lease extended",
            pamAuditKindLeaseRevoked: "Lease revoked",
            pamAuditKindLeaseExpired: "Lease expired",
            pamAuditKindCredentialAccessed: "Credential accessed",
            pamAuditKindCredentialAccessDenied: "Credential access denied",
            pamAuditKindRuleCreated: "Access rule created",
            pamAuditKindRuleUpdated: "Access rule updated",
            pamAuditKindRuleDeleted: "Access rule deleted",
            pamAuditKindLeasingKillSwitchTriggered: "Kill switch triggered",
            pamAuditKindLeasingFreezeEnabled: "Leasing frozen",
            pamAuditKindLeasingFreezeLifted: "Leasing unfrozen",
            pamAuditKindLeaseEndedByHolder: "Lease ended by holder",
            pamAuditKindUnknown: "Unknown event",
            loadMore: "Load more",
            exportVerb: "Export",
            update: "Update",
            close: "Close",
          }),
        },
      ],
    })
      // Stub the design-system children so these tests exercise this component's own
      // load / filter / status logic rather than table and chip rendering; the header module pulls
      // in page chrome (route.data) this test has no interest in wiring up.
      .overrideComponent(AccessAuditComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AccessAuditComponent);
  };

  beforeEach(async () => {
    auditApiService = mock<AuditApiService>();
    nameResolver = mock<AccessNameResolverService>();
    fileDownloadService = mock<FileDownloadService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    dialogService = mock<DialogService>();
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames());
    auditApiService.listAccessAuditItems.mockResolvedValue([]);
    organizationUserApiService.getAllMiniUserDetails.mockResolvedValue(
      miniUserDetails([
        member("user-1", "org-user-1", "Ada", "ada@example.com"),
        member("user-2", "org-user-2", "Grace", "grace@example.com"),
      ]),
    );

    await configureTestBed();
  });

  /** The component's protected surface, reached the way the template reaches it. */
  const component = () => fixture.componentInstance as unknown as Record<string, any>;

  /**
   * Stubs the trail as a single page with nothing to resume from, which is what most of these tests
   * want: the read is paged now, but only the paging tests below care where a page ends.
   */
  const returnsTrail = (
    events: AccessAuditEventResponse[],
    continuationToken: string | null = null,
  ) => auditApiService.listAccessAuditTrail.mockResolvedValue({ data: events, continuationToken });

  const returnsTrailOnce = (
    events: AccessAuditEventResponse[],
    continuationToken: string | null = null,
  ) =>
    auditApiService.listAccessAuditTrail.mockResolvedValueOnce({ data: events, continuationToken });

  /** The filter the trail was last read with — every chip is a query parameter on it now. */
  const lastFilter = (): AuditTrailFilter => {
    const calls = auditApiService.listAccessAuditTrail.mock.calls;
    return calls[calls.length - 1][1] as AuditTrailFilter;
  };

  const readCount = () => auditApiService.listAccessAuditTrail.mock.calls.length;

  /** Stubs the Item menu read, and the vault names the component will try to put to what comes back. */
  const returnsItems = (
    items: AccessAuditItemResponse[],
    names: { ciphers?: [string, string][]; collections?: [string, string][] } = {},
  ) => {
    auditApiService.listAccessAuditItems.mockResolvedValue(items);
    nameResolver.resolveNames.mockResolvedValue({
      ...emptyResolvedNames(),
      cipherNameById: new Map(names.ciphers ?? []),
      collectionNameById: new Map(names.collections ?? []),
    });
  };

  const itemReadCount = () => auditApiService.listAccessAuditItems.mock.calls.length;

  const lastItemRange = () => {
    const calls = auditApiService.listAccessAuditItems.mock.calls;
    return calls[calls.length - 1][1] as { start?: Date; end?: Date };
  };

  /**
   * Renders the page to its ready state with whatever the trail is currently stubbed to return. Two
   * change-detection passes with a settle in between, because init reads the member roster and the first
   * page before the ready branch — and its chips — exist to render.
   */
  const renderReady = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /**
   * Selects a chip's option through the `FilterControl` contract the chips expose. A
   * `bit-filter-menu` owns its own selection — there is no form control to set — and the chips only
   * exist once the ready branch has rendered.
   */
  const selectFilter = (chip: "kind" | "actor" | "requester" | "timePeriod", value: unknown) => {
    fixture.detectChanges();
    component()[`${chip}Chip`]().setValue(value);
    fixture.detectChanges();
  };

  /** The Event chip, which is the first of the chips the toolbar declares. */
  const kindMenu = () => fixture.debugElement.queryAll(By.directive(FilterMenuComponent))[0];

  /** The options declared into the Event menu, in template order. */
  const kindMenuOptions = () =>
    kindMenu()
      .queryAll(By.directive(FilterOptionComponent))
      .map((option) => ({
        label: (option.componentInstance as FilterOptionComponent).label(),
        value: (option.componentInstance as FilterOptionComponent).value(),
      }));

  /**
   * Opens the Event menu and returns its rendered rows. The menu body is stamped into a CDK overlay
   * on the document, not inside the fixture's host element, so it cannot be reached through the
   * fixture. Multi-select, so the rows are checkboxes and there is no "All" row to reset from.
   */
  const openKindMenu = () => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>("bit-filter-menu button[aria-haspopup]")!
      .click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLButtonElement>("[role='menuitemcheckbox']"));
  };

  it("reads the trail for the organization in the route", async () => {
    returnsTrail([event()]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      expect.anything(),
    );
    expect(component().status()).toBe("ready");
    expect(component().rows()).toHaveLength(1);
  });

  it("reports empty rather than ready for a trail with no events", async () => {
    returnsTrail([]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component().status()).toBe("empty");
  });

  it("shows the empty state's Access rules link for a viewer who can manage access rules", async () => {
    returnsTrail([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector("#access-audit_link_access-rules");
    expect(link).not.toBeNull();
  });

  it("drops the empty state's Access rules link for a viewer who cannot manage access rules", async () => {
    TestBed.resetTestingModule();
    await configureTestBed(false);
    returnsTrail([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector("#access-audit_link_access-rules");
    expect(link).toBeNull();
  });

  it("reports error when the read fails, and logs it", async () => {
    auditApiService.listAccessAuditTrail.mockRejectedValue(new Error("boom"));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component().status()).toBe("error");
    expect(TestBed.inject(LogService).error).toHaveBeenCalled();
  });

  it("recovers from the error state when load() is retried", async () => {
    auditApiService.listAccessAuditTrail.mockRejectedValueOnce(new Error("boom"));

    fixture.detectChanges();
    await fixture.whenStable();
    expect(component().status()).toBe("error");

    returnsTrailOnce([event()]);
    await component().load();

    expect(component().status()).toBe("ready");
  });

  // Only an event naming both a cipher and its collection can be matched to a local vault item, so
  // the others must not be sent to the resolver.
  it("asks the name resolver only about events naming both a cipher and a collection", async () => {
    returnsTrail([
      event({ CipherId: "cipher-1", CollectionId: "col-1" }),
      event({ CipherId: "cipher-2", CollectionId: null }),
      event({ Kind: "ruleCreated", RuleName: "Prod" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(nameResolver.resolveNames).toHaveBeenCalledWith([
      { cipherId: "cipher-1", collectionId: "col-1" },
    ]);
  });

  // The menu is the vocabulary, not the page. Deriving it from fifty loaded rows would offer an auditor
  // only the events they had already scrolled past, and withhold the filter for the one they came for.
  it("offers every event kind, whatever the page happens to hold", async () => {
    returnsTrail([event({ Kind: "requestApproved" })]);

    await renderReady();

    const options = component().kindOptions();
    expect(options.map((option: any) => option.value).sort()).toEqual(
      Object.values(AccessAuditEventKind).sort(),
    );
    // Sorted by the label an auditor reads, not by the wire value behind it.
    expect(options.map((option: any) => option.label)).toEqual(
      options.map((option: any) => option.label).sort((a: string, b: string) => a.localeCompare(b)),
    );
  });

  it("offers the same event kinds whichever kinds the page holds", async () => {
    returnsTrail([event({ Kind: "requestApproved" })]);
    await renderReady();
    const before = component().kindOptions();

    returnsTrail([event({ Kind: "leaseActivated" })]);
    await component().load();
    fixture.detectChanges();

    expect(component().kindOptions()).toEqual(before);
  });

  // The signal above is what the chip is bound to; this is what the chip does with it. Kept as its own
  // test because the binding in between is where the option list has actually broken before — an option
  // read a beat before Angular has bound its `value` throws NG0950 and renders nothing.
  it("declares every event kind into the Event menu, sorted", async () => {
    returnsTrail([event({ Kind: "requestApproved" })]);

    await renderReady();

    expect(kindMenuOptions()).toEqual(component().kindOptions());
  });

  // Declaring an option and rendering it are different failures. The rows are stamped into a CDK
  // overlay only when the menu opens, which is the moment the NG0950 above would surface.
  it("renders a checkable row per event kind when the Event menu is opened", async () => {
    returnsTrail([event({ Kind: "leaseActivated" })]);

    await renderReady();

    expect(openKindMenu().map((row) => row.textContent?.trim())).toEqual(
      component()
        .kindOptions()
        .map((option: any) => option.label),
    );
  });

  // The chip's values are the wire vocabulary, so a selection travels to the server as it stands rather
  // than being translated out of a display label on the way.
  it("re-reads the trail with the kinds selected on the Event chip", async () => {
    returnsTrail([event({ Kind: "leaseActivated" }), event({ Kind: "requestApproved" })]);
    await renderReady();
    const before = readCount();

    selectFilter("kind", ["leaseActivated"]);
    await fixture.whenStable();

    expect(readCount()).toBe(before + 1);
    expect(lastFilter().kinds).toEqual(["leaseActivated"]);
  });

  // A LeaseRevoked whose actor is the requester is relabelled "Lease ended by holder" in the Event
  // column, but the server records one kind and the filter follows the server: selecting "Lease revoked"
  // asks for both, and the column is what still tells them apart.
  it("folds a holder-ended lease into the Lease revoked filter, and still labels the row its own way", async () => {
    returnsTrail([
      event({ Kind: "leaseRevoked", ActorId: "user-1", ActorName: "Ada", RequesterId: "user-2" }),
      event({ Kind: "leaseRevoked", ActorId: "user-2", ActorName: "Grace", RequesterId: "user-2" }),
    ]);
    await renderReady();

    expect(component().kindOptions()).not.toContainEqual(
      expect.objectContaining({ label: "Lease ended by holder" }),
    );
    expect(
      component()
        .rows()
        .map((row: any) => row.kindLabelKey),
    ).toEqual(["pamAuditKindLeaseRevoked", "pamAuditKindLeaseEndedByHolder"]);

    selectFilter("kind", ["leaseRevoked"]);
    await fixture.whenStable();

    expect(lastFilter().kinds).toEqual(["leaseRevoked"]);
  });

  // An auditor reconstructing an incident is usually following two or three people at once; narrowing to
  // each in turn would lose the order the events happened in.
  it("sends every selected actor, so several can be followed at once", async () => {
    returnsTrail([event()]);
    await renderReady();

    selectFilter("actor", ["user-1", "user-4"]);
    await fixture.whenStable();

    expect(lastFilter().actorIds).toEqual(["user-1", "user-4"]);
  });

  it("narrows across chips while widening within one", async () => {
    returnsTrail([event()]);
    await renderReady();

    selectFilter("kind", ["requestApproved", "leaseActivated"]);
    await fixture.whenStable();
    selectFilter("actor", ["user-1"]);
    await fixture.whenStable();

    expect(lastFilter()).toEqual(
      expect.objectContaining({
        kinds: ["requestApproved", "leaseActivated"],
        actorIds: ["user-1"],
      }),
    );
  });

  it("drops a dimension from the read when the last value is removed from its chip", async () => {
    returnsTrail([event()]);
    await renderReady();

    selectFilter("actor", ["user-1"]);
    await fixture.whenStable();
    expect(lastFilter().actorIds).toEqual(["user-1"]);

    selectFilter("actor", []);
    await fixture.whenStable();

    expect(lastFilter().actorIds).toEqual([]);
  });

  // Sourced from the organization's roster rather than the page, for the same reason the Event menu is
  // the vocabulary: a page of fifty rows cannot be asked who else there is.
  it("offers an actor option per organization member, plus the system bucket", async () => {
    returnsTrail([event({ ActorId: "user-1", ActorName: "Ada" })]);

    await renderReady();

    expect(component().actorOptions()).toEqual([
      { label: "Ada", value: "user-1" },
      { label: "Grace", value: "user-2" },
      { label: "System", value: "automated" },
    ]);
  });

  // The system bucket is offered whether or not the loaded page has an automated row: the page can no
  // longer answer whether the organization has any, and a filter that comes and goes with the scroll
  // position is worse than one that sometimes finds nothing.
  it("offers the system bucket even when no loaded row is automated", async () => {
    returnsTrail([event({ ActorId: "user-1", ActorName: "Ada", Automated: false })]);

    await renderReady();

    expect(component().actorOptions()).toContainEqual({ label: "System", value: "automated" });
  });

  // A former member is gone from the roster while the events they left behind still name them — and
  // those events are often exactly what an audit is about.
  it("offers a former member the roster no longer carries but the rows still name", async () => {
    returnsTrail([
      event({ ActorId: "user-9", ActorName: "Linus", ActorEmail: "linus@example.com" }),
    ]);

    await renderReady();

    expect(component().actorOptions()).toContainEqual({ label: "Linus", value: "user-9" });
  });

  it("offers no actor option for an identity that resolved to neither a name nor an email", async () => {
    returnsTrail([event({ ActorId: "user-9", ActorName: null, ActorEmail: null })]);

    await renderReady();

    expect(component().actorOptions()).not.toContainEqual(
      expect.objectContaining({ value: "user-9" }),
    );
  });

  // On the wire the automatic bucket is a flag rather than an id, because the events it selects have no
  // actor to name. It unions with the ids alongside it rather than narrowing them.
  it("sends the system bucket as a flag alongside the selected ids", async () => {
    returnsTrail([event()]);
    await renderReady();

    selectFilter("actor", ["user-1", "automated"]);
    await fixture.whenStable();

    expect(lastFilter().actorIds).toEqual(["user-1"]);
    expect(lastFilter().includeAutomatedActor).toBe(true);
  });

  it("tells apart two requesters who share a display name", async () => {
    organizationUserApiService.getAllMiniUserDetails.mockResolvedValue(
      miniUserDetails([
        member("user-2", "org-user-2", "J. Smith", "smith-a@example.com"),
        member("user-4", "org-user-4", "J. Smith", "smith-b@example.com"),
      ]),
    );
    returnsTrail([event()]);

    await renderReady();

    expect(component().requesterOptions()).toEqual([
      { label: "J. Smith (smith-a@example.com)", value: "user-2" },
      { label: "J. Smith (smith-b@example.com)", value: "user-4" },
    ]);
  });

  it("re-reads the trail with the requester selected on the Requester chip", async () => {
    returnsTrail([event()]);
    await renderReady();

    selectFilter("requester", ["user-2"]);
    await fixture.whenStable();

    expect(lastFilter().requesterIds).toEqual(["user-2"]);
  });

  describe("time period", () => {
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;

    /** Stamped from the real clock so the presets, which read the same clock, line up with the fixtures. */
    const now = () => new Date();
    const startOfToday = () => {
      const today = now();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    };

    const renderTrail = async (occurredAt: Date[]) => {
      returnsTrail(occurredAt.map((at) => event({ OccurredAt: at.toISOString() })));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    /** The lower bound the chip put on the read, in epoch ms. */
    const sentStart = () => (lastFilter().start as Date).getTime();

    /** Within a second of the expected instant, since the preset reads the clock a moment after the test. */
    const aboutEqual = (actual: number, expected: number) => Math.abs(actual - expected) < 1000;

    const applyPeriod = async (period: string | null) => {
      selectFilter("timePeriod", period);
      await fixture.whenStable();
    };

    it("bounds Today at the start of the viewer's own day, not twenty-four hours back", async () => {
      await renderTrail([now()]);

      await applyPeriod("today");

      expect(sentStart()).toBe(startOfToday().getTime());
      expect(lastFilter().end).toBeUndefined();
    });

    it("bounds Past 7 days seven days back from now", async () => {
      await renderTrail([now()]);

      await applyPeriod("past7Days");

      expect(aboutEqual(sentStart(), now().getTime() - 7 * DAY_MS)).toBe(true);
    });

    it("bounds Past 30 days thirty days back from now", async () => {
      await renderTrail([now()]);

      await applyPeriod("past30Days");

      expect(aboutEqual(sentStart(), now().getTime() - 30 * DAY_MS)).toBe(true);
    });

    // "All time" is the chip's own reset row. It sends no bounds at all, which the server answers with
    // everything it still holds — the retention window, and nothing older exists to ask for.
    it("sends no bounds at all when the chip is reset to All time", async () => {
      await renderTrail([now()]);

      await applyPeriod("past7Days");
      expect(lastFilter().start).toBeInstanceOf(Date);

      await applyPeriod(null);

      expect(lastFilter().start).toBeUndefined();
      expect(lastFilter().end).toBeUndefined();
    });

    // Choosing a period is a new read, not a narrowing of what is already here — which is what lets it
    // reach events the first page never contained.
    it("re-reads the trail rather than narrowing the rows already loaded", async () => {
      await renderTrail([now()]);
      const before = readCount();

      await applyPeriod("past7Days");

      expect(readCount()).toBe(before + 1);
    });

    describe("custom range", () => {
      const closesWith = (result: unknown) => {
        dialogService.open.mockReturnValue({ closed: of(result) } as any);
      };

      const chooseCustom = async () => {
        selectFilter("timePeriod", "custom");
        await fixture.whenStable();
        fixture.detectChanges();
      };

      it("applies the bounds the dialog confirmed and leaves the chip active", async () => {
        const noon = new Date(2026, 7, 18, 12, 0);
        const evening = new Date(2026, 7, 18, 18, 0);
        await renderTrail([noon, evening]);
        closesWith({ action: "apply", from: "2026-08-18T13:00", to: "" });

        await chooseCustom();

        expect(sentStart()).toBe(new Date("2026-08-18T13:00").getTime());
        expect(component().selectedPeriod()).toBe("custom");
      });

      // Reopening has to show what the table is filtered to, or the auditor is editing bounds they cannot see.
      it("reopens the dialog on the range in force", async () => {
        await renderTrail([new Date(2026, 7, 18, 12, 0)]);
        closesWith({ action: "apply", from: "2026-08-18T09:00", to: "2026-08-18T17:00" });

        await chooseCustom();
        selectFilter("timePeriod", null);
        await chooseCustom();

        expect(dialogService.open).toHaveBeenLastCalledWith(expect.anything(), {
          data: { from: "2026-08-18T09:00", to: "2026-08-18T17:00" },
        });
      });

      // Re-selecting "Custom" writes the value the chip already holds, so its selection signal never
      // notifies and the dialog cannot be reopened from the menu. Editing the bounds in force would
      // otherwise mean dropping them first.
      it("reopens the dialog from Edit without dropping the range in force", async () => {
        await renderTrail([new Date(2026, 7, 18, 12, 0)]);
        closesWith({ action: "apply", from: "2026-08-18T09:00", to: "2026-08-18T17:00" });
        await chooseCustom();

        const edit = fixture.nativeElement.querySelector("#access-audit_button_edit-range");
        expect(edit).not.toBeNull();

        closesWith({ action: "apply", from: "2026-08-18T10:00", to: "2026-08-18T16:00" });
        edit.click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(dialogService.open).toHaveBeenLastCalledWith(expect.anything(), {
          data: { from: "2026-08-18T09:00", to: "2026-08-18T17:00" },
        });
        expect(component().selectedPeriod()).toBe("custom");
        expect(component().range()).toEqual({
          from: new Date("2026-08-18T10:00"),
          to: new Date("2026-08-18T16:00:59.999"),
        });
      });

      // Nothing to edit until a range is in force, and nothing to edit once one of the presets is.
      it("offers Edit only while a custom range is the period in force", async () => {
        await renderTrail([new Date(2026, 7, 18, 12, 0)]);
        expect(fixture.nativeElement.querySelector("#access-audit_button_edit-range")).toBeNull();

        selectFilter("timePeriod", "past7Days");
        expect(fixture.nativeElement.querySelector("#access-audit_button_edit-range")).toBeNull();

        closesWith({ action: "apply", from: "2026-08-18T09:00", to: "2026-08-18T17:00" });
        await chooseCustom();

        expect(
          fixture.nativeElement.querySelector("#access-audit_button_edit-range"),
        ).not.toBeNull();
      });

      // A cancelled dialog that left "Custom" showing would claim a range the table is not filtered to.
      it("rolls the chip back to the period in force when cancelled", async () => {
        const recent = new Date(now().getTime() - HOUR_MS);
        const older = new Date(now().getTime() - 40 * DAY_MS);
        await renderTrail([recent, older]);
        selectFilter("timePeriod", "past7Days");
        closesWith(undefined);

        await chooseCustom();

        expect(component().selectedPeriod()).toBe("past7Days");
        // Still the preset's bounds: a cancelled dialog must not have re-read the trail for a range
        // that was never applied.
        expect(aboutEqual(sentStart(), now().getTime() - 7 * DAY_MS)).toBe(true);
      });

      // Clear is the dialog's own way out of a custom range, so the chip goes back to All time with it.
      it("drops the chip back to All time when the dialog clears the range", async () => {
        const recent = new Date(now().getTime() - HOUR_MS);
        const older = new Date(now().getTime() - 40 * DAY_MS);
        await renderTrail([recent, older]);
        closesWith({ action: "apply", from: new Date(recent).toISOString().slice(0, 16), to: "" });
        await chooseCustom();
        expect(component().selectedPeriod()).toBe("custom");

        closesWith({ action: "clear" });
        selectFilter("timePeriod", null);
        await chooseCustom();

        expect(component().selectedPeriod()).toBeNull();
        expect(lastFilter().start).toBeUndefined();
        expect(lastFilter().end).toBeUndefined();
      });

      it("leaves the chip unselected when cancelled from no selection at all", async () => {
        await renderTrail([new Date(now().getTime() - HOUR_MS)]);
        closesWith(undefined);

        await chooseCustom();

        expect(component().selectedPeriod()).toBeNull();
        expect(lastFilter().start).toBeUndefined();
      });
    });
  });

  describe("clear all", () => {
    const clearAllButton = () =>
      fixture.nativeElement.querySelector("#access-audit_button_clear-all");

    /** Stamped against the real clock, so the time-period chip has something inside its preset window. */
    const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const renderReady = async () => {
      returnsTrail([
        event({ OccurredAt: anHourAgo(), ActorId: "user-1", ActorName: "Ada" }),
        event({
          OccurredAt: anHourAgo(),
          Kind: "leaseActivated",
          ActorId: "user-3",
          ActorName: "Linus",
        }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it("stays out of the chip row while nothing is filtering the table", async () => {
      await renderReady();

      expect(clearAllButton()).toBeNull();
    });

    it("appears as soon as one chip has a selection", async () => {
      await renderReady();

      selectFilter("actor", "user-3");

      expect(clearAllButton()).not.toBeNull();
    });

    it("resets every chip at once", async () => {
      await renderReady();
      selectFilter("kind", ["requestApproved"]);
      selectFilter("actor", ["user-1"]);
      selectFilter("requester", ["user-2"]);
      selectFilter("timePeriod", "past7Days");
      await fixture.whenStable();

      clearAllButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        component()
          .chips()
          .some((chip: any) => chip.active()),
      ).toBe(false);
      expect(component().selectedPeriod()).toBeNull();
      expect(clearAllButton()).toBeNull();
      // One read back to the unnarrowed trail, rather than four as the chips reset one by one.
      expect(lastFilter()).toEqual({
        start: undefined,
        end: undefined,
        kinds: [],
        actorIds: [],
        includeAutomatedActor: false,
        requesterIds: [],
        cipherIds: [],
        ruleIds: [],
      });
    });
  });

  // Every filter is a query parameter on the read, so changing one goes back to the server. That is what
  // makes a filtered result the whole of what matches rather than the whole of what happened to be loaded.
  it("re-reads the trail whenever a filter changes", async () => {
    returnsTrail([event()]);
    await renderReady();
    expect(readCount()).toBe(1);

    selectFilter("kind", ["leaseActivated"]);
    await fixture.whenStable();
    selectFilter("actor", ["user-1"]);
    await fixture.whenStable();
    selectFilter("requester", ["user-2"]);
    await fixture.whenStable();
    selectFilter("timePeriod", "past30Days");
    await fixture.whenStable();

    expect(readCount()).toBe(5);
    expect(lastFilter()).toEqual(
      expect.objectContaining({
        kinds: ["leaseActivated"],
        actorIds: ["user-1"],
        requesterIds: ["user-2"],
      }),
    );
  });

  // The chips mount only once the first page has rendered, and their first report is "nothing selected" —
  // the very filter that page was read with. Without the guard on the filter in force, every load would be
  // followed immediately by an identical second one.
  it("does not re-read the trail when a chip settles on the filter already in force", async () => {
    returnsTrail([event()]);

    await renderReady();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readCount()).toBe(1);
  });

  describe("update", () => {
    const renderReady = async (events = [event()]) => {
      returnsTrail(events);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const clickUpdate = () => {
      fixture.nativeElement.querySelector("#access-audit_button_refresh").click();
    };

    // Re-reading is how an event recorded since the page opened appears. The filters reach the server
    // now, so Update starts again from the first page of whatever they select rather than appending.
    it("re-reads the first page for the filter in force when Update is pressed", async () => {
      await renderReady();
      expect(readCount()).toBe(1);

      returnsTrail([event(), event({ Kind: "leaseActivated" })]);
      clickUpdate();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(readCount()).toBe(2);
      expect(lastFilter().continuationToken).toBeUndefined();
      expect(component().rows()).toHaveLength(2);
      expect(component().status()).toBe("ready");
    });

    // An organization whose first PAM event has not landed yet renders the empty state, which holds no
    // toolbar. Without Update there, the only way to see that first event is a browser reload.
    it("re-reads the trail from the empty state", async () => {
      await renderReady([]);
      expect(component().status()).toBe("empty");

      returnsTrail([event()]);
      clickUpdate();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(2);
      expect(component().status()).toBe("ready");
      expect(component().rows()).toHaveLength(1);
    });

    // The Event menu is the vocabulary rather than the page, so a refresh cannot add to it — which is
    // the point: the option for a kind was already there before the event of that kind arrived.
    it("renders a trail whose kinds were already all on offer", async () => {
      await renderReady();
      const before = component().kindOptions();

      returnsTrail([event(), event({ Kind: "leaseActivated" })]);
      clickUpdate();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().kindOptions()).toEqual(before);
      expect(before).toContainEqual({ label: "Lease activated", value: "leaseActivated" });
    });

    // The roster is read once and outlives every filter, so it is not re-read per refresh — otherwise
    // every chip an auditor touched would cost a second request for a list that has not changed.
    it("does not re-read the member lookup on a refresh", async () => {
      await renderReady();
      expect(organizationUserApiService.getAllMiniUserDetails).toHaveBeenCalledTimes(1);

      clickUpdate();
      await fixture.whenStable();

      expect(organizationUserApiService.getAllMiniUserDetails).toHaveBeenCalledTimes(1);
    });

    // Dropping to the loading state would take the table, the filters and the pressed button out of
    // the DOM for the length of the request.
    it("keeps the rendered trail on screen while a refresh is in flight", async () => {
      await renderReady();

      let release!: (page: AuditTrailPage) => void;
      auditApiService.listAccessAuditTrail.mockReturnValueOnce(
        new Promise<AuditTrailPage>((resolve) => (release = resolve)),
      );

      const refreshed = component().load();
      fixture.detectChanges();

      expect(component().status()).toBe("ready");
      expect(fixture.nativeElement.querySelector("bit-table")).not.toBeNull();

      release({ data: [event(), event()], continuationToken: null });
      await refreshed;

      expect(component().rows()).toHaveLength(2);
    });

    // A refresh leaves the chips live, so a second read can start while the first is still out. Whichever
    // came back last would otherwise win, and a slow answer to a filter the auditor has already moved off
    // would overwrite the one they are waiting for.
    it("discards a read the auditor has already moved off", async () => {
      await renderReady();

      let releaseStale!: (page: AuditTrailPage) => void;
      auditApiService.listAccessAuditTrail.mockReturnValueOnce(
        new Promise<AuditTrailPage>((resolve) => (releaseStale = resolve)),
      );
      const stale = component().load();

      returnsTrail([event({ ActorName: "Linus" })]);
      await component().load();

      releaseStale({
        data: [event({ ActorName: "Ada" }), event({ ActorName: "Ada" })],
        continuationToken: "page-2",
      });
      await stale;

      expect(
        component()
          .rows()
          .map((row: any) => row.actor),
      ).toEqual(["Linus"]);
      expect(component().canLoadMore()).toBe(false);
    });

    // A transient failure must not cost the auditor the trail they were reading; `bitAction` reports it.
    it("keeps the rendered trail when a refresh fails, and raises the failure", async () => {
      await renderReady();

      auditApiService.listAccessAuditTrail.mockRejectedValueOnce(new Error("boom"));

      await expect(component().load()).rejects.toThrow("boom");

      expect(component().status()).toBe("ready");
      expect(component().rows()).toHaveLength(1);
    });
  });

  describe("toolbar", () => {
    const renderToolbar = async () => {
      returnsTrail([event()]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      return fixture.nativeElement.querySelector("#access-audit_container_toolbar") as HTMLElement;
    };

    it("filters from five chips of the same family", async () => {
      const toolbar = await renderToolbar();

      expect(toolbar).not.toBeNull();
      expect(toolbar.querySelectorAll("bit-filter-menu")).toHaveLength(5);
      expect(toolbar.querySelector("bit-form-field")).toBeNull();
      expect(toolbar.querySelector("input[type=datetime-local]")).toBeNull();
    });

    // A long chip label wraps the chip row. The buttons sit above it so that wrap can never orphan
    // Export onto a line of its own.
    it("keeps the actions out of the wrapping row, right-aligned above it", async () => {
      const toolbar = await renderToolbar();

      const actions = toolbar.querySelector("#access-audit_container_actions")!;
      const filters = toolbar.querySelector("#access-audit_container_filters")!;
      expect(actions.classList).toContain("tw-justify-end");
      for (const button of ["#access-audit_button_refresh", "#access-audit_button_export"]) {
        expect(actions.querySelector(button)).not.toBeNull();
        expect(filters.querySelector(button)).toBeNull();
      }
    });

    // The chips are all one height, so nothing in the row needs an offset to line up.
    it("carries no height nudges", async () => {
      const toolbar = await renderToolbar();

      expect(toolbar.querySelectorAll(".tw-mt-7")).toHaveLength(0);
      expect(toolbar.querySelectorAll(".tw-ms-auto")).toHaveLength(0);
    });

    // Event, Actor and Requester each answer "which of these", and only the time period is one-of.
    it("makes every chip but the time period multi-select", async () => {
      const toolbar = await renderToolbar();

      const chips = [...toolbar.querySelectorAll("bit-filter-menu")];
      expect(chips).toHaveLength(5);
      expect(chips.filter((chip) => chip.hasAttribute("multiple"))).toHaveLength(4);

      const timePeriod = chips.find((chip) =>
        chip.querySelector("button")?.getAttribute("title")?.startsWith("Time period"),
      )!;
      expect(timePeriod).not.toBeUndefined();
      expect(timePeriod.hasAttribute("multiple")).toBe(false);
    });

    it("wraps the chip row rather than overflowing it", async () => {
      const toolbar = await renderToolbar();

      expect(toolbar.querySelector("#access-audit_container_filters")!.classList).toContain(
        "tw-flex-wrap",
      );
    });
  });

  describe("export", () => {
    const clickExport = () => {
      fixture.nativeElement.querySelector("#access-audit_button_export").click();
    };

    const exportedRows = () => {
      const request = fileDownloadService.download.mock.calls[0][0];
      return papa.parse<Record<string, string>>(request.blobData as string, { header: true }).data;
    };

    /** Clicks Export and lets the page walk it takes settle. */
    const runExport = async () => {
      clickExport();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
    };

    // The file has to hold what the auditor narrowed the table down to — all of it. Serializing the rows
    // on screen would stop at the page boundary, and a file that stops early is the one outcome an audit
    // export must not produce: it looks complete.
    it("walks every page of the filtered trail rather than exporting what is on screen", async () => {
      returnsTrail([event({ ActorId: "user-3", ActorName: "Linus" })]);
      await renderReady();
      selectFilter("actor", ["user-3"]);
      await fixture.whenStable();

      returnsTrailOnce([event({ ActorId: "user-3", ActorName: "Linus" })], "page-2");
      returnsTrailOnce([event({ ActorId: "user-3", ActorName: "Ada" })], null);
      await runExport();

      // One page is on screen; the file carries both.
      expect(component().rows()).toHaveLength(1);
      expect(exportedRows().map((row) => row.actorName)).toEqual(["Linus", "Ada"]);
    });

    // The walk carries the chips with it, or the file would be the whole trail rather than the part the
    // auditor asked for.
    it("carries the active filter onto every page it reads", async () => {
      returnsTrail([event()]);
      await renderReady();
      selectFilter("actor", ["user-3"]);
      await fixture.whenStable();

      returnsTrailOnce([event()], "page-2");
      returnsTrailOnce([event()], null);
      await runExport();

      const calls = auditApiService.listAccessAuditTrail.mock.calls.slice(-2);
      expect(calls[0][1]).toEqual(expect.objectContaining({ actorIds: ["user-3"] }));
      expect(calls[1][1]).toEqual(
        expect.objectContaining({ actorIds: ["user-3"], continuationToken: "page-2" }),
      );
    });

    // A server answering every request with the same position would otherwise spin here forever, writing
    // the same page into the file until the tab died. Refusing outright is the right failure: bitAction
    // reports it, and no file is written that claims to be the trail and is not.
    it("refuses to write a file when the trail hands back the same page twice", async () => {
      returnsTrail([event()], "stuck");
      await renderReady();

      await expect(component().exportCsv()).rejects.toThrow(/same page twice/);
      expect(fileDownloadService.download).not.toHaveBeenCalled();
    });

    it("hands the download service one csv blob", async () => {
      returnsTrail([event()]);
      await renderReady();

      await runExport();

      expect(fileDownloadService.download).toHaveBeenCalledTimes(1);
      const request = fileDownloadService.download.mock.calls[0][0];
      expect(request.fileName).toMatch(/\.csv$/);
      expect(request.blobOptions).toEqual({ type: "text/csv" });
      expect(request.blobData).toContain("Request approved");
    });

    // `bwi-import` is the export glyph in this icon set, and the icon both event-log surfaces settled on.
    it("carries the export icon", async () => {
      returnsTrail([event()]);
      await renderReady();

      const icon = fixture.nativeElement.querySelector("#access-audit_button_export i");
      expect(icon).not.toBeNull();
      expect(icon.classList).toContain("bwi-import");
    });

    it("disables Export while no row matches the filters", async () => {
      returnsTrail([event({ Kind: "requestApproved", ActorName: "Ada" })]);
      await renderReady();

      const button = fixture.nativeElement.querySelector("#access-audit_button_export");
      expect(button.getAttribute("aria-disabled")).toBeNull();

      // The narrowed read comes back empty, which is what leaves nothing to export.
      returnsTrail([]);
      selectFilter("kind", ["leaseActivated"]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().rows()).toHaveLength(0);
      button.click();
      expect(fileDownloadService.download).not.toHaveBeenCalled();
    });
  });

  describe("item filter", () => {
    // The menu is the subjects the trail names, narrowed to the ones this vault can label. Neither half
    // works alone: a page names only some of what is in range, and the vault holds credentials the trail
    // never mentions.
    it("offers an option per subject the trail names that this vault can name", async () => {
      returnsTrail([event()]);
      returnsItems([cipherItem("cipher-1"), ruleItem("rule-1", "Production database")], {
        ciphers: [["cipher-1", "Prod database"]],
      });

      await renderReady();

      expect(component().itemOptions()).toEqual([
        { label: "Prod database", value: "cipher-1" },
        { label: "Production database", value: "rule-1" },
      ]);
    });

    // A cipher this viewer never held has no name to render, so offering it would put an unlabelled row
    // in the menu — the same rule the Actor chip follows for an unresolved member.
    it("offers no option for a cipher this vault could not decrypt", async () => {
      returnsTrail([event()]);
      returnsItems([cipherItem("cipher-1"), cipherItem("cipher-unknown")], {
        ciphers: [["cipher-1", "Prod database"]],
      });

      await renderReady();

      expect(component().itemOptions()).toEqual([{ label: "Prod database", value: "cipher-1" }]);
    });

    // A rule's name is plaintext organization configuration, so it needs no vault at all.
    it("labels a rule from the name the server sent", async () => {
      returnsTrail([event()]);
      returnsItems([ruleItem("rule-1", "Production database")]);

      await renderReady();

      expect(component().itemOptions()).toEqual([
        { label: "Production database", value: "rule-1" },
      ]);
    });

    // Two items under one name would let an auditor read a filtered half of one item's history as the
    // whole of it. The collection the cipher was last gated through is what tells them apart.
    it("tells apart two items that share a name", async () => {
      returnsTrail([event()]);
      returnsItems(
        [cipherItem("cipher-1", "collection-1"), cipherItem("cipher-2", "collection-2")],
        {
          ciphers: [
            ["cipher-1", "Root password"],
            ["cipher-2", "Root password"],
          ],
          collections: [
            ["collection-1", "Web servers"],
            ["collection-2", "Databases"],
          ],
        },
      );

      await renderReady();

      expect(component().itemOptions()).toEqual([
        { label: "Root password (Databases)", value: "cipher-2" },
        { label: "Root password (Web servers)", value: "cipher-1" },
      ]);
    });

    // One chip, two columns. An id sent against the wrong one would silently match nothing.
    it("sends a credential as cipherIds and a rule as ruleIds", async () => {
      returnsTrail([event()]);
      returnsItems([cipherItem("cipher-1"), ruleItem("rule-1", "Production database")], {
        ciphers: [["cipher-1", "Prod database"]],
      });
      await renderReady();

      selectFilter("item", ["cipher-1", "rule-1"]);
      await fixture.whenStable();

      expect(lastFilter().cipherIds).toEqual(["cipher-1"]);
      expect(lastFilter().ruleIds).toEqual(["rule-1"]);
    });

    // The range is what changes which items exist, so the menu follows it.
    it("re-reads the menu when the time period changes", async () => {
      returnsTrail([event()]);
      await renderReady();
      const before = itemReadCount();

      selectFilter("timePeriod", "past7Days");
      await fixture.whenStable();

      expect(itemReadCount()).toBe(before + 1);
      expect(lastItemRange().start).toBeInstanceOf(Date);
    });

    // The other dimensions are not. Narrowing to one actor must not quietly drop the credentials they
    // never touched from a menu an auditor is using to look for exactly that.
    it("leaves the menu alone when another chip changes", async () => {
      returnsTrail([event()]);
      await renderReady();
      const before = itemReadCount();

      selectFilter("actor", ["user-1"]);
      await fixture.whenStable();
      selectFilter("kind", ["leaseActivated"]);
      await fixture.whenStable();

      expect(itemReadCount()).toBe(before);
    });

    // The trail is still readable without one of its filters; an auditor who cannot narrow by item is
    // better off than one looking at an error page.
    it("leaves the menu empty when the read fails, without taking the page down", async () => {
      returnsTrail([event()]);
      auditApiService.listAccessAuditItems.mockRejectedValue(new Error("boom"));

      await renderReady();

      expect(component().itemOptions()).toEqual([]);
      expect(component().status()).toBe("ready");
    });
  });

  describe("paging", () => {
    const loadMoreButton = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector("#access-audit_button_load-more");

    const clickLoadMore = async () => {
      loadMoreButton()!.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    // The server sends a position to resume from only while a page remains, so its absence is the end of
    // the trail rather than a guess made by counting rows.
    it("offers Load more while the trail has a page left", async () => {
      returnsTrail([event()], "page-2");

      await renderReady();

      expect(loadMoreButton()).not.toBeNull();
    });

    it("offers no Load more on the last page", async () => {
      returnsTrail([event()], null);

      await renderReady();

      expect(loadMoreButton()).toBeNull();
    });

    it("appends the next page rather than replacing what is on screen", async () => {
      returnsTrail([event({ ActorName: "Ada" })], "page-2");
      await renderReady();

      returnsTrail([event({ ActorName: "Linus" })], null);
      await clickLoadMore();

      expect(
        component()
          .rows()
          .map((row: any) => row.actor),
      ).toEqual(["Ada", "Linus"]);
      expect(loadMoreButton()).toBeNull();
    });

    it("resumes from the position the previous page reported", async () => {
      returnsTrail([event()], "page-2");
      await renderReady();

      returnsTrail([event()], null);
      await clickLoadMore();

      expect(lastFilter().continuationToken).toBe("page-2");
    });

    // An auditor reading down a trail is holding their place in it. Reloading the table to fetch what
    // comes after would lose it.
    it("keeps the page on screen while the next one is in flight", async () => {
      returnsTrail([event()], "page-2");
      await renderReady();

      let release!: (page: AuditTrailPage) => void;
      auditApiService.listAccessAuditTrail.mockReturnValueOnce(
        new Promise<AuditTrailPage>((resolve) => (release = resolve)),
      );

      const pending = component().loadMore();
      fixture.detectChanges();

      expect(component().status()).toBe("ready");
      expect(component().rows()).toHaveLength(1);

      release({ data: [event()], continuationToken: null });
      await pending;

      expect(component().rows()).toHaveLength(2);
    });

    // A stale position would ask the server to resume a trail the auditor is no longer looking at.
    it("starts again from the first page when a filter changes", async () => {
      returnsTrail([event()], "page-2");
      await renderReady();

      selectFilter("actor", ["user-1"]);
      await fixture.whenStable();

      expect(lastFilter().continuationToken).toBeUndefined();
      expect(component().rows()).toHaveLength(1);
    });

    // Same reason, for the other way of re-reading: Update means "start again", not "continue".
    it("starts again from the first page when Update is pressed", async () => {
      returnsTrail([event()], "page-2");
      await renderReady();
      await clickLoadMore();
      expect(component().rows()).toHaveLength(2);

      returnsTrail([event()], null);
      fixture.nativeElement.querySelector("#access-audit_button_refresh").click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(lastFilter().continuationToken).toBeUndefined();
      expect(component().rows()).toHaveLength(1);
    });

    // A failure mid-trail is raised to `bitAction`, which reports it while what is already read stays.
    it("keeps the rows already read when the next page fails", async () => {
      returnsTrail([event()], "page-2");
      await renderReady();

      auditApiService.listAccessAuditTrail.mockRejectedValueOnce(new Error("boom"));

      await expect(component().loadMore()).rejects.toThrow("boom");

      expect(component().rows()).toHaveLength(1);
      expect(component().status()).toBe("ready");
    });
  });

  describe("entity event history links", () => {
    const render = async (events: AccessAuditEventResponse[]) => {
      returnsTrail(events);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const link = (name: string): HTMLAnchorElement | null =>
      fixture.nativeElement.querySelector(`#access-audit_link_${name}-0`);

    const cells = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("bit-table tbody tr td"));

    /** The params the one opened dialog was configured with. */
    const dialogData = () =>
      (dialogService.open.mock.calls[0][1] as { data: Record<string, unknown> }).data;

    const resolveCipherName = (cipherId: string, name: string) => {
      nameResolver.resolveNames.mockResolvedValue({
        ...emptyResolvedNames(),
        cipherNameById: new Map([[cipherId, name]]),
      });
    };

    it("opens an actor's event history from their name", async () => {
      await render([event({ ActorId: "user-1", ActorName: "Ada" })]);

      const anchor = link("actor")!;
      expect(anchor).not.toBeNull();
      expect(anchor.textContent!.trim()).toBe("Ada");
      expect(anchor.getAttribute("title")).toBe("ada@example.com");
      // Focusable and Enter-activatable as a native anchor, rather than a click-only span.
      expect(anchor.getAttribute("href")).toBe("#");

      anchor.click();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      // The dialog is keyed on the ORGANIZATION USER id, not the platform user id the row carries.
      expect(dialogData()).toEqual({
        entity: "user",
        entityId: "org-user-1",
        organizationId: ORGANIZATION_ID,
        name: "Ada",
        showUser: true,
      });
    });

    it("opens a requester's event history from their name", async () => {
      await render([event({ RequesterId: "user-2", RequesterName: "Grace" })]);

      const anchor = link("requester")!;
      expect(anchor).not.toBeNull();
      expect(anchor.getAttribute("title")).toBe("grace@example.com");

      anchor.click();

      expect(dialogData()).toEqual({
        entity: "user",
        entityId: "org-user-2",
        organizationId: ORGANIZATION_ID,
        name: "Grace",
        showUser: true,
      });
    });

    it("opens the item's event history from a cipher row", async () => {
      resolveCipherName("cipher-1", "Prod database");
      await render([event({ CipherId: "cipher-1", CollectionId: "col-1" })]);

      const anchor = link("item")!;
      expect(anchor).not.toBeNull();
      expect(anchor.textContent!.trim()).toBe("Prod database");

      anchor.click();

      expect(dialogData()).toEqual({
        entity: "cipher",
        entityId: "cipher-1",
        organizationId: ORGANIZATION_ID,
        name: "Prod database",
        showUser: true,
      });
    });

    // The automated bucket is not a member, so there is no event history behind it.
    it("leaves the System actor as plain text", async () => {
      await render([event({ ActorId: "user-1", ActorName: "Ada", Automated: true })]);

      expect(link("actor")).toBeNull();
      expect(cells()[2].textContent).toContain("System");
    });

    it("leaves an identity the member lookup did not resolve as plain text", async () => {
      await render([
        event({
          ActorId: "user-9",
          ActorName: "Linus",
          RequesterId: "user-9",
          RequesterName: "Linus",
        }),
      ]);

      expect(link("actor")).toBeNull();
      expect(link("requester")).toBeNull();
      expect(cells()[2].textContent).toContain("Linus");
      expect(cells()[3].textContent).toContain("Linus");
    });

    // There is no entity-events dialog for an access rule, and the rule editor is behind
    // canManageAccessRules, which this page's guard does not imply.
    it("leaves a rule name as plain text", async () => {
      await render([event({ Kind: "ruleCreated", RuleName: "Production access" })]);

      expect(link("item")).toBeNull();
      expect(cells()[4].textContent).toContain("Production access");
    });

    // An item outside the viewer's own vault has no decrypted name to render as link text.
    it("leaves an item that did not decrypt unlinked", async () => {
      await render([event({ CipherId: "cipher-1", CollectionId: "col-1" })]);

      expect(link("item")).toBeNull();
      expect(cells()[4].textContent).toContain("—");
    });

    // An auditor mid-table expects to keep their place; the organization event log's own member link
    // routes on to the members page, which sits behind a permission this page's viewer need not hold.
    it("does not navigate away when a dialog is opened", async () => {
      const router = TestBed.inject(Router);
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      const navigateByUrl = jest.spyOn(router, "navigateByUrl").mockResolvedValue(true);

      await render([event({ ActorId: "user-1", ActorName: "Ada" })]);
      link("actor")!.click();
      link("requester")!.click();

      expect(dialogService.open).toHaveBeenCalledTimes(2);
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it("reads the member lookup once per load, not once per row", async () => {
      await render([event(), event(), event()]);

      expect(organizationUserApiService.getAllMiniUserDetails).toHaveBeenCalledTimes(1);
      expect(organizationUserApiService.getAllMiniUserDetails).toHaveBeenCalledWith(
        ORGANIZATION_ID,
      );
    });
  });

  describe("details drawer", () => {
    const render = async (events: AccessAuditEventResponse[]) => {
      returnsTrail(events);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const rows = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("bit-table tbody tr"));

    const activator = (index = 0): HTMLElement =>
      fixture.nativeElement.querySelector(`#access-audit_button_details-${index}`);

    /** The params the one opened drawer was configured with. */
    const drawerData = () =>
      (dialogService.openDrawer.mock.calls[0][1] as { data: Record<string, any> }).data;

    const press = (element: HTMLElement, key: string): KeyboardEvent => {
      const keydown = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      element.dispatchEvent(keydown);
      fixture.detectChanges();
      return keydown;
    };

    it("opens the drawer over the row that was activated", async () => {
      await render([
        event({ OccurredAt: "2026-08-18T09:00:00.000Z", Detail: "first" }),
        event({ OccurredAt: "2026-08-18T08:00:00.000Z", Detail: "second" }),
      ]);

      rows()[1].click();

      expect(dialogService.openDrawer).toHaveBeenCalledTimes(1);
      expect(drawerData().row.detail).toBe("second");
      expect(drawerData().organizationId).toBe(ORGANIZATION_ID);
    });

    // `openDrawer` defaults `closeOnNavigation` to false and `DrawerService` only tears the stack down
    // when the bottom ref asked for it, so without this the pane stays mounted over whatever page the
    // auditor navigates to next.
    it("closes the drawer when the auditor navigates away", async () => {
      await render([event()]);

      rows()[0].click();

      expect(dialogService.openDrawer).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ closeOnNavigation: true }),
      );
    });

    // The member lookup ran once for the whole trail; the pane must link exactly what the row under
    // it links, which it can only do if the page hands over the answer it already has.
    it("hands the drawer the identities the row resolved", async () => {
      await render([event({ ActorId: "user-1", RequesterId: "user-2" })]);

      rows()[0].click();

      expect(drawerData().actor).toEqual({
        name: "Ada",
        email: "ada@example.com",
        organizationUserId: "org-user-1",
      });
      expect(drawerData().requester.organizationUserId).toBe("org-user-2");
    });

    it("hands the drawer no actor for an automated row", async () => {
      await render([event({ Automated: true })]);

      rows()[0].click();

      expect(drawerData().actor).toBeNull();
    });

    it("leaves an identity the member lookup did not resolve unlinked in the drawer", async () => {
      await render([event({ ActorId: "user-9", ActorName: "Linus", RequesterId: "user-9" })]);

      rows()[0].click();

      expect(drawerData().actor).toBeNull();
      expect(drawerData().requester).toBeNull();
    });

    // The page already read the viewer's membership; a pane re-deriving it could offer a link the
    // page itself would not.
    it("hands the drawer the permissions its links are gated on", async () => {
      await render([event()]);

      rows()[0].click();

      expect(drawerData().canManageAccessRules).toBe(true);
      expect(drawerData().canViewCollections).toBe(true);
    });

    it("hands the drawer neither permission when the viewer holds neither", async () => {
      TestBed.resetTestingModule();
      await configureTestBed(false, false);
      await render([event()]);

      rows()[0].click();

      expect(drawerData().canManageAccessRules).toBe(false);
      expect(drawerData().canViewCollections).toBe(false);
    });

    // An anchor inside the row already opens something of its own. Letting the click reach the row
    // as well would stack a drawer behind the dialog the auditor actually asked for.
    it.each([
      ["actor", { ActorId: "user-1", ActorName: "Ada" }],
      ["requester", { RequesterId: "user-2", RequesterName: "Grace" }],
    ])("opens only the entity dialog from the %s link", async (name, overrides) => {
      await render([event(overrides)]);

      fixture.nativeElement.querySelector(`#access-audit_link_${name}-0`).click();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogService.openDrawer).not.toHaveBeenCalled();
    });

    it("opens only the entity dialog from the item link", async () => {
      nameResolver.resolveNames.mockResolvedValue({
        ...emptyResolvedNames(),
        cipherNameById: new Map([["cipher-1", "Prod database"]]),
      });
      await render([event({ CipherId: "cipher-1", CollectionId: "col-1" })]);

      fixture.nativeElement.querySelector("#access-audit_link_item-0").click();

      expect(dialogService.open).toHaveBeenCalledTimes(1);
      expect(dialogService.openDrawer).not.toHaveBeenCalled();
    });

    // A `tr` is neither focusable nor nameable, so the affordance lives on a cell — one cell, not
    // six, or a ninety-day trail would put hundreds of tab stops between an auditor and the table's end.
    it("gives the row one keyboard activator, with a role and a name", async () => {
      await render([event()]);

      const cell = activator();
      expect(cell.getAttribute("role")).toBe("button");
      expect(cell.getAttribute("tabindex")).toBe("0");
      expect(cell.getAttribute("aria-label")).toContain("Request approved");
      expect(cell.className).toContain("focus-visible:tw-ring-2");
      expect(
        fixture.nativeElement.querySelectorAll('bit-table tbody [role="button"]'),
      ).toHaveLength(1);
    });

    // `button` marks its children presentational, so the badge is not exposed as a node of its own and
    // an in-doubt row would otherwise announce exactly the same as a settled one.
    it("names the in-doubt badge on the cell that carries the role", async () => {
      await render([event({ Incomplete: true }), event({ Incomplete: false })]);

      expect(activator(0).getAttribute("aria-label")).toContain("Incomplete");
      expect(activator(1).getAttribute("aria-label")).not.toContain("Incomplete");
    });

    it("opens the drawer on Enter", async () => {
      await render([event()]);

      press(activator(), "Enter");

      expect(dialogService.openDrawer).toHaveBeenCalledTimes(1);
    });

    // Space activates the row without also scrolling the page out from under it.
    it("opens the drawer on Space, and swallows the key", async () => {
      await render([event()]);

      const keydown = press(activator(), " ");

      expect(dialogService.openDrawer).toHaveBeenCalledTimes(1);
      expect(keydown.defaultPrevented).toBe(true);
    });

    // Pointer activation sits on the row, so the activator cell must not repeat it.
    it("opens the drawer once when the activator itself is clicked", async () => {
      await render([event()]);

      activator().click();

      expect(dialogService.openDrawer).toHaveBeenCalledTimes(1);
    });

    it("no longer gives the table a Detail column", async () => {
      await render([event({ Detail: "Incident closed early." })]);

      const headers = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll("bit-table thead th"),
      ).map((header) => header.textContent!.trim());
      expect(headers).toEqual(["Timestamp", "Event", "Actor", "Requester", "Item", "Duration"]);
      expect(fixture.nativeElement.querySelector("bit-table tbody").textContent).not.toContain(
        "Incident closed early.",
      );
    });

    // The column is gone from the TABLE, not from the trail: the file an auditor exports is the
    // record they file, and it still has to carry the free text the column used to show.
    it("still exports the detail the column gave up", async () => {
      await render([event({ Detail: "Incident closed early." })]);

      fixture.nativeElement.querySelector("#access-audit_button_export").click();
      await fixture.whenStable();

      const csv = fileDownloadService.download.mock.calls[0][0].blobData as string;
      const parsed = papa.parse<Record<string, string>>(csv, { header: true });
      expect(parsed.meta.fields).toContain("detail");
      expect(parsed.data[0].detail).toBe("Incident closed early.");
    });
  });

  describe("no matches", () => {
    const emptyStateClearAll = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector("#access-audit_button_no-matches-clear-all");

    const renderReady = async () => {
      returnsTrail([
        event({ ActorId: "user-1", ActorName: "Ada" }),
        event({ ActorId: "user-3", ActorName: "Linus" }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    /** Narrows to a kind the trail does not carry, which the server answers with nothing. */
    const overFilter = async () => {
      returnsTrail([]);
      selectFilter("kind", ["ruleCreated"]);
      await fixture.whenStable();
      fixture.detectChanges();
    };

    // Filtering something out is an ordinary outcome, not the unexpected condition a callout announces.
    it("renders the standard empty state rather than a callout", async () => {
      await renderReady();
      await overFilter();

      expect(component().rows()).toHaveLength(0);
      // Still "ready", not "empty": a filter that matched nothing must leave the way out of it on screen.
      expect(component().status()).toBe("ready");
      expect(fixture.nativeElement.querySelector("bit-status-lockup")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-callout")).toBeNull();
      expect(fixture.nativeElement.querySelector("bit-table")).toBeNull();
    });

    it("carries the no-matches title and message into the empty state", async () => {
      await renderReady();
      await overFilter();

      const emptyState = emptyStateClearAll()!.closest("bit-status-lockup")!;
      expect(emptyState.querySelector("[slot=title]")!.textContent!.trim()).toBe(
        "No matching events",
      );
      expect(emptyState.querySelector("[slot=description]")!.textContent!.trim()).toBe(
        "No events match the current filters.",
      );
    });

    // The trail-with-no-events state is a different empty state, with its own copy and its own action.
    it("leaves the trail's own empty state alone", async () => {
      returnsTrail([]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().status()).toBe("empty");
      const accessRulesLink = fixture.nativeElement.querySelector(
        "#access-audit_link_access-rules",
      );
      expect(accessRulesLink).not.toBeNull();
      const emptyState = accessRulesLink!.closest("bit-status-lockup")!;
      expect(emptyState.querySelector("[slot=title]")!.textContent!.trim()).toBe(
        "No audit activity",
      );
      expect(emptyStateClearAll()).toBeNull();
    });

    // The way out of an over-filtered table has to be where the auditor is looking, not only in the
    // chip row above it.
    it("resets every chip from the empty state's Clear all", async () => {
      await renderReady();
      selectFilter("actor", ["user-1"]);
      selectFilter("timePeriod", "today");
      await overFilter();
      expect(emptyStateClearAll()).not.toBeNull();

      // Clearing goes back to the server, so the unnarrowed trail has to be there to come back.
      returnsTrail([
        event({ ActorId: "user-1", ActorName: "Ada" }),
        event({ ActorId: "user-3", ActorName: "Linus" }),
      ]);
      emptyStateClearAll()!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        component()
          .chips()
          .some((chip: any) => chip.active()),
      ).toBe(false);
      expect(component().selectedPeriod()).toBeNull();
      expect(component().rows()).toHaveLength(2);
      expect(fixture.nativeElement.querySelector("bit-table")).not.toBeNull();
      expect(emptyStateClearAll()).toBeNull();
    });
  });

  describe("empty cells", () => {
    const ACTOR = 2;
    const REQUESTER = 3;
    const ITEM = 4;
    const DURATION = 5;

    const render = async (events: AccessAuditEventResponse[]) => {
      returnsTrail(events);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const cell = (column: number): HTMLElement =>
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll("bit-table tbody tr td"))[
        column
      ];

    const text = (column: number) => cell(column).textContent!.trim();

    it("renders the actor's name when the row names one", async () => {
      await render([event({ ActorId: "user-9", ActorName: "Linus" })]);

      expect(text(ACTOR)).toBe("Linus");
    });

    it("renders an em dash for a row with no actor", async () => {
      await render([event({ ActorId: null, ActorName: null, ActorEmail: null })]);

      expect(text(ACTOR)).toBe("—");
    });

    // "System" is a value, not an absence: an automated row has an actor, it just is not a person.
    it("keeps the System label rather than a dash for an automated row", async () => {
      await render([event({ ActorId: null, ActorName: null, ActorEmail: null, Automated: true })]);

      expect(text(ACTOR)).toBe("System");
    });

    it("renders the requester's name when the row names one", async () => {
      await render([event({ RequesterId: "user-9", RequesterName: "Linus" })]);

      expect(text(REQUESTER)).toBe("Linus");
    });

    it("renders an em dash for a row with no requester", async () => {
      await render([event({ RequesterId: null, RequesterName: null, RequesterEmail: null })]);

      expect(text(REQUESTER)).toBe("—");
    });

    // A blank cell in an audit table reads as a rendering failure rather than as "no value".
    it("leaves no cell of a bare row blank", async () => {
      await render([
        event({
          ActorId: null,
          ActorName: null,
          ActorEmail: null,
          RequesterId: null,
          RequesterName: null,
          RequesterEmail: null,
          CipherId: null,
          CollectionId: null,
        }),
      ]);

      for (const column of [ACTOR, REQUESTER, ITEM, DURATION]) {
        expect(text(column)).toBe("—");
        expect(cell(column).querySelector(".tw-text-muted")).not.toBeNull();
      }
    });
  });

  // The organization event log heads this column "Timestamp" and renders it `medium`; an auditor
  // reading both surfaces should not have to translate between two renderings of the same instant.
  describe("timestamp column", () => {
    const OCCURRED_AT = "2026-08-18T09:00:00.000Z";

    const renderRow = async () => {
      returnsTrail([event({ OccurredAt: OCCURRED_AT })]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const header = (): HTMLElement =>
      fixture.nativeElement.querySelectorAll("bit-table thead th")[0];

    const cell = (): HTMLElement =>
      fixture.nativeElement.querySelectorAll("bit-table tbody tr td")[0];

    it("heads the column the way the organization event log heads it", async () => {
      await renderRow();

      expect(header().textContent!.trim()).toBe("Timestamp");
    });

    it("renders the whole timestamp rather than an abbreviated one", async () => {
      await renderRow();

      const medium = new DatePipe("en-US").transform(new Date(OCCURRED_AT), "medium")!;
      expect(cell().textContent!.trim()).toBe(medium);
    });

    // The cell renders the whole timestamp, so a hover has nothing left to reveal.
    it("carries nothing to hover over", async () => {
      await renderRow();

      expect(cell().querySelector("span")).toBeNull();
    });
  });

  describe("column widths", () => {
    /** Timestamp, Event, Actor, Requester, Item, Duration — the order the template declares. */
    const TIME = 0;
    const EVENT = 1;
    const ACTOR = 2;
    const REQUESTER = 3;
    const ITEM = 4;

    const renderTable = async () => {
      returnsTrail([event()]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      return {
        headers: Array.from<HTMLElement>(
          fixture.nativeElement.querySelectorAll("bit-table thead th"),
        ),
        cells: Array.from<HTMLElement>(
          fixture.nativeElement.querySelectorAll("bit-table tbody tr td"),
        ),
      };
    };

    it("holds Time and Event on one line, header and body cell alike", async () => {
      const { headers, cells } = await renderTable();

      for (const column of [TIME, EVENT]) {
        expect(headers[column].classList).toContain("tw-whitespace-nowrap");
        expect(cells[column].classList).toContain("tw-whitespace-nowrap");
      }
    });

    it("keeps the bitCell padding alongside the width classes", async () => {
      const { headers, cells } = await renderTable();

      // bitCell sets `class` through a HostBinding; a static class attribute on the same element
      // has to survive that merge or every width class here is silently inert.
      expect(headers[TIME].classList).toContain("tw-p-3");
      expect(cells[ITEM].classList).toContain("tw-p-3");
    });

    it("caps Item and lets its text break inside the cap", async () => {
      const { headers, cells } = await renderTable();

      expect(headers[ITEM].classList).toContain("tw-max-w-64");
      expect(headers[ITEM].classList).toContain("tw-break-words");
      expect(cells[ITEM].classList).toContain("tw-max-w-64");
      expect(cells[ITEM].classList).toContain("tw-break-words");
    });

    it("floors Item so the auto table overflows instead of collapsing the column", async () => {
      const { headers, cells } = await renderTable();

      expect(headers[ITEM].classList).toContain("tw-min-w-48");
      expect(cells[ITEM].classList).toContain("tw-min-w-48");
    });

    it("keeps the Item floor beneath the cap and beside the bitCell padding", async () => {
      const { cells } = await renderTable();

      // Same HostBinding merge as above: the floor is inert unless it survives alongside tw-p-3,
      // and it is only a floor while the cap is still there to bound the other end.
      expect(cells[ITEM].classList).toContain("tw-p-3");
      expect(cells[ITEM].classList).toContain("tw-min-w-48");
      expect(cells[ITEM].classList).toContain("tw-max-w-64");
    });

    it("leaves the unbounded name columns free to wrap", async () => {
      const { cells } = await renderTable();

      for (const column of [ACTOR, REQUESTER]) {
        expect(cells[column].classList).not.toContain("tw-whitespace-nowrap");
      }
    });

    it("gives the table its own horizontal scroll container", async () => {
      await renderTable();

      const table = fixture.nativeElement.querySelector("bit-table");
      expect(table.parentElement.classList).toContain("tw-overflow-x-auto");
    });
  });

  /**
   * Six columns do not fit the half-width the drawer leaves, so three of them stand down while it is
   * open. The three that go are the three the drawer itself is already showing for the selected row.
   */
  describe("columns while the details drawer is open", () => {
    const ALL_COLUMNS = ["Timestamp", "Event", "Actor", "Requester", "Item", "Duration"];
    const WITH_DRAWER = ["Timestamp", "Event", "Item"];
    const STOOD_DOWN = [2, 3, 5];

    /**
     * The drawer refs the page opened, newest last.
     *
     * `close()` and `forceClose()` are deliberately the same emission: `DrawerRef.close()` (the X
     * button, Escape, and `openDrawer`'s own teardown of the outgoing stack) and `_forceClose()` (a
     * route change under `closeOnNavigation`) both push one value onto `closed` and complete it. That
     * they converge is what lets a single subscription cover every way out of the pane.
     */
    type FakeDrawer = { close: () => void; forceClose: () => void };

    let drawers: FakeDrawer[];

    beforeEach(() => {
      drawers = [];
      dialogService.openDrawer.mockImplementation(() => {
        // The real openDrawer closes the open stack before pushing the new ref, so the outgoing
        // drawer emits on `closed` before this call has the incoming one. Mirrored here, because that
        // ordering is the whole risk in replacing one drawer with another.
        drawers.at(-1)?.close();
        const closed = new Subject<unknown>();
        const emit = () => {
          closed.next(undefined);
          closed.complete();
        };
        drawers.push({ close: emit, forceClose: emit });
        return Promise.resolve({ closed: closed.asObservable() } as unknown as DrawerRef);
      });
    });

    const render = async () => {
      returnsTrail([
        event({ OccurredAt: "2026-08-18T09:00:00.000Z" }),
        event({ OccurredAt: "2026-08-18T08:00:00.000Z" }),
      ]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const openRow = async (index = 0) => {
      const rows: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll("bit-table tbody tr"),
      );
      rows[index].click();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const headers = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("bit-table thead th"));

    const bodyRows = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll("bit-table tbody tr"));

    const hidden = (element: HTMLElement) => element.classList.contains("tw-hidden");

    const visibleColumns = () =>
      headers()
        .filter((header) => !hidden(header))
        .map((header) => header.textContent!.trim());

    it("keeps all six columns while no drawer is open", async () => {
      await render();

      expect(visibleColumns()).toEqual(ALL_COLUMNS);
      expect(headers().filter(hidden)).toHaveLength(0);
    });

    it("stands Actor, Requester and Duration down once the drawer opens", async () => {
      await render();
      await openRow();

      expect(component().detailsOpen()).toBe(true);
      expect(visibleColumns()).toEqual(WITH_DRAWER);
    });

    // Hidden, not removed: a column dropped from the DOM would re-flow the table and, if the header
    // and the cells ever disagreed about which one went, silently shift every value one column over.
    it("leaves the stood-down columns in the DOM, header and cells together", async () => {
      await render();
      await openRow();

      expect(headers()).toHaveLength(6);
      const hiddenHeaders = headers().flatMap((header, index) => (hidden(header) ? [index] : []));
      expect(hiddenHeaders).toEqual(STOOD_DOWN);

      for (const row of bodyRows()) {
        const cells: HTMLElement[] = Array.from(row.querySelectorAll("td"));
        expect(cells).toHaveLength(6);
        expect(cells.flatMap((cell, index) => (hidden(cell) ? [index] : []))).toEqual(STOOD_DOWN);
      }
    });

    // The Actor and Requester anchors are unreachable while their columns are down, which is fine —
    // the drawer offers the same links. What is not fine is a cell that is invisible but still read
    // out and still focusable. `tw-hidden` is `display: none`, which takes the subtree out of the
    // accessibility tree and out of the tab order; a visibility or opacity class would not.
    it("takes the stood-down cells out of the accessibility tree, not just out of view", async () => {
      await render();
      await openRow();

      for (const index of STOOD_DOWN) {
        const cell = bodyRows()[0].querySelectorAll("td")[index];
        expect(cell.classList).toContain("tw-hidden");
        for (const seen of ["tw-invisible", "tw-opacity-0", "tw-sr-only", "tw-w-0"]) {
          expect(cell.classList).not.toContain(seen);
        }
      }
    });

    // bitCell sets `class` through a HostBinding; the toggled class has to merge with that rather
    // than replace it, or the padding goes with the column.
    it("keeps the bitCell padding and the Item bounds under the toggle", async () => {
      await render();
      await openRow();

      const item = bodyRows()[0].querySelectorAll("td")[4];
      expect(item.classList).toContain("tw-p-3");
      expect(item.classList).toContain("tw-min-w-48");
      expect(item.classList).toContain("tw-max-w-64");
      expect(bodyRows()[0].querySelectorAll("td")[2].classList).toContain("tw-p-3");
    });

    // Every way out of a drawer ends in one of these two, and both emit on `closed`. A drawer has no
    // backdrop of its own to dismiss — it takes a grid column beside the table rather than covering
    // the page — so there is no third route to miss.
    it.each([
      ["the close button", (drawer: FakeDrawer) => drawer.close()],
      ["Escape", (drawer: FakeDrawer) => drawer.close()],
      ["a route change", (drawer: FakeDrawer) => drawer.forceClose()],
    ])("restores all six columns when the drawer closes by %s", async (_route, close) => {
      await render();
      await openRow();
      expect(visibleColumns()).toEqual(WITH_DRAWER);

      close(drawers.at(-1)!);
      await settle();

      expect(component().detailsOpen()).toBe(false);
      expect(visibleColumns()).toEqual(ALL_COLUMNS);
    });

    // Activating a second row replaces the drawer: the outgoing ref closes on the way, and its close
    // must not be read as "no drawer" over the one that took its place.
    it("stays at three columns when a different row replaces the open drawer", async () => {
      await render();
      await openRow(0);
      await openRow(1);

      expect(dialogService.openDrawer).toHaveBeenCalledTimes(2);
      expect(drawers).toHaveLength(2);
      expect(component().detailsOpen()).toBe(true);
      expect(visibleColumns()).toEqual(WITH_DRAWER);
    });

    it("restores all six columns when the replacement drawer is closed", async () => {
      await render();
      await openRow(0);
      await openRow(1);

      drawers.at(-1)!.close();
      await settle();

      expect(visibleColumns()).toEqual(ALL_COLUMNS);
    });

    // A ref that closed while a newer one was being opened has nothing left to report.
    it("ignores a stale ref closing after it was replaced", async () => {
      await render();
      await openRow(0);
      await openRow(1);

      drawers[0].close();
      await settle();

      expect(component().detailsOpen()).toBe(true);
      expect(visibleColumns()).toEqual(WITH_DRAWER);
    });

    // The wrapper is the safety net for widths nothing can be trimmed to fit.
    it("keeps the horizontal scroll container while the drawer is open", async () => {
      await render();
      await openRow();

      const table = fixture.nativeElement.querySelector("bit-table");
      expect(table.parentElement.classList).toContain("tw-overflow-x-auto");
    });

    // A drawer that never opened — its predecessor's closePredicate refused — leaves the table alone.
    it("keeps all six columns when the drawer never opened", async () => {
      await render();
      dialogService.openDrawer.mockResolvedValue(undefined);

      await openRow();

      expect(component().detailsOpen()).toBe(false);
      expect(visibleColumns()).toEqual(ALL_COLUMNS);
    });
  });
});
