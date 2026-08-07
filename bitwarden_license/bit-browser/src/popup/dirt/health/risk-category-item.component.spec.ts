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
      labelKeySingular: string;
      labelKeyPlural: string;
      descriptionKey: string;
      count: number;
      route: string;
    }> = {},
  ) {
    fixture = TestBed.createComponent(RiskCategoryItemComponent);
    fixture.componentRef.setInput("labelKeySingular", inputs.labelKeySingular ?? "exposedPassword");
    fixture.componentRef.setInput(
      "labelKeyPlural",
      inputs.labelKeyPlural ?? "exposedPasswordsPlural",
    );
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
      providers: [
        {
          provide: I18nService,
          // Echo the key plus any substitutions, so a test can assert both the
          // key that was chosen and the count passed into it.
          // The i18n pipe always passes three placeholder slots, so drop the
          // empty ones or every key gains trailing spaces.
          useValue: {
            t: (key: string, ...args: string[]) =>
              [key, ...args.filter((a) => a !== "" && a != null)].join(" "),
          },
        },
      ],
    }).compileComponents();
  });

  it("renders the localized category name and description", async () => {
    await initComponent({
      labelKeyPlural: "weakPasswordsPlural",
      descriptionKey: "weakPasswordsDesc",
      count: 4,
    });

    expect(text()).toContain("weakPasswordsPlural");
    expect(text()).toContain("weakPasswordsDesc");
  });

  it("renders the at-risk count inside the title", async () => {
    await initComponent({ count: 7 });

    // The mock i18n echoes the key, so assert on the key choice and that the
    // count is passed through as the placeholder argument.
    expect(text()).toContain("exposedPasswordsPlural");
    expect(text()).toContain("7");
  });

  it("uses the singular title at a count of exactly one", async () => {
    await initComponent({ count: 1 });

    expect(text()).toContain("exposedPassword");
    expect(text()).not.toContain("exposedPasswordsPlural");
  });

  it("uses the plural title at a count of zero", async () => {
    await initComponent({ count: 0 });

    expect(text()).toContain("exposedPasswordsPlural");
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
