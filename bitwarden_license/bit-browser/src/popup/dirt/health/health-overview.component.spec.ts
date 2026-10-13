import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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
  readonly locked = input(false);
}

describe("HealthOverviewComponent", () => {
  let fixture: ComponentFixture<HealthOverviewComponent>;

  /** A distinct at-risk login; the fields are irrelevant to the overview. */
  function healthView(): CipherHealthView {
    return {} as CipherHealthView;
  }

  function items(count: number): CipherHealthView[] {
    return Array.from({ length: count }, () => healthView());
  }

  /**
   * The Health tab root owns the scan and the subscription check, so every test
   * drives this component through its inputs.
   */
  async function initComponent(report: VaultHealthReportView, locked = false) {
    fixture = TestBed.createComponent(HealthOverviewComponent);
    fixture.componentRef.setInput("report", report);
    fixture.componentRef.setInput("locked", locked);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function gauge(): MockAtRiskGaugeComponent | null {
    const el = fixture.debugElement.query((n) => n.name === "dirt-at-risk-gauge");
    return el ? (el.componentInstance as MockAtRiskGaugeComponent) : null;
  }

  function upgradeButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector("#health-overview_button_upgrade");
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
    await TestBed.configureTestingModule({
      imports: [HealthOverviewComponent, RouterTestingModule],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    })
      .overrideComponent(HealthOverviewComponent, {
        remove: { imports: [AtRiskGaugeComponent, RiskCategoryNavItemComponent] },
        add: { imports: [MockAtRiskGaugeComponent, MockRiskCategoryNavItemComponent] },
      })
      .compileComponents();
  });

  it("passes the at-risk and total counts to the gauge", async () => {
    await initComponent(
      new VaultHealthReportView({ totalCount: 100, atRiskCount: 10, score: 0.1 }),
    );

    expect(gauge()?.value()).toBe(10);
    expect(gauge()?.total()).toBe(100);
  });

  it("shows the at-risk heading and count when any password is at risk", async () => {
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

    expect(text()).toContain("yourVaultRiskIsHigh");
    expect(text()).toContain("passwordsNeedFixing");
    expect(text()).not.toContain("yourVaultIsHealthy");
  });

  it("shows the healthy heading when no passwords are at risk", async () => {
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 0 }));

    expect(text()).toContain("yourVaultIsHealthy");
    expect(text()).not.toContain("yourVaultRiskIsHigh");
  });

  it("keeps the same count line in the clean state, reading zero of the total", async () => {
    // The design shows "0 of 200 passwords need fixing" when nothing is at
    // risk, so the line is not swapped for a differently-phrased one.
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 0 }));

    expect(text()).toContain("passwordsNeedFixing");
  });

  it("labels the category list with a section header", async () => {
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

    expect(fixture.nativeElement.querySelector("bit-section-header")).not.toBeNull();
    expect(text()).toContain("risksIdentified");
  });

  it("renders the three categories in Exposed, Weak, Reused order", async () => {
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

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
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 0 }));

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
    await initComponent(
      new VaultHealthReportView({
        totalCount: 100,
        atRiskCount: 7,
        categoryItems: { exposed: items(7), weak: [], reused: [] },
      }),
    );

    expect(rows()).toHaveLength(3);
    expect(rows().map((r) => r.count())).toEqual([7, 0, 0]);
  });

  it("uses each category's deduplicated item count", async () => {
    await initComponent(
      new VaultHealthReportView({
        totalCount: 100,
        atRiskCount: 10,
        categoryItems: { exposed: items(7), weak: items(2), reused: items(1) },
      }),
    );

    const counts = rows().map((r) => r.count());
    expect(counts).toEqual([7, 2, 1]);
    // Highest-risk-wins means each login is counted once, so the per-category
    // counts sum to the overall at-risk count.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("renders an empty vault without error", async () => {
    await initComponent(new VaultHealthReportView());

    expect(gauge()?.value()).toBe(0);
    expect(gauge()?.total()).toBe(0);
    expect(text()).toContain("yourVaultIsHealthy");
    expect(rows().map((r) => r.count())).toEqual([0, 0, 0]);
  });

  it("re-renders when a new report is supplied", async () => {
    await initComponent(new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 }));

    fixture.componentRef.setInput(
      "report",
      new VaultHealthReportView({ totalCount: 50, atRiskCount: 0 }),
    );
    fixture.detectChanges();

    expect(gauge()?.value()).toBe(0);
    expect(gauge()?.total()).toBe(50);
    expect(text()).toContain("yourVaultIsHealthy");
  });

  describe("when locked", () => {
    const report = () => new VaultHealthReportView({ totalCount: 100, atRiskCount: 10 });

    it("locks every category row", async () => {
      await initComponent(report(), true);

      expect(rows().map((r) => r.locked())).toEqual([true, true, true]);
    });

    it("leaves every category row unlocked by default", async () => {
      await initComponent(report());

      expect(rows().map((r) => r.locked())).toEqual([false, false, false]);
    });

    it("still shows the gauge and the counts", async () => {
      await initComponent(report(), true);

      // A free user sees the same scan result; only the detail is withheld.
      expect(gauge()?.value()).toBe(10);
      expect(gauge()?.total()).toBe(100);
      expect(text()).toContain("yourVaultRiskIsHigh");
    });

    it("shows the upgrade button below the categories", async () => {
      await initComponent(report(), true);

      const button = upgradeButton();
      expect(button).not.toBeNull();
      expect(button?.textContent).toContain("upgradeToViewPasswords");

      // Below all three rows, per the design.
      const rendered = Array.from(
        fixture.nativeElement.querySelectorAll("dirt-risk-category-nav-item, button[bitButton]"),
      );
      expect(rendered.indexOf(button!)).toBe(rendered.length - 1);
    });

    it("emits upgrade when the button is pressed, leaving the launch to the Health tab root", async () => {
      await initComponent(report(), true);
      const emitted = jest.fn();
      fixture.componentInstance.upgrade.subscribe(emitted);

      upgradeButton()?.click();

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it("does not show the upgrade button when unlocked", async () => {
      await initComponent(report());

      expect(upgradeButton()).toBeNull();
    });
  });
});
