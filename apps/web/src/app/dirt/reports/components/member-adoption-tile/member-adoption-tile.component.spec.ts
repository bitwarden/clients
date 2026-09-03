import { OverlayContainer } from "@angular/cdk/overlay";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { MemberAdoptionTileComponent } from "./member-adoption-tile.component";

describe("MemberAdoptionTileComponent", () => {
  let fixture: ComponentFixture<MemberAdoptionTileComponent>;
  let i18nService: MockProxy<I18nService>;
  let overlayContainer: OverlayContainer;
  // eslint-disable-next-line no-console
  const originalError = console.error;

  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.error = (...args) => {
      if (
        typeof args[0] === "object" &&
        (args[0] as Error).message?.includes("Could not parse CSS stylesheet")
      ) {
        // Opening the overlay container in tests causes stylesheets to be parsed,
        // which can lead to JSDOM unable to parse CSS errors. These can be ignored safely.
        return;
      }
      originalError(...args);
    };
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  const testId = (id: string) => fixture.debugElement.query(By.css(`[data-testid="${id}"]`));
  const text = (id: string) => testId(id)?.nativeElement.textContent.trim();

  const overlay = (selector: string) =>
    overlayContainer.getContainerElement().querySelector(selector);

  const infoButton = () => testId("tile-info").nativeElement as HTMLButtonElement;

  const openPopover = () => {
    infoButton().click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [MemberAdoptionTileComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);

    fixture = TestBed.createComponent(MemberAdoptionTileComponent);
    fixture.componentRef.setInput("label", "Member adoption");
    fixture.componentRef.setInput("value", "65%");
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it("renders the label, value, unit and sublabel", () => {
    fixture.componentRef.setInput("unit", "of members");
    fixture.componentRef.setInput("sublabel", "Logged in over last 30 days");
    fixture.detectChanges();

    expect(text("tile-label")).toBe("Member adoption");
    expect(text("tile-value")).toBe("65%");
    expect(text("tile-unit")).toBe("of members");
    expect(text("tile-sublabel")).toBe("Logged in over last 30 days");
  });

  it("omits the unit and sublabel when they are not supplied", () => {
    fixture.detectChanges();

    expect(testId("tile-unit")).toBeNull();
    expect(testId("tile-sublabel")).toBeNull();
  });

  describe("empty value", () => {
    it.each(["", "   "])("renders a placeholder instead of the value for %p", (value) => {
      fixture.componentRef.setInput("value", value);
      fixture.detectChanges();

      expect(testId("tile-value")).toBeNull();
      expect(text("tile-value-empty")).toBe("-");
    });

    it("suppresses the unit so it does not dangle on its own", () => {
      fixture.componentRef.setInput("value", "");
      fixture.componentRef.setInput("unit", "of members");
      fixture.detectChanges();

      expect(testId("tile-unit")).toBeNull();
    });

    it("keeps the unit beside the skeleton while loading", () => {
      fixture.componentRef.setInput("value", "");
      fixture.componentRef.setInput("unit", "of members");
      fixture.componentRef.setInput("loading", true);
      fixture.detectChanges();

      expect(text("tile-unit")).toBe("of members");
    });

    it("renders the value once a non-empty one arrives", () => {
      fixture.componentRef.setInput("value", "");
      fixture.detectChanges();
      fixture.componentRef.setInput("value", "65%");
      fixture.detectChanges();

      expect(testId("tile-value-empty")).toBeNull();
      expect(text("tile-value")).toBe("65%");
    });
  });

  describe("info popover", () => {
    const title = "Measuring plan usage";
    const body = "Plan usage is the share of members who have redeemed this plan.";

    const withInfo = () => {
      fixture.componentRef.setInput("infoTitle", title);
      fixture.componentRef.setInput("infoBody", body);
      fixture.detectChanges();
    };

    it("is not rendered when neither the title nor the body is supplied", () => {
      fixture.detectChanges();

      expect(testId("tile-info")).toBeNull();
    });

    it.each([
      ["title", { infoTitle: title, infoBody: undefined }],
      ["body", { infoTitle: undefined, infoBody: body }],
    ])("is not rendered with only the %s", (_name, inputs) => {
      fixture.componentRef.setInput("infoTitle", inputs.infoTitle);
      fixture.componentRef.setInput("infoBody", inputs.infoBody);
      fixture.detectChanges();

      expect(testId("tile-info")).toBeNull();
    });

    it("is not rendered when the title or the body is whitespace", () => {
      fixture.componentRef.setInput("infoTitle", "   ");
      fixture.componentRef.setInput("infoBody", body);
      fixture.detectChanges();

      expect(testId("tile-info")).toBeNull();
    });

    it("is a focusable button named by the title", () => {
      withInfo();

      const button = infoButton();

      expect(button.tagName).toBe("BUTTON");
      expect(button.type).toBe("button");
      expect(button.getAttribute("aria-label")).toBe(title);

      button.focus();
      expect(document.activeElement).toBe(button);

      button.blur();
    });

    it("stays closed until the trigger is activated", () => {
      withInfo();

      expect(infoButton().getAttribute("aria-expanded")).toBe("false");
      expect(overlay('[data-testid="tile-info-body"]')).toBeNull();
    });

    it("opens a labelled dialog with the title and the trimmed body", () => {
      fixture.componentRef.setInput("infoTitle", `  ${title}  `);
      fixture.componentRef.setInput("infoBody", `  ${body}  `);
      fixture.detectChanges();

      openPopover();

      expect(infoButton().getAttribute("aria-expanded")).toBe("true");

      const dialog = overlay('[role="dialog"]');
      expect(dialog?.getAttribute("aria-label")).toBe(title);
      expect(dialog?.textContent).toContain(title);
      expect(overlay('[data-testid="tile-info-body"]')?.textContent?.trim()).toBe(body);
    });

    it("offers a labelled close button that dismisses the popover", () => {
      withInfo();
      openPopover();

      const close = overlay("button[bitIconButton]") as HTMLButtonElement;
      expect(close.getAttribute("aria-label")).toBe("close");

      close.click();
      fixture.detectChanges();

      expect(overlay('[data-testid="tile-info-body"]')).toBeNull();
      expect(infoButton().getAttribute("aria-expanded")).toBe("false");
    });

    it("closes again when the trigger is activated a second time", () => {
      withInfo();
      openPopover();
      openPopover();

      expect(overlay('[data-testid="tile-info-body"]')).toBeNull();
      expect(infoButton().getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("loading", () => {
    it("replaces the value with a skeleton", () => {
      fixture.componentRef.setInput("loading", true);
      fixture.componentRef.setInput("unit", "of members");
      fixture.detectChanges();

      expect(testId("tile-skeleton")).not.toBeNull();
      expect(testId("tile-value")).toBeNull();
      expect(text("tile-unit")).toBe("of members");
    });

    it("shows the value once loading finishes", () => {
      fixture.componentRef.setInput("loading", true);
      fixture.detectChanges();
      fixture.componentRef.setInput("loading", false);
      fixture.detectChanges();

      expect(testId("tile-skeleton")).toBeNull();
      expect(text("tile-value")).toBe("65%");
    });
  });
});
