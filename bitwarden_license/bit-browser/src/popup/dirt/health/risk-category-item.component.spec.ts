import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RiskCategoryItemComponent } from "./risk-category-item.component";

describe("RiskCategoryItemComponent", () => {
  let fixture: ComponentFixture<RiskCategoryItemComponent>;

  /**
   * Renders the row with the given count, defaulting the remaining inputs to
   * the Exposed category.
   */
  async function initComponent(
    inputs: Partial<{
      labelKey: string;
      descriptionKey: string;
      count: number;
      route: string;
    }> = {},
  ) {
    fixture = TestBed.createComponent(RiskCategoryItemComponent);
    fixture.componentRef.setInput("labelKey", inputs.labelKey ?? "exposedPasswords");
    fixture.componentRef.setInput(
      "descriptionKey",
      inputs.descriptionKey ?? "exposedPasswordsDesc",
    );
    fixture.componentRef.setInput("count", inputs.count ?? 0);
    fixture.componentRef.setInput("icon", "bwi-error");
    fixture.componentRef.setInput("route", inputs.route ?? "/health/exposed");
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function checkmark(): HTMLElement | null {
    return fixture.nativeElement.querySelector(".bwi-check-circle");
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskCategoryItemComponent, RouterTestingModule],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();
  });

  it("renders the localized category name and description", async () => {
    await initComponent({ labelKey: "weakPasswords", descriptionKey: "weakPasswordsDesc" });

    expect(text()).toContain("weakPasswords");
    expect(text()).toContain("weakPasswordsDesc");
  });

  it("renders the at-risk count", async () => {
    await initComponent({ count: 7 });

    expect(text()).toContain("7");
  });

  it("shows a labelled checkmark when the category is healthy", async () => {
    await initComponent({ count: 0 });

    // The label matters as much as the icon: the healthy state must not be
    // conveyed by colour alone.
    expect(checkmark()).not.toBeNull();
    expect(checkmark()?.getAttribute("aria-label")).toBe("categoryHealthy");
  });

  it("does not show a checkmark when the category has at-risk items", async () => {
    await initComponent({ count: 3 });

    expect(checkmark()).toBeNull();
  });

  it("renders a count of zero rather than hiding the row", async () => {
    await initComponent({ count: 0 });

    expect(text()).toContain("0");
    expect(fixture.nativeElement.querySelector("a[bit-item-content]")).not.toBeNull();
  });

  it("links to the category's detail route", async () => {
    await initComponent({ route: "/health/reused" });

    const anchor = fixture.nativeElement.querySelector("a[bit-item-content]") as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe("/health/reused");
  });
});
