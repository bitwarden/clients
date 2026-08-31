import { DatePipe } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import * as papa from "papaparse";
import { of } from "rxjs";

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
import { AuditApiService } from "./audit-api.service";
import { AccessAuditEventResponse } from "./responses/access-audit-event.response";

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

  const configureTestBed = async (canManageAccessRules = true) => {
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
            organizations$: () => of([{ id: ORGANIZATION_ID, canManageAccessRules }]),
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
            pamAuditKindRequestApproved: "Request approved",
            pamAuditKindLeaseActivated: "Lease activated",
            pamAuditKindRuleCreated: "Access rule created",
            pamAuditKindLeaseRevoked: "Lease revoked",
            pamAuditKindLeaseEndedByHolder: "Lease ended by holder",
            pamAuditKindRuleUpdated: "Access rule updated",
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
   * Selects a chip's option through the `FilterControl` contract the chips expose. A
   * `bit-filter-menu` owns its own selection — there is no form control to set — and the chips only
   * exist once the ready branch has rendered.
   */
  const selectFilter = (
    chip: "kind" | "actor" | "requester" | "item" | "timePeriod",
    value: unknown,
  ) => {
    fixture.detectChanges();
    component()[`${chip}Chip`]().setValue(value);
    fixture.detectChanges();
  };

  /** The Event chip, which is the first of the chips the toolbar declares. */
  const kindMenu = () => fixture.debugElement.queryAll(By.directive(FilterMenuComponent))[0];

  /** The Event chip driven through its own selection API, the way its menu rows drive it. */
  const kindChip = () => kindMenu().componentInstance as FilterMenuComponent;

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
    auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(component().status()).toBe("ready");
    expect(component().rows()).toHaveLength(1);
  });

  it("reports empty rather than ready for a trail with no events", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component().status()).toBe("empty");
  });

  it("shows the empty state's Access rules link for a viewer who can manage access rules", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector("#access-audit_link_access-rules");
    expect(link).not.toBeNull();
  });

  it("drops the empty state's Access rules link for a viewer who cannot manage access rules", async () => {
    TestBed.resetTestingModule();
    await configureTestBed(false);
    auditApiService.listAccessAuditTrail.mockResolvedValue([]);

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

    auditApiService.listAccessAuditTrail.mockResolvedValueOnce([event()]);
    await component().load();

    expect(component().status()).toBe("ready");
  });

  // Only an event naming both a cipher and its collection can be matched to a local vault item, so
  // the others must not be sent to the resolver.
  it("asks the name resolver only about events naming both a cipher and a collection", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
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

  it("offers a kind filter option only for the kinds actually in the trail", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "leaseActivated" }),
      event({ Kind: "requestApproved" }),
      event({ Kind: "requestApproved" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component().kindOptions()).toEqual([
      { label: "Lease activated", value: "pamAuditKindLeaseActivated" },
      { label: "Request approved", value: "pamAuditKindRequestApproved" },
    ]);
  });

  // The signal above is what the chip is bound to; this is what the chip does with it. Kept as its own
  // test because the binding in between is where the option list has actually broken before — an option
  // read a beat before Angular has bound its `value` throws NG0950 and renders nothing.
  it("declares each event kind into the Event menu, sorted, one per distinct label", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "requestApproved" }),
      event({ Kind: "leaseActivated" }),
      event({ Kind: "requestApproved" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(kindMenuOptions()).toEqual([
      { label: "Lease activated", value: "pamAuditKindLeaseActivated" },
      { label: "Request approved", value: "pamAuditKindRequestApproved" },
    ]);
  });

  // Declaring an option and rendering it are different failures. The rows are stamped into a CDK
  // overlay only when the menu opens, which is the moment the NG0950 above would surface.
  it("renders a checkable row per event kind when the Event menu is opened", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "leaseActivated" }),
      event({ Kind: "requestApproved" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(openKindMenu().map((row) => row.textContent?.trim())).toEqual([
      "Lease activated",
      "Request approved",
    ]);
  });

  it("filters rows by the kind selected on the Event chip", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "leaseActivated" }),
      event({ Kind: "requestApproved" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component().filteredRows()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector("bit-chip-filter")).toBeNull();

    selectFilter("kind", "pamAuditKindLeaseActivated");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].kindLabelKey).toBe("pamAuditKindLeaseActivated");

    kindChip().clear();

    expect(component().filteredRows()).toHaveLength(2);
  });

  // A LeaseRevoked whose actor is the requester is relabelled "Lease ended by holder" by
  // toAuditRow. The filter is keyed on that same label, so the two can no longer disagree.
  it("offers holder-ended access as its own option, separate from an operator revoke", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "leaseRevoked", ActorId: "user-1", ActorName: "Ada", RequesterId: "user-2" }),
      event({ Kind: "leaseRevoked", ActorId: "user-2", ActorName: "Grace", RequesterId: "user-2" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(kindMenuOptions()).toEqual([
      { label: "Lease ended by holder", value: "pamAuditKindLeaseEndedByHolder" },
      { label: "Lease revoked", value: "pamAuditKindLeaseRevoked" },
    ]);

    kindChip().toggle("pamAuditKindLeaseEndedByHolder");
    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].actor).toBe("Grace");

    // Multi-select, so the second kind joins the first rather than replacing it. Both buckets
    // selected is every revoke back again, which is what tells the two apart from one relabelled kind.
    kindChip().toggle("pamAuditKindLeaseRevoked");
    expect(component().filteredRows()).toHaveLength(2);

    kindChip().toggle("pamAuditKindLeaseEndedByHolder");
    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].actor).toBe("Ada");
  });

  // An auditor reconstructing an incident is usually following two or three people at once; narrowing to
  // each in turn would lose the order the events happened in.
  it("keeps every row matching any of several selected actors", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ ActorId: "user-1", ActorName: "Ada" }),
      event({ ActorId: "user-3", ActorName: "Linus" }),
      event({ ActorId: "user-4", ActorName: "Katherine" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    selectFilter("actor", ["user-1", "user-4"]);

    expect(
      component()
        .filteredRows()
        .map((row: any) => row.actor),
    ).toEqual(["Ada", "Katherine"]);
  });

  it("narrows across chips while widening within one", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "requestApproved", ActorId: "user-1", ActorName: "Ada" }),
      event({ Kind: "leaseActivated", ActorId: "user-1", ActorName: "Ada" }),
      event({ Kind: "leaseActivated", ActorId: "user-3", ActorName: "Linus" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    selectFilter("kind", ["pamAuditKindRequestApproved", "pamAuditKindLeaseActivated"]);
    selectFilter("actor", ["user-1"]);

    expect(component().filteredRows()).toHaveLength(2);
    expect(
      component()
        .filteredRows()
        .every((row: any) => row.actor === "Ada"),
    ).toBe(true);
  });

  it("goes back to matching everything when the last value is removed from a chip", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ ActorId: "user-1", ActorName: "Ada" }),
      event({ ActorId: "user-3", ActorName: "Linus" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    selectFilter("actor", ["user-1"]);
    expect(component().filteredRows()).toHaveLength(1);

    selectFilter("actor", []);

    expect(component().filteredRows()).toHaveLength(2);
  });

  it("offers an actor option per identity that acted, plus the system bucket", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ ActorId: "user-1", ActorName: "Ada" }),
      event({ ActorId: "user-1", ActorName: "Ada" }),
      event({ ActorId: "user-3", ActorName: "Linus" }),
      event({ ActorId: null, ActorName: null, Automated: true }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component().actorOptions()).toEqual([
      { label: "Ada", value: "user-1" },
      { label: "Linus", value: "user-3" },
      { label: "System", value: "automated" },
    ]);
  });

  it("offers no actor option for an identity that resolved to neither a name nor an email", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ ActorId: "user-9", ActorName: null, ActorEmail: null }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component().actorOptions()).toEqual([]);
  });

  it("tells apart two requesters who share a display name", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({
        RequesterId: "user-2",
        RequesterName: "J. Smith",
        RequesterEmail: "smith-a@example.com",
      }),
      event({
        RequesterId: "user-4",
        RequesterName: "J. Smith",
        RequesterEmail: "smith-b@example.com",
      }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component().requesterOptions()).toEqual([
      { label: "J. Smith (smith-a@example.com)", value: "user-2" },
      { label: "J. Smith (smith-b@example.com)", value: "user-4" },
    ]);

    selectFilter("requester", "user-4");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].requesterId).toBe("user-4");
  });

  it("filters rows to the selected actor", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ ActorId: "user-1", ActorName: "Ada" }),
      event({ ActorId: "user-3", ActorName: "Linus" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    selectFilter("actor", "user-3");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].actor).toBe("Linus");
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
      auditApiService.listAccessAuditTrail.mockResolvedValue(
        occurredAt.map((at) => event({ OccurredAt: at.toISOString() })),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const occurredAt = () =>
      component()
        .filteredRows()
        .map((row: any) => row.occurredAt.getTime());

    it("bounds Today at the start of the viewer's own day, not twenty-four hours back", async () => {
      const thisMorning = new Date(startOfToday().getTime() + HOUR_MS);
      const lateLastNight = new Date(startOfToday().getTime() - HOUR_MS);
      await renderTrail([thisMorning, lateLastNight]);

      selectFilter("timePeriod", "today");

      expect(occurredAt()).toEqual([thisMorning.getTime()]);
    });

    it("bounds Past 7 days seven days back from now", async () => {
      const recent = new Date(now().getTime() - 6 * DAY_MS);
      const older = new Date(now().getTime() - 8 * DAY_MS);
      await renderTrail([recent, older]);

      selectFilter("timePeriod", "past7Days");

      expect(occurredAt()).toEqual([recent.getTime()]);
    });

    it("bounds Past 30 days thirty days back from now", async () => {
      const recent = new Date(now().getTime() - 20 * DAY_MS);
      const older = new Date(now().getTime() - 40 * DAY_MS);
      await renderTrail([recent, older]);

      selectFilter("timePeriod", "past30Days");

      expect(occurredAt()).toEqual([recent.getTime()]);
    });

    // "All time" is the chip's own reset row: it means the whole fetched window, which is all this client
    // holds.
    it("drops the bounds again when the chip is reset to All time", async () => {
      const recent = new Date(now().getTime() - HOUR_MS);
      const older = new Date(now().getTime() - 40 * DAY_MS);
      await renderTrail([recent, older]);

      selectFilter("timePeriod", "past7Days");
      expect(component().filteredRows()).toHaveLength(1);

      selectFilter("timePeriod", null);

      expect(component().filteredRows()).toHaveLength(2);
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

        expect(occurredAt()).toEqual([evening.getTime()]);
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
        expect(occurredAt()).toEqual([recent.getTime()]);
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
        expect(component().filteredRows()).toHaveLength(2);
      });

      it("leaves the chip unselected when cancelled from no selection at all", async () => {
        await renderTrail([new Date(now().getTime() - HOUR_MS)]);
        closesWith(undefined);

        await chooseCustom();

        expect(component().selectedPeriod()).toBeNull();
        expect(component().filteredRows()).toHaveLength(1);
      });
    });
  });

  describe("item filter", () => {
    /** The Item cell renders locally-decrypted cipher names, so the chip's options follow the resolver. */
    const withCiphers = (names: [string, string][], collections: [string, string][] = []) => {
      nameResolver.resolveNames.mockResolvedValue({
        ...emptyResolvedNames(),
        cipherNameById: new Map(names),
        collectionNameById: new Map(collections),
      });
    };

    const render = async (events: AccessAuditEventResponse[]) => {
      auditApiService.listAccessAuditTrail.mockResolvedValue(events);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it("offers one option per item, labelled the way the Item cell labels it", async () => {
      withCiphers([
        ["cipher-1", "Prod database"],
        ["cipher-2", "Staging database"],
      ]);
      await render([
        event({ CipherId: "cipher-1", CollectionId: "col-1" }),
        event({ CipherId: "cipher-1", CollectionId: "col-1" }),
        event({ CipherId: "cipher-2", CollectionId: "col-2" }),
        event({
          Kind: "ruleUpdated",
          CipherId: null,
          CollectionId: null,
          RuleId: "rule-1",
          RuleName: "Production access",
        }),
      ]);

      expect(component().itemOptions()).toEqual([
        { label: "Prod database", value: "cipher-1" },
        { label: "Production access", value: "rule-1" },
        { label: "Staging database", value: "cipher-2" },
      ]);
    });

    // The cell renders an em dash for these, and an option that narrowed the table to "no item" would be
    // an option with no name to put on it.
    it("offers no option for a row naming no item at all", async () => {
      await render([event({ CipherId: null, CollectionId: null, RuleId: null, RuleName: null })]);

      expect(component().itemOptions()).toEqual([]);
    });

    // Same rule the Actor chip follows for a member it cannot resolve: no label, so no option.
    it("offers no option for a cipher this viewer's vault could not decrypt", async () => {
      withCiphers([["cipher-1", "Prod database"]]);
      await render([
        event({ CipherId: "cipher-1", CollectionId: "col-1" }),
        event({ CipherId: "cipher-9", CollectionId: "col-9" }),
      ]);

      expect(component().itemOptions()).toEqual([{ label: "Prod database", value: "cipher-1" }]);
    });

    it("filters the trail to the selected item", async () => {
      withCiphers([
        ["cipher-1", "Prod database"],
        ["cipher-2", "Staging database"],
      ]);
      await render([
        event({ CipherId: "cipher-1", CollectionId: "col-1" }),
        event({ CipherId: "cipher-2", CollectionId: "col-2" }),
      ]);

      selectFilter("item", ["cipher-1"]);

      expect(component().filteredRows()).toHaveLength(1);
      expect(component().filteredRows()[0].cipherName).toBe("Prod database");
    });

    // The Actor chip qualifies a shared display name with the identity's email; the collection is the
    // equivalent an item carries, and the Item cell already shows it as that name's tooltip.
    it("tells apart two items that share a name", async () => {
      withCiphers(
        [
          ["cipher-1", "Database"],
          ["cipher-2", "Database"],
        ],
        [
          ["col-1", "production"],
          ["col-2", "staging"],
        ],
      );
      await render([
        event({ CipherId: "cipher-1", CollectionId: "col-1" }),
        event({ CipherId: "cipher-2", CollectionId: "col-2" }),
      ]);

      expect(component().itemOptions()).toEqual([
        { label: "Database (production)", value: "cipher-1" },
        { label: "Database (staging)", value: "cipher-2" },
      ]);
    });

    // Two access rules can carry the same name; filtering on the id keeps their histories apart.
    it("keeps two rules that share a name apart", async () => {
      await render([
        event({
          Kind: "ruleUpdated",
          CipherId: null,
          CollectionId: null,
          RuleId: "rule-1",
          RuleName: "Approval required",
        }),
        event({
          Kind: "ruleUpdated",
          CipherId: null,
          CollectionId: null,
          RuleId: "rule-2",
          RuleName: "Approval required",
        }),
      ]);

      expect(component().itemOptions()).toEqual([
        { label: "Approval required", value: "rule-1" },
        { label: "Approval required", value: "rule-2" },
      ]);

      selectFilter("item", ["rule-2"]);

      expect(component().filteredRows()).toHaveLength(1);
      expect(component().filteredRows()[0].ruleId).toBe("rule-2");
    });

    it("drops a row that names no item once an item is selected", async () => {
      withCiphers([["cipher-1", "Prod database"]]);
      await render([
        event({ CipherId: "cipher-1", CollectionId: "col-1" }),
        event({ CipherId: null, CollectionId: null, RuleId: null, RuleName: null }),
      ]);

      selectFilter("item", ["cipher-1"]);

      expect(component().filteredRows()).toHaveLength(1);
      expect(component().filteredRows()[0].cipherName).toBe("Prod database");
    });
  });

  describe("clear all", () => {
    const clearAllButton = () =>
      fixture.nativeElement.querySelector("#access-audit_button_clear-all");

    /** Stamped against the real clock, so the time-period chip has something inside its preset window. */
    const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const renderReady = async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([
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
      selectFilter("kind", "pamAuditKindRequestApproved");
      selectFilter("actor", "user-1");
      selectFilter("requester", "user-2");
      selectFilter("timePeriod", "past7Days");
      expect(component().filteredRows()).toHaveLength(1);

      clearAllButton().click();
      fixture.detectChanges();

      expect(
        component()
          .chips()
          .some((chip: any) => chip.active()),
      ).toBe(false);
      expect(component().selectedPeriod()).toBeNull();
      expect(component().filteredRows()).toHaveLength(2);
      expect(clearAllButton()).toBeNull();
    });
  });

  // Every filter is a predicate over the one already-fetched window; the endpoint takes no query
  // parameters, so a filter change that re-read it would be a bug, not an optimisation.
  it("does not re-read the trail when a filter changes", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "leaseActivated", ActorId: "user-1", RequesterId: "user-2" }),
      event({ ActorId: "user-3", RequesterId: "user-4" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(1);
    fixture.detectChanges();

    selectFilter("kind", "pamAuditKindLeaseActivated");
    selectFilter("actor", "user-1");
    selectFilter("requester", "user-2");
    selectFilter("timePeriod", "past30Days");
    fixture.detectChanges();
    await fixture.whenStable();

    expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(1);
  });

  describe("update", () => {
    const renderReady = async (events = [event()]) => {
      auditApiService.listAccessAuditTrail.mockResolvedValue(events);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const clickUpdate = () => {
      fixture.nativeElement.querySelector("#access-audit_button_refresh").click();
    };

    // The endpoint takes no parameters, so re-reading it is the only way to see an event recorded
    // since the page opened — which is what Update is for here, the filters being live already.
    it("re-reads the trail when Update is pressed", async () => {
      await renderReady();
      expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(1);

      auditApiService.listAccessAuditTrail.mockResolvedValue([
        event(),
        event({ Kind: "leaseActivated" }),
      ]);
      clickUpdate();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(2);
      expect(auditApiService.listAccessAuditTrail).toHaveBeenLastCalledWith(ORGANIZATION_ID);
      expect(component().rows()).toHaveLength(2);
      expect(component().status()).toBe("ready");
    });

    // An organization whose first PAM event has not landed yet renders the empty state, which holds no
    // toolbar. Without Update there, the only way to see that first event is a browser reload.
    it("re-reads the trail from the empty state", async () => {
      await renderReady([]);
      expect(component().status()).toBe("empty");

      auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);
      clickUpdate();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(2);
      expect(component().status()).toBe("ready");
      expect(component().rows()).toHaveLength(1);
    });

    // The chips build their options from the trail, so a refresh that brings back a kind the page has
    // never rendered adds an option to an already-mounted chip.
    it("takes on an event kind that only the refresh brought back", async () => {
      await renderReady();
      expect(component().kindOptions()).toHaveLength(1);

      auditApiService.listAccessAuditTrail.mockResolvedValue([
        event(),
        event({ Kind: "leaseActivated" }),
      ]);
      clickUpdate();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component().kindOptions()).toEqual([
        { label: "Lease activated", value: "pamAuditKindLeaseActivated" },
        { label: "Request approved", value: "pamAuditKindRequestApproved" },
      ]);
      expect(
        fixture.nativeElement.querySelectorAll("bit-filter-menu bit-filter-option").length,
      ).toBeGreaterThan(1);
    });

    it("re-reads the member lookup alongside the trail", async () => {
      await renderReady();

      clickUpdate();
      await fixture.whenStable();

      expect(organizationUserApiService.getAllMiniUserDetails).toHaveBeenCalledTimes(2);
    });

    // Dropping to the loading state would take the table, the filters and the pressed button out of
    // the DOM for the length of the request.
    it("keeps the rendered trail on screen while a refresh is in flight", async () => {
      await renderReady();

      let release!: (events: AccessAuditEventResponse[]) => void;
      auditApiService.listAccessAuditTrail.mockReturnValueOnce(
        new Promise<AccessAuditEventResponse[]>((resolve) => (release = resolve)),
      );

      const refreshed = component().load();
      fixture.detectChanges();

      expect(component().status()).toBe("ready");
      expect(fixture.nativeElement.querySelector("bit-table")).not.toBeNull();

      release([event(), event()]);
      await refreshed;

      expect(component().rows()).toHaveLength(2);
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
      auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

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

    // The file has to hold what the auditor narrowed the table down to: exporting the whole fetched
    // window would hand them back the rows they deliberately filtered out.
    it("exports the rows the filters left on screen, not the whole trail", async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([
        event({ ActorId: "user-1", ActorName: "Ada" }),
        event({ ActorId: "user-3", ActorName: "Linus" }),
        event({ ActorId: "user-3", ActorName: "Linus" }),
      ]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      selectFilter("actor", "user-3");
      clickExport();

      expect(component().rows()).toHaveLength(3);
      expect(exportedRows()).toHaveLength(2);
      expect(exportedRows().map((row) => row.actorName)).toEqual(["Linus", "Linus"]);
    });

    it("hands the download service one csv blob", async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      clickExport();

      expect(fileDownloadService.download).toHaveBeenCalledTimes(1);
      const request = fileDownloadService.download.mock.calls[0][0];
      expect(request.fileName).toMatch(/\.csv$/);
      expect(request.blobOptions).toEqual({ type: "text/csv" });
      expect(request.blobData).toContain("Request approved");
    });

    // Everything the file needs is already in the browser, and the endpoint takes no parameters, so an
    // export that re-read the trail would be a bug rather than a refresh.
    it("does not re-read the trail to export", async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      clickExport();

      expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(1);
    });

    // `bwi-import` is the export glyph in this icon set, and the icon both event-log surfaces settled on.
    it("carries the export icon", async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector("#access-audit_button_export i");
      expect(icon).not.toBeNull();
      expect(icon.classList).toContain("bwi-import");
    });

    it("disables Export while no row matches the filters", async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([
        event({ Kind: "requestApproved", ActorName: "Ada" }),
      ]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector("#access-audit_button_export");
      expect(button.getAttribute("aria-disabled")).toBeNull();

      selectFilter("kind", "pamAuditKindLeaseActivated");
      await fixture.whenStable();
      fixture.detectChanges();

      expect(button.getAttribute("aria-disabled")).toBe("true");
      button.click();
      expect(fileDownloadService.download).not.toHaveBeenCalled();
    });
  });

  describe("entity event history links", () => {
    const render = async (events: AccessAuditEventResponse[]) => {
      auditApiService.listAccessAuditTrail.mockResolvedValue(events);

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

  describe("no matches", () => {
    const emptyStateClearAll = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector("#access-audit_button_no-matches-clear-all");

    const renderReady = async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([
        event({ ActorId: "user-1", ActorName: "Ada" }),
        event({ ActorId: "user-3", ActorName: "Linus" }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    /** Narrows to a kind the trail does not carry, which leaves the filtered table empty. */
    const overFilter = () => selectFilter("kind", ["pamAuditKindRuleCreated"]);

    // Filtering something out is an ordinary outcome, not the unexpected condition a callout announces.
    it("renders the standard empty state rather than a callout", async () => {
      await renderReady();
      overFilter();

      expect(component().filteredRows()).toHaveLength(0);
      expect(fixture.nativeElement.querySelector("bit-status-lockup")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-callout")).toBeNull();
      expect(fixture.nativeElement.querySelector("bit-table")).toBeNull();
    });

    it("carries the no-matches title and message into the empty state", async () => {
      await renderReady();
      overFilter();

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
      auditApiService.listAccessAuditTrail.mockResolvedValue([]);

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
      overFilter();
      expect(emptyStateClearAll()).not.toBeNull();

      emptyStateClearAll()!.click();
      fixture.detectChanges();

      expect(
        component()
          .chips()
          .some((chip: any) => chip.active()),
      ).toBe(false);
      expect(component().selectedPeriod()).toBeNull();
      expect(component().filteredRows()).toHaveLength(2);
      expect(fixture.nativeElement.querySelector("bit-table")).not.toBeNull();
      expect(emptyStateClearAll()).toBeNull();
    });
  });

  describe("empty cells", () => {
    const ACTOR = 2;
    const REQUESTER = 3;
    const DETAIL = 6;

    const render = async (events: AccessAuditEventResponse[]) => {
      auditApiService.listAccessAuditTrail.mockResolvedValue(events);

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

    it("renders the detail when the row carries one", async () => {
      await render([event({ Detail: "Incident closed early." })]);

      expect(text(DETAIL)).toBe("Incident closed early.");
    });

    it("renders an em dash for a row with no detail", async () => {
      await render([event({ Detail: null })]);

      expect(text(DETAIL)).toBe("—");
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
          Detail: null,
        }),
      ]);

      for (const column of [ACTOR, REQUESTER, DETAIL]) {
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
      auditApiService.listAccessAuditTrail.mockResolvedValue([event({ OccurredAt: OCCURRED_AT })]);

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
    /** Time, Event, Actor, Requester, Item, Duration, Detail — the order the template declares. */
    const TIME = 0;
    const EVENT = 1;
    const ACTOR = 2;
    const REQUESTER = 3;
    const ITEM = 4;
    const DETAIL = 6;

    const renderTable = async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

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

    it("caps Item and Detail and lets their text break inside the cap", async () => {
      const { headers, cells } = await renderTable();

      for (const column of [ITEM, DETAIL]) {
        expect(headers[column].classList).toContain("tw-max-w-64");
        expect(headers[column].classList).toContain("tw-break-words");
        expect(cells[column].classList).toContain("tw-max-w-64");
        expect(cells[column].classList).toContain("tw-break-words");
      }
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
});
