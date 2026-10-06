import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { HealthAdditionalRisksComponent } from "./health-additional-risks.component";

/** Only risks strictly below the viewed category show, in the order exposed > weak > reused. */
describe("HealthAdditionalRisksComponent", () => {
  let fixture: ComponentFixture<HealthAdditionalRisksComponent>;

  function buildHealthView(args: Partial<CipherHealthView> = {}): CipherHealthView {
    return new CipherHealthView({
      cipherId: "cipher-1",
      hasWeakPassword: false,
      hasReusedPassword: false,
      hasExposedPassword: false,
      exposedCount: 0,
      reuseCount: 0,
      ...args,
    });
  }

  async function initComponent(data: { currentCategory: RiskCategory; item: CipherHealthView }) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HealthAdditionalRisksComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthAdditionalRisksComponent);
    fixture.componentRef.setInput("currentCategory", data.currentCategory);
    fixture.componentRef.setInput("item", data.item);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent ?? "";
  }

  /** The additional risks card, or null when the component renders no additional risks. */
  function riskCard(): HTMLElement | null {
    return host().querySelector("bit-card");
  }

  /** Whether the "This password has additional risks" section is on screen at all. */
  function showsRiskSection(): boolean {
    return text().includes("passwordHasAdditionalRisks") && riskCard() != null;
  }

  function showsWeakRisk(): boolean {
    return riskCard()?.textContent?.includes("weak") ?? false;
  }

  function showsReusedRisk(): boolean {
    return riskCard()?.textContent?.includes("reused") ?? false;
  }

  describe("exposed passwords", () => {
    /** Exposed sits at the top of the hierarchy, so both lower risks can appear. */
    async function initExposed(flags: { weak: boolean; reused: boolean }) {
      await initComponent({
        currentCategory: RiskCategory.Exposed,
        item: buildHealthView({
          hasExposedPassword: true,
          hasWeakPassword: flags.weak,
          hasReusedPassword: flags.reused,
        }),
      });
    }

    it("shows both weak and reused when the item is also weak and reused", async () => {
      await initExposed({ weak: true, reused: true });

      expect(showsRiskSection()).toBe(true);
      expect(showsWeakRisk()).toBe(true);
      expect(showsReusedRisk()).toBe(true);
    });

    it("shows only weak when the item is also weak", async () => {
      await initExposed({ weak: true, reused: false });

      expect(showsRiskSection()).toBe(true);
      expect(showsWeakRisk()).toBe(true);
      expect(showsReusedRisk()).toBe(false);
    });

    it("shows only reused when the item is also reused", async () => {
      await initExposed({ weak: false, reused: true });

      expect(showsRiskSection()).toBe(true);
      expect(showsWeakRisk()).toBe(false);
      expect(showsReusedRisk()).toBe(true);
    });

    it("shows no risk section when the item has no lower risks", async () => {
      await initExposed({ weak: false, reused: false });

      expect(showsRiskSection()).toBe(false);
      expect(riskCard()).toBeNull();
    });
  });

  describe("weak passwords", () => {
    /** Weak sits in the middle, so only reused can appear — never weak itself. */
    async function initWeak(flags: { reused: boolean }) {
      await initComponent({
        currentCategory: RiskCategory.Weak,
        item: buildHealthView({
          hasWeakPassword: true,
          hasReusedPassword: flags.reused,
        }),
      });
    }

    it("shows only reused when the item is also reused", async () => {
      await initWeak({ reused: true });

      expect(showsRiskSection()).toBe(true);
      expect(showsWeakRisk()).toBe(false);
      expect(showsReusedRisk()).toBe(true);
    });

    it("shows no risk section when the item is not reused", async () => {
      await initWeak({ reused: false });

      expect(showsRiskSection()).toBe(false);
      expect(riskCard()).toBeNull();
    });

    it("never repeats weak, the category being viewed", async () => {
      await initWeak({ reused: true });

      expect(showsWeakRisk()).toBe(false);
    });
  });

  describe("reused passwords", () => {
    /** Reused sits at the bottom, so there is never a lower risk to surface. */
    it("shows no risk section even when the item is exposed and weak", async () => {
      await initComponent({
        currentCategory: RiskCategory.Reused,
        item: buildHealthView({
          hasExposedPassword: true,
          hasWeakPassword: true,
          hasReusedPassword: true,
        }),
      });

      expect(showsRiskSection()).toBe(false);
      expect(riskCard()).toBeNull();
    });

    it("shows no risk section when the item has no other risks", async () => {
      await initComponent({
        currentCategory: RiskCategory.Reused,
        item: buildHealthView({ hasReusedPassword: true }),
      });

      expect(showsRiskSection()).toBe(false);
      expect(riskCard()).toBeNull();
    });
  });

  it("renders the reuse count on the reused row", async () => {
    await initComponent({
      currentCategory: RiskCategory.Exposed,
      item: buildHealthView({ hasExposedPassword: true, hasReusedPassword: true, reuseCount: 3 }),
    });

    expect(riskCard()?.textContent).toContain("xTimes");
  });
});
