import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AtRiskGaugeComponent } from "../shared/at-risk-gauge/at-risk-gauge.component";

import { HealthOverviewComponent } from "./health-overview.component";
import { RiskCategoryNavItemComponent } from "./risk-category-nav-item.component";

@Component({
  selector: "dirt-at-risk-gauge",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockAtRiskGaugeComponent {
  readonly value = input<number>(0);
  readonly total = input<number>(0);
  readonly accessibleName = input<string>();
}

@Component({
  selector: "dirt-risk-category-nav-item",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockRiskCategoryNavItemComponent {
  readonly labelKeyNone = input.required<string>();
  readonly labelKeySingular = input.required<string>();
  readonly labelKeyPlural = input.required<string>();
  readonly descriptionKey = input.required<string>();
  readonly descriptionKeyNone = input.required<string>();
  readonly count = input.required<number>();
  readonly icon = input.required<string>();
  readonly variant = input<string>("primary");
  readonly route = input.required<string>();
}

describe("HealthOverviewComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthOverviewComponent>;
  let cipherService: MockProxy<CipherService>;
  let reportService: MockProxy<VaultHealthReportService>;
  let logService: MockProxy<LogService>;

  /** What the report service publishes; null until a scan has completed. */
  let report$: BehaviorSubject<VaultHealthReportView | null>;

  /**
   * Mirrors the service contract: the report is published as the result of a
   * scan, not returned from the call, so nothing is available until it runs.
   */
  function scanYields(report: VaultHealthReportView) {
    reportService.buildVaultHealthReport.mockImplementation(async () => {
      report$.next(report);
    });
  }

  /** Distinct at-risk logins; only the count matters to the overview. */
  function items(count: number): CipherHealthView[] {
    return Array.from({ length: count }, (_, index) => {
      const health = new CipherHealthView();
      health.cipherId = `cipher-${index}`;
      return health;
    });
  }

  async function initComponent() {
    fixture = TestBed.createComponent(HealthOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function gauge(): MockAtRiskGaugeComponent | null {
    const el = fixture.debugElement.query((n) => n.name === "dirt-at-risk-gauge");
    return el ? (el.componentInstance as MockAtRiskGaugeComponent) : null;
  }

  function rows(): MockRiskCategoryNavItemComponent[] {
    return fixture.debugElement
      .queryAll((n) => n.name === "dirt-risk-category-nav-item")
      .map((n) => n.componentInstance as MockRiskCategoryNavItemComponent);
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(async () => {
    cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(of([] as CipherView[]));

    report$ = new BehaviorSubject<VaultHealthReportView | null>(null);
    reportService = mock<VaultHealthReportService>();
    reportService.getVaultHealthReport$.mockReturnValue(report$);
    reportService.buildVaultHealthReport.mockResolvedValue(undefined);

    logService = mock<LogService>();

    await TestBed.configureTestingModule({
      imports: [HealthOverviewComponent, RouterTestingModule],
      providers: [
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: userId } as Account) },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: VaultHealthReportService, useValue: reportService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(HealthOverviewComponent, {
        remove: { imports: [AtRiskGaugeComponent, RiskCategoryNavItemComponent] },
        add: { imports: [MockAtRiskGaugeComponent, MockRiskCategoryNavItemComponent] },
      })
      .compileComponents();
  });

  it("passes the at-risk and total counts to the gauge", async () => {
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10, score: 0.1 }));

    await initComponent();

    expect(gauge()?.value()).toBe(10);
    expect(gauge()?.total()).toBe(100);
  });

  it("shows the at-risk heading and count when any password is at risk", async () => {
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

    await initComponent();

    expect(text()).toContain("yourVaultRiskIsHigh");
    expect(text()).toContain("passwordsNeedFixing");
    expect(text()).not.toContain("yourVaultIsHealthy");
  });

  it("shows the healthy heading when no passwords are at risk", async () => {
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 0 }));

    await initComponent();

    expect(text()).toContain("yourVaultIsHealthy");
    expect(text()).not.toContain("yourVaultRiskIsHigh");
  });

  it("keeps the same count line in the clean state, reading zero of the total", async () => {
    // The design shows "0 of 200 passwords need fixing" when nothing is at
    // risk, so the line is not swapped for a differently-phrased one.
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 0 }));

    await initComponent();

    expect(text()).toContain("passwordsNeedFixing");
  });

  it("labels the category list with a section header", async () => {
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

    await initComponent();

    expect(fixture.nativeElement.querySelector("bit-section-header")).not.toBeNull();
    expect(text()).toContain("risksIdentified");
  });

  it("renders the three categories in Exposed, Weak, Reused order", async () => {
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

    await initComponent();

    expect(rows().map((r) => r.labelKeyPlural())).toEqual([
      "exposedPasswordsPlural",
      "weakPasswordsPlural",
      "reusedPasswordsPlural",
    ]);
    expect(rows().map((r) => r.labelKeySingular())).toEqual([
      "exposedPassword",
      "weakPassword",
      "reusedPassword",
    ]);
  });

  it("gives every category its own zero-state title and description", async () => {
    scanYields(new VaultHealthReportView({ totalCount: 100, atRiskCount: 0 }));

    await initComponent();

    expect(rows().map((r) => r.labelKeyNone())).toEqual([
      "exposedPasswordsNone",
      "weakPasswordsNone",
      "reusedPasswordsNone",
    ]);
    expect(rows().map((r) => r.descriptionKeyNone())).toEqual([
      "exposedPasswordsNoneDesc",
      "weakPasswordsNoneDesc",
      "reusedPasswordsNoneDesc",
    ]);
  });

  it("renders every category even when its count is zero", async () => {
    scanYields(
      new VaultHealthReportView({
        totalCount: 100,
        atRiskCount: 7,
        categoryItems: { exposed: items(7), weak: [], reused: [] },
      }),
    );

    await initComponent();

    expect(rows()).toHaveLength(3);
    expect(rows().map((r) => r.count())).toEqual([7, 0, 0]);
  });

  it("uses each category's deduplicated item count", async () => {
    scanYields(
      new VaultHealthReportView({
        totalCount: 100,
        atRiskCount: 10,
        categoryItems: { exposed: items(7), weak: items(2), reused: items(1) },
      }),
    );

    await initComponent();

    const counts = rows().map((r) => r.count());
    expect(counts).toEqual([7, 2, 1]);
    // Highest-risk-wins means each login is counted once, so the per-category
    // counts sum to the overall at-risk count.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("does not scan the replayed null from cipherViews$, which would report a permanently healthy vault", async () => {
    // This is what filterOutNullish() in the report pipeline is for, so this
    // test fails if it is ever removed as redundant. cipherViews$ is
    // shareReplay-cached with refCount: false and emits null when the
    // decrypted ciphers are cleared, so a fresh subscriber can receive null
    // FIRST. Scanning it reports an empty vault and, because take(1) then
    // completes, the user is stranded on a permanent "healthy" reading.
    const ciphers$ = new BehaviorSubject<CipherView[] | null>(null);
    cipherService.cipherViews$.mockReturnValue(ciphers$ as never);
    scanYields(new VaultHealthReportView({ totalCount: 40, atRiskCount: 12 }));

    await initComponent();

    // Nothing should have been scanned off the null.
    expect(reportService.buildVaultHealthReport).not.toHaveBeenCalled();
    expect(gauge()).toBeNull();

    // The real ciphers arrive; now it scans, exactly once, with those ciphers.
    const real = [{} as CipherView, {} as CipherView];
    ciphers$.next(real);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
    expect(reportService.buildVaultHealthReport).toHaveBeenCalledWith(real, userId);
    expect(gauge()?.value()).toBe(12);
    expect(text()).toContain("yourVaultRiskIsHigh");
  });

  it("renders nothing until the report resolves", async () => {
    // A scan that never settles, so the service never publishes a report.
    reportService.buildVaultHealthReport.mockReturnValue(new Promise<void>(() => {}));

    await initComponent();

    expect(gauge()).toBeNull();
    expect(rows()).toHaveLength(0);
  });

  it("renders an empty vault without error", async () => {
    scanYields(new VaultHealthReportView());

    await initComponent();

    expect(gauge()?.value()).toBe(0);
    expect(gauge()?.total()).toBe(0);
    expect(text()).toContain("yourVaultIsHealthy");
    expect(rows().map((r) => r.count())).toEqual([0, 0, 0]);
  });

  it("scans once and does not rescan when the vault changes", async () => {
    const ciphers$ = new BehaviorSubject<CipherView[]>([]);
    cipherService.cipherViews$.mockReturnValue(ciphers$);
    scanYields(new VaultHealthReportView({ totalCount: 1, atRiskCount: 0 }));

    await initComponent();
    expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);

    // A vault edit must not re-run the breach lookup.
    ciphers$.next([{} as CipherView]);
    await fixture.whenStable();

    expect(reportService.buildVaultHealthReport).toHaveBeenCalledTimes(1);
  });

  it("logs the error and renders nothing when the scan fails", async () => {
    reportService.buildVaultHealthReport.mockRejectedValue(new Error("HIBP unavailable"));

    await initComponent();

    expect(logService.error).toHaveBeenCalled();
    expect(gauge()).toBeNull();
    expect(rows()).toHaveLength(0);
  });
});
