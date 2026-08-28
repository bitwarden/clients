import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessNameResolverService,
  emptyResolvedNames,
} from "../access-requests/access-name-resolver.service";

import { AccessAuditComponent } from "./access-audit.component";
import { AuditApiService } from "./audit-api.service";
import { NoAuditActivityIcon } from "./no-audit-activity.icon";
import { AccessAuditEventResponse } from "./responses/access-audit-event.response";

const ORGANIZATION_ID = "org-1";

function event(overrides: Record<string, unknown> = {}): AccessAuditEventResponse {
  return new AccessAuditEventResponse({
    Kind: "requestApproved",
    OccurredAt: "2026-08-18T09:00:00.000Z",
    OrganizationId: ORGANIZATION_ID,
    ActorId: "user-1",
    ActorName: "Ada",
    RequesterId: "user-2",
    RequesterName: "Grace",
    Automated: false,
    Incomplete: false,
    ...overrides,
  });
}

describe("AccessAuditComponent", () => {
  let fixture: ComponentFixture<AccessAuditComponent>;
  let auditApiService: MockProxy<AuditApiService>;
  let nameResolver: MockProxy<AccessNameResolverService>;

  const configureTestBed = async (canManageAccessRules = true) => {
    await TestBed.configureTestingModule({
      imports: [AccessAuditComponent],
      providers: [
        { provide: AuditApiService, useValue: auditApiService },
        { provide: AccessNameResolverService, useValue: nameResolver },
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
            pamAuditEmptyRulesHint: "Access rules put activity in this log.",
            pamAccessRules: "Access rules",
            pamAuditSearchPlaceholder: "Search the audit log",
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
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames());

    await configureTestBed();
  });

  /** The component's protected surface, reached the way the template reaches it. */
  const component = () => fixture.componentInstance as unknown as Record<string, any>;

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

  it("gives the empty state the PAM glyph rather than the generic no-results icon", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const noItems = fixture.debugElement.query(By.css("bit-no-items"));
    expect(noItems.componentInstance.icon()).toBe(NoAuditActivityIcon);
  });

  it("explains what puts an entry in the trail on the empty state", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector("[slot=description]");
    expect(description.textContent).toContain("Activity will appear here.");
    expect(description.textContent).toContain("Access rules put activity in this log.");
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

    // Labelled and sorted alphabetically, one entry per distinct kind label key.
    expect(component().kindOptions()).toEqual([
      { label: "Lease activated", value: "pamAuditKindLeaseActivated" },
      { label: "Request approved", value: "pamAuditKindRequestApproved" },
    ]);
  });

  it("filters rows by the selected kind", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ Kind: "leaseActivated" }),
      event({ Kind: "requestApproved" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    expect(component().filteredRows()).toHaveLength(2);

    component().kindControl.setValue("pamAuditKindLeaseActivated");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].kindLabelKey).toBe("pamAuditKindLeaseActivated");
  });

  it("filters rows by free text over actor, requester, item, and detail", async () => {
    auditApiService.listAccessAuditTrail.mockResolvedValue([
      event({ ActorName: "Ada" }),
      event({ ActorName: "Linus" }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();

    component().searchControl.setValue("ada");

    expect(component().filteredRows()).toHaveLength(1);
    expect(component().filteredRows()[0].actor).toBe("Ada");
  });
});
