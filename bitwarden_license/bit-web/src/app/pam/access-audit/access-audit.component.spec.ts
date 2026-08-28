import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import * as papa from "papaparse";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FilterMenuComponent, FilterOptionComponent, I18nMockService } from "@bitwarden/components";
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

describe("AccessAuditComponent", () => {
  let fixture: ComponentFixture<AccessAuditComponent>;
  let auditApiService: MockProxy<AuditApiService>;
  let nameResolver: MockProxy<AccessNameResolverService>;
  let fileDownloadService: MockProxy<FileDownloadService>;

  const configureTestBed = async (canManageAccessRules = true) => {
    await TestBed.configureTestingModule({
      imports: [AccessAuditComponent],
      providers: [
        { provide: AuditApiService, useValue: auditApiService },
        { provide: AccessNameResolverService, useValue: nameResolver },
        { provide: FileDownloadService, useValue: fileDownloadService },
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
            all: "All",
            removeItem: (name?: string) => `Remove ${name}`,
            search: "Search",
            exportVerb: "Export",
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
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames());

    await configureTestBed();
  });

  /** The component's protected surface, reached the way the template reaches it. */
  const component = () => fixture.componentInstance as unknown as Record<string, any>;

  /** The Event chip, driven the way the menu rows drive it. */
  const kindChip = () =>
    fixture.debugElement.query(By.directive(FilterMenuComponent))
      .componentInstance as FilterMenuComponent;

  /** The options declared into the Event menu, in template order. */
  const kindMenuOptions = () =>
    fixture.debugElement.queryAll(By.directive(FilterOptionComponent)).map((option) => ({
      label: (option.componentInstance as FilterOptionComponent).label(),
      value: (option.componentInstance as FilterOptionComponent).value(),
    }));

  /**
   * Opens the Event menu and returns its rendered rows, "All" first. The menu body is stamped
   * into a CDK overlay on the document, not inside the fixture's host element.
   */
  const openKindMenu = () => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>("bit-filter-menu button[aria-haspopup]")!
      .click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']"));
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
    expect(fixture.debugElement.query(By.directive(FilterMenuComponent))).not.toBeNull();

    const rows = openKindMenu();
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      "All",
      "Lease activated",
      "Request approved",
    ]);

    rows[1].click();
    fixture.detectChanges();

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

    component().requesterControl.setValue("user-4");

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

    component().actorControl.setValue("user-3");

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

    kindChip().toggle("pamAuditKindLeaseActivated");
    component().actorControl.setValue("user-1");
    component().requesterControl.setValue("user-2");
    component().fromControl.setValue("2026-08-18T00:00");
    component().toControl.setValue("2026-08-19T00:00");
    fixture.detectChanges();
    await fixture.whenStable();

    expect(auditApiService.listAccessAuditTrail).toHaveBeenCalledTimes(1);
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

      component().actorControl.setValue("user-3");
      fixture.detectChanges();
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

    it("disables Export while no row matches the filters", async () => {
      auditApiService.listAccessAuditTrail.mockResolvedValue([
        event({ Kind: "requestApproved", ActorName: "Ada" }),
      ]);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector("#access-audit_button_export");
      expect(button.getAttribute("aria-disabled")).toBeNull();

      kindChip().toggle("pamAuditKindLeaseActivated");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(button.getAttribute("aria-disabled")).toBe("true");
      button.click();
      expect(fileDownloadService.download).not.toHaveBeenCalled();
    });
  });
});
