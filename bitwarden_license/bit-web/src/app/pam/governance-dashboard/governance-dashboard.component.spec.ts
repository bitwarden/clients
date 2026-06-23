import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CollectionGovernanceRowResponse,
  OrganizationGovernanceSummaryResponse,
  GovernanceService,
} from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  GovernanceDashboardComponent,
  PAM_COLLECTION_FILTER_QUERY_PARAM,
} from "./governance-dashboard.component";

/**
 * Hand-roll a response shape that matches what the API returns. Constructing
 * the real response classes here avoids drift if the parser shape changes.
 */
function makeSummary(rows: Array<Partial<Record<string, unknown>>> = []) {
  return new OrganizationGovernanceSummaryResponse({
    OrganizationId: "org-1",
    LeasingEnabledCollectionCount: rows.length,
    TotalPendingRequestCount: rows.reduce(
      (sum, r) => sum + ((r.PendingRequestCount as number) ?? 0),
      0,
    ),
    TotalActiveLeaseCount: rows.reduce((sum, r) => sum + ((r.ActiveLeaseCount as number) ?? 0), 0),
    Collections: rows,
  });
}

describe("GovernanceDashboardComponent", () => {
  let governanceService: MockProxy<GovernanceService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;

  async function setup(opts: {
    organizationId?: string | null;
    summary?: OrganizationGovernanceSummaryResponse;
    reject?: Error;
  }): Promise<ComponentFixture<GovernanceDashboardComponent>> {
    governanceService = mock<GovernanceService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();

    i18nService.t.mockImplementation((key: string, ...args: unknown[]) =>
      args.length > 0 ? `${key}:${args.join(",")}` : key,
    );

    if (opts.reject != null) {
      governanceService.getGovernanceSummary.mockRejectedValue(opts.reject);
    } else if (opts.summary != null) {
      governanceService.getGovernanceSummary.mockResolvedValue(opts.summary);
    }

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([{ id: "org-1", name: "Acme Corp" }] as any),
    );

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [GovernanceDashboardComponent],
      providers: [
        { provide: GovernanceService, useValue: governanceService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(
                opts.organizationId === undefined
                  ? { organizationId: "org-1" }
                  : opts.organizationId === null
                    ? {}
                    : { organizationId: opts.organizationId },
              ),
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GovernanceDashboardComponent);
    fixture.detectChanges();
    // The async ngOnInit must settle before assertions.
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  describe("data loading", () => {
    it("fetches the summary using the organizationId from the route", async () => {
      await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            Conditions: [{ kind: "human_approval" }],
            MemberWithAccessCount: 3,
            PendingRequestCount: 1,
            ActiveLeaseCount: 2,
          },
        ]),
      });

      expect(governanceService.getGovernanceSummary).toHaveBeenCalledWith("org-1");
    });

    it("transitions to 'error' when organizationId is missing from the route", async () => {
      const fixture = await setup({ organizationId: null });

      expect(governanceService.getGovernanceSummary).not.toHaveBeenCalled();
      const errorEl = fixture.nativeElement.querySelector("bit-callout[type='danger']");
      expect(errorEl).toBeTruthy();
    });

    it("transitions to 'error' and logs when the API rejects", async () => {
      const err = new Error("boom");
      const fixture = await setup({ reject: err });

      expect(logService.error).toHaveBeenCalledWith(err);
      const errorEl = fixture.nativeElement.querySelector("bit-callout[type='danger']");
      expect(errorEl).toBeTruthy();
    });

    it("transitions to 'empty' when there are no leasing-enabled collections", async () => {
      const fixture = await setup({ summary: makeSummary([]) });

      const emptyEl = fixture.nativeElement.querySelector("bit-callout[type='info']");
      expect(emptyEl).toBeTruthy();
      // Strip totals always render, even when empty.
      expect(fixture.nativeElement.querySelector("[data-testid='strip-collections']")).toBeTruthy();
    });
  });

  describe("summary strip totals", () => {
    it("renders the totals from the response (acceptance: counts match)", async () => {
      const fixture = await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "A",
            PendingRequestCount: 2,
            ActiveLeaseCount: 3,
          },
          {
            CollectionId: "col-2",
            CollectionName: "B",
            PendingRequestCount: 1,
            ActiveLeaseCount: 4,
          },
        ]),
      });

      const stripCollections = fixture.nativeElement.querySelector(
        "[data-testid='strip-collections']",
      );
      const stripPending = fixture.nativeElement.querySelector("[data-testid='strip-pending']");
      const stripActive = fixture.nativeElement.querySelector("[data-testid='strip-active']");

      expect(stripCollections.textContent).toContain("2");
      expect(stripPending.textContent).toContain("3");
      expect(stripActive.textContent).toContain("7");
    });
  });

  describe("rule rendering", () => {
    it("renders pamAccessRuleHumanApproval for a human_approval condition", async () => {
      await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            Conditions: [{ kind: "human_approval" }],
            MemberWithAccessCount: 1,
          },
        ]),
      });

      expect(i18nService.t).toHaveBeenCalledWith("pamAccessRuleHumanApproval");
    });

    it("renders pamAccessRuleIpAllowlist with cidr count for an ip_allowlist condition", async () => {
      await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            Conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] }],
          },
        ]),
      });

      expect(i18nService.t).toHaveBeenCalledWith("pamAccessRuleIpAllowlist", "2");
    });

    it("joins multiple conditions with pamAccessRuleSeparator (AND)", async () => {
      await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            Conditions: [
              { kind: "human_approval" },
              { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
            ],
          },
        ]),
      });

      expect(i18nService.t).toHaveBeenCalledWith("pamAccessRuleSeparator");
      expect(i18nService.t).toHaveBeenCalledWith("pamAccessRuleHumanApproval");
      expect(i18nService.t).toHaveBeenCalledWith("pamAccessRuleIpAllowlist", "1");
    });
  });

  describe("click-throughs", () => {
    it("renders links that preserve the collectionId query param", async () => {
      const fixture = await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            MemberWithAccessCount: 4,
            PendingRequestCount: 2,
            ActiveLeaseCount: 5,
          },
        ]),
      });

      const membersWithAccessLink: HTMLAnchorElement = fixture.nativeElement.querySelector(
        "[data-testid='link-members-with-access']",
      );
      const pendingLink: HTMLAnchorElement = fixture.nativeElement.querySelector(
        "[data-testid='link-pending']",
      );
      const activeLink: HTMLAnchorElement = fixture.nativeElement.querySelector(
        "[data-testid='link-active']",
      );

      expect(membersWithAccessLink.textContent?.trim()).toBe("4");
      expect(pendingLink.textContent?.trim()).toBe("2");
      expect(activeLink.textContent?.trim()).toBe("5");
      // RouterLink lowers `queryParams` onto the rendered href.
      expect(membersWithAccessLink.getAttribute("href")).toContain(
        `${PAM_COLLECTION_FILTER_QUERY_PARAM}=col-1`,
      );
      expect(pendingLink.getAttribute("href")).toContain(
        `${PAM_COLLECTION_FILTER_QUERY_PARAM}=col-1`,
      );
      expect(activeLink.getAttribute("href")).toContain(
        `${PAM_COLLECTION_FILTER_QUERY_PARAM}=col-1`,
      );
    });
  });

  describe("last activity", () => {
    it("renders pamNoActivity when lastActivityAt is null", async () => {
      const fixture = await setup({
        summary: makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            LastActivityAt: null,
          } satisfies Partial<Record<string, unknown>>,
        ]),
      });

      const rowText = fixture.nativeElement.textContent ?? "";
      expect(rowText).toContain("pamNoActivity");
    });

    it("uses the row CollectionGovernanceRowResponse object directly when summaryOverride is supplied", async () => {
      governanceService = mock<GovernanceService>();
      i18nService = mock<I18nService>();
      logService = mock<LogService>();
      i18nService.t.mockImplementation((key: string) => key);

      const organizationService = mock<OrganizationService>();
      organizationService.organizations$.mockReturnValue(of([] as any));
      const accountService = mock<AccountService>();
      accountService.activeAccount$ = of({ id: "user-1" } as any);
      const configService = mock<ConfigService>();
      configService.getFeatureFlag$.mockReturnValue(of(false));

      await TestBed.configureTestingModule({
        imports: [GovernanceDashboardComponent],
        providers: [
          { provide: GovernanceService, useValue: governanceService },
          { provide: I18nService, useValue: i18nService },
          { provide: LogService, useValue: logService },
          { provide: OrganizationService, useValue: organizationService },
          { provide: AccountService, useValue: accountService },
          { provide: ConfigService, useValue: configService },
          { provide: DialogService, useValue: mock<DialogService>() },
          { provide: ToastService, useValue: mock<ToastService>() },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: convertToParamMap({ organizationId: "org-1" }) } },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(GovernanceDashboardComponent);
      fixture.componentRef.setInput(
        "summaryOverride",
        makeSummary([
          {
            CollectionId: "col-1",
            CollectionName: "Servers",
            MemberWithAccessCount: 1,
          },
        ]),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(governanceService.getGovernanceSummary).not.toHaveBeenCalled();
      const membersWithAccessLink = fixture.nativeElement.querySelector(
        "[data-testid='link-members-with-access']",
      );
      expect(membersWithAccessLink.textContent?.trim()).toBe("1");
    });
  });

  it("exports CollectionGovernanceRowResponse so callers can destructure rows", () => {
    // Type-level smoke test: this just needs to compile.
    const row: CollectionGovernanceRowResponse = new CollectionGovernanceRowResponse({
      CollectionId: "col-1",
      CollectionName: "Servers",
    });
    expect(row.collectionId).toBe("col-1");
  });
});
