import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RiskCategoryNavItemComponent } from "./risk-category-nav-item.component";

describe("RiskCategoryNavItemComponent", () => {
  let fixture: ComponentFixture<RiskCategoryNavItemComponent>;

  /**
   * Renders the row with the given count, defaulting the remaining inputs to
   * the Exposed category.
   */
  async function initComponent(
    inputs: Partial<{
      labelKeyNone: string;
      labelKeySingular: string;
      labelKeyPlural: string;
      descriptionKey: string;
      descriptionKeyNone: string;
      count: number;
      route: string;
      locked: boolean;
    }> = {},
  ) {
    fixture = TestBed.createComponent(RiskCategoryNavItemComponent);
    fixture.componentRef.setInput("labelKeyNone", inputs.labelKeyNone ?? "exposedPasswordsNone");
    fixture.componentRef.setInput("labelKeySingular", inputs.labelKeySingular ?? "exposedPassword");
    fixture.componentRef.setInput(
      "labelKeyPlural",
      inputs.labelKeyPlural ?? "exposedPasswordsPlural",
    );
    fixture.componentRef.setInput(
      "descriptionKey",
      inputs.descriptionKey ?? "exposedPasswordsDesc",
    );
    fixture.componentRef.setInput(
      "descriptionKeyNone",
      inputs.descriptionKeyNone ?? "exposedPasswordsNoneDesc",
    );
    fixture.componentRef.setInput("count", inputs.count ?? 0);
    fixture.componentRef.setInput("icon", "bwi-error");
    fixture.componentRef.setInput("route", inputs.route ?? "/health/exposed");
    fixture.componentRef.setInput("locked", inputs.locked ?? false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function tile(): HTMLElement | null {
    return fixture.nativeElement.querySelector("bit-icon-tile > div");
  }

  function tileIcon(): HTMLElement | null {
    return fixture.nativeElement.querySelector("bit-icon-tile i");
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskCategoryNavItemComponent, RouterTestingModule],
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

  it("uses the none title and description at a count of zero", async () => {
    await initComponent({ count: 0 });

    // "No exposed passwords", not "0 exposed passwords" — and the description
    // states the absence of risk rather than what the risk would have been.
    expect(text()).toContain("exposedPasswordsNone");
    expect(text()).toContain("exposedPasswordsNoneDesc");
    expect(text()).not.toContain("exposedPasswordsPlural");
  });

  it("shows a labelled checkmark in the leading tile when the category is healthy", async () => {
    await initComponent({ count: 0 });

    // The check replaces the category icon rather than sitting beside it, and
    // it carries a label so the healthy state is never conveyed by colour alone.
    expect(tileIcon()?.classList).toContain("bwi-check");
    expect(tileIcon()?.classList).not.toContain("bwi-error");
    expect(tile()?.getAttribute("aria-label")).toBe("categoryHealthy");
  });

  it("shows the category icon and no checkmark when the category has at-risk items", async () => {
    await initComponent({ count: 3 });

    expect(tileIcon()?.classList).toContain("bwi-error");
    expect(tileIcon()?.classList).not.toContain("bwi-check");
    expect(tile()?.getAttribute("aria-label")).toBeNull();
  });

  it("renders the row rather than hiding it when the count is zero", async () => {
    await initComponent({ count: 0 });

    expect(fixture.nativeElement.querySelector("a[bit-item-content]")).not.toBeNull();
  });

  it("links to the category's detail route", async () => {
    await initComponent({ route: "/health/reused" });

    const anchor = fixture.nativeElement.querySelector("a[bit-item-content]") as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe("/health/reused");
  });

  describe("when locked", () => {
    it("renders no link, so there is no route into the detail the user cannot access", async () => {
      await initComponent({ locked: true, count: 3 });

      expect(fixture.nativeElement.querySelector("a")).toBeNull();
      expect(fixture.nativeElement.querySelector("[bit-item-content]")).not.toBeNull();
    });

    it("replaces the navigation chevron with a labelled lock", async () => {
      await initComponent({ locked: true, count: 3 });

      // The lock carries a label because it is the only thing distinguishing a
      // locked row from a healthy one once the chevron is gone.
      const lock = fixture.nativeElement.querySelector("bit-icon.bwi-lock");
      expect(lock).not.toBeNull();
      expect(lock.getAttribute("aria-label")).toBe("premiumSubscriptionRequired");
      expect(fixture.nativeElement.querySelector("bit-icon.bwi-angle-right")).toBeNull();
    });

    it("still shows the category name, description and count", async () => {
      await initComponent({ locked: true, count: 7 });

      expect(text()).toContain("exposedPasswordsPlural");
      expect(text()).toContain("7");
      expect(text()).toContain("exposedPasswordsDesc");
    });

    it("keeps the category icon tile rather than swapping it for a lock", async () => {
      await initComponent({ locked: true, count: 3 });

      expect(tileIcon()?.classList).toContain("bwi-error");
    });
  });
});
