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
            from: "From",
            to: "To",
            startDate: "Start date",
            endDate: "End date",
            invalidDateRange: "Invalid date range.",
            pamAuditNoMatchesTitle: "No matching events",
            pamAuditNoMatchesMessage: "No events match the current filters.",
            pamAuditColumnTime: "Time",
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
  const selectFilter = (key: string, value: unknown) => {
    fixture.detectChanges();
    const control = component()
      .filterControls()
      .find((candidate: any) => candidate.key() === key);
    control.setValue(value);
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

    expect(kindMenuOptions()).toEqual([
      { label: "Lease activated", value: "pamAuditKindLeaseActivated" },
      { label: "Request approved", value: "pamAuditKindRequestApproved" },
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

    kindChip().toggle("pamAuditKindLeaseRevoked");
    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].actor).toBe("Ada");
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

  it("bounds the rows by a date range read in the viewer's own zone", async () => {
    const noon = new Date(2026, 7, 18, 12, 0);
    const evening = new Date(2026, 7, 18, 18, 0);
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ OccurredAt: noon.toISOString() }),
      event({ OccurredAt: evening.toISOString() }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    component().fromControl.setValue("2026-08-18T13:00");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].occurredAt).toEqual(evening);

    component().fromControl.setValue("");
    component().toControl.setValue("2026-08-18T12:00");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].occurredAt).toEqual(noon);
  });

  it("leaves the table alone and reports an inverted range on the To field rather than emptying it", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([event(), event()]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component().fromControl.setValue("2026-08-18T18:00");
    component().toControl.setValue("2026-08-18T09:00");
    fixture.detectChanges();

    expect(component().invertedRange()).toBe(true);
    expect(component().filteredRows()).toHaveLength(2);

    const toInput = fixture.nativeElement.querySelector("#access-audit_input_to");
    const fromInput = fixture.nativeElement.querySelector("#access-audit_input_from");
    expect(toInput.closest("bit-form-field").querySelector("bit-error").textContent).toContain(
      "Invalid date range.",
    );
    expect(toInput.getAttribute("aria-invalid")).toBe("true");
    expect(fromInput.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("clears the inverted-range error once the bounds are the right way round", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([event()]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component().fromControl.setValue("2026-08-01T00:00");
    component().toControl.setValue("2026-07-01T00:00");
    fixture.detectChanges();

    component().toControl.setValue("2026-09-01T00:00");
    fixture.detectChanges();

    const toInput = fixture.nativeElement.querySelector("#access-audit_input_to");
    expect(toInput.closest("bit-form-field").querySelector("bit-error")).toBeNull();
    expect(toInput.getAttribute("aria-invalid")).not.toBe("true");
    expect(component().toControl.errors).toBeNull();
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
    component().fromControl.setValue("2026-08-18T00:00");
    component().toControl.setValue("2026-08-19T00:00");
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

    it("renders every control in one row", async () => {
      const toolbar = await renderToolbar();

      expect(toolbar).not.toBeNull();
      expect(toolbar.querySelectorAll("bit-filter-menu")).toHaveLength(3);
      for (const control of [
        "#access-audit_input_from",
        "#access-audit_input_to",
        "#access-audit_button_refresh",
        "#access-audit_button_export",
      ]) {
        expect(toolbar.querySelector(control)).not.toBeNull();
      }
    });

    // The date inputs are taller than a chip or a button by the height of their label, so everything
    // beside them carries the same offset the event log uses; without it the row sits ragged.
    it("offsets the controls that have no label so they line up with the date inputs", async () => {
      const toolbar = await renderToolbar();

      const chips = toolbar.querySelector("bit-filter-menu")!.parentElement!;
      expect(chips.classList).toContain("tw-mt-7");
      for (const button of ["#access-audit_button_refresh", "#access-audit_button_export"]) {
        expect(toolbar.querySelector(button)!.classList).toContain("tw-mt-7");
      }
    });

    it("wraps the row rather than overflowing it", async () => {
      const toolbar = await renderToolbar();

      expect(toolbar.classList).toContain("tw-flex-wrap");
      expect(toolbar.querySelector("bit-filter-menu")!.parentElement!.classList).toContain(
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
