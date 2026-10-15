import { ComponentFixture, TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../../utils/i18n-mock.service";

import { ChipGroupComponent, ChipGroupItem } from "./chip-group.component";

// Opening the overflow popover mounts a CDK overlay, and JSDOM can neither parse the
// stylesheets the overlay pulls in nor decide that the panel's focus target is visible.
// Both are environment limitations rather than anything the component controls, so they're
// filtered out to keep real failures legible.
/* eslint-disable no-console */
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: unknown[]) => {
  // JSDOM constructs the error in its own realm, so `instanceof Error` doesn't hold here.
  if (
    typeof args[0] === "object" &&
    (args[0] as Error)?.message?.includes("Could not parse CSS stylesheet")
  ) {
    return;
  }
  originalError(...args);
};

console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("[cdkFocusInitial]' is not focusable")) {
    return;
  }
  originalWarn(...args);
};
/* eslint-enable no-console */

// JSDOM implements neither ResizeObserver nor layout. `observedWidth` primes the
// container width from `clientWidth` before it ever observes, so a no-op stub plus
// the geometry overrides below are enough to drive packing deterministically.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

/** Wide enough for the pinned chip only: 100 + trigger(40) + two gaps leaves no room for a second. */
const CONTAINER_WIDTH = 150;
/** Wide enough for two chips, but not for three plus the trigger. */
const TWO_CHIP_WIDTH = 250;
const CHIP_WIDTH = 100;
const TRIGGER_WIDTH = 40;

const chips: ChipGroupItem[] = [
  { id: "personal", label: "Personal", variant: "subtle" },
  { id: "work", label: "Work", variant: "subtle" },
  { id: "favorite", label: "Favorite", variant: "subtle" },
];

describe("ChipGroupComponent", () => {
  let fixture: ComponentFixture<ChipGroupComponent>;
  let selected: ChipGroupItem[];
  let dismissed: ChipGroupItem[];

  // Every geometry read in JSDOM returns zero, so packing can never be exercised
  // against real layout. Report fixed widths per element role instead, which keeps
  // `measure.ts` and `observed-width.ts` in the code path rather than mocking them.
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  const originalClientWidth = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "clientWidth",
  ) as PropertyDescriptor;

  // `observedWidth` primes from `clientWidth` at first render, so a test that needs a
  // different budget sets this before the first `settle()`.
  let containerWidth = CONTAINER_WIDTH;

  beforeAll(() => {
    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      const width = this.hasAttribute("bitoverflowtrigger")
        ? TRIGGER_WIDTH
        : this.hasAttribute("bit-chip-action") || this.tagName === "BIT-CHIP"
          ? CHIP_WIDTH
          : 0;
      return {
        width,
        height: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };

    Object.defineProperty(Element.prototype, "clientWidth", {
      configurable: true,
      get(this: Element) {
        return this.hasAttribute("bitoverflowlist") ? containerWidth : 0;
      },
    });
  });

  afterAll(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    Object.defineProperty(Element.prototype, "clientWidth", originalClientWidth);
  });

  beforeEach(async () => {
    containerWidth = CONTAINER_WIDTH;

    await TestBed.configureTestingModule({
      imports: [ChipGroupComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              showMore: "Show more",
              showMoreCount: "Show more",
              removeItem: (name?: string) => `Remove ${name}`,
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChipGroupComponent);
    selected = [];
    dismissed = [];
    fixture.componentInstance.chipSelect.subscribe((chip) => selected.push(chip));
    fixture.componentInstance.chipDismiss.subscribe((chip) => dismissed.push(chip));
  });

  /** The chip buttons in the visible row, excluding the trailing overflow trigger. */
  const rowChips = () =>
    fixture.debugElement
      .queryAll(By.css("[bit-chip-action]"))
      .map((el) => el.nativeElement as HTMLButtonElement)
      .filter((el) => !el.hasAttribute("bitoverflowtrigger"));

  const triggerChip = () =>
    fixture.debugElement.query(By.css("[bitOverflowTrigger]")).nativeElement as HTMLButtonElement;

  /** The chip buttons rendered into the overflow popover's CDK overlay. */
  const popoverChips = () =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(".cdk-overlay-container [bit-chip-action]"),
    );

  const popoverIsOpen = () =>
    document.querySelector(".cdk-overlay-container [role=dialog]") != null;

  /** Flush the overflow list's `afterNextRender` + `fonts.ready` measurement pass. */
  const settle = () => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  };

  describe("rendering", () => {
    it("renders a chip per item, labelled by the item's label", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.detectChanges();

      expect(rowChips().map((chip) => chip.textContent?.trim())).toEqual([
        "Personal",
        "Work",
        "Favorite",
      ]);
    });

    it("renders no chips when given an empty list", () => {
      fixture.componentRef.setInput("chips", []);
      fixture.detectChanges();

      expect(rowChips()).toHaveLength(0);
    });

    it("names the group when accessibleName is set", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.componentRef.setInput("accessibleName", "Shared folders");
      fixture.detectChanges();

      const group = fixture.debugElement.query(By.css("[role=group]")).nativeElement as HTMLElement;
      expect(group.getAttribute("aria-label")).toBe("Shared folders");
    });

    it("leaves the group unnamed when accessibleName is omitted", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.detectChanges();

      const group = fixture.debugElement.query(By.css("[role=group]")).nativeElement as HTMLElement;
      expect(group.hasAttribute("aria-label")).toBe(false);
    });
  });

  describe("selection", () => {
    it("emits the activated item from the visible row", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.detectChanges();

      rowChips()[1].click();

      expect(selected).toEqual([chips[1]]);
    });

    it("emits the whole item, so consumers get both the id and the label", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.detectChanges();

      rowChips()[0].click();

      expect(selected[0].id).toBe("personal");
      expect(selected[0].label).toBe("Personal");
    });

    it("emits for a chip activated inside the overflow popover", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips);
      settle();

      // Only the pinned first chip fits; "Work" and "Favorite" are behind the "+2" chip.
      expect(rowChips().filter((chip) => !chip.hidden)).toHaveLength(1);

      triggerChip().click();
      fixture.detectChanges();
      expect(popoverChips().map((chip) => chip.textContent?.trim())).toEqual(["Work", "Favorite"]);

      popoverChips()[1].click();
      fixture.detectChanges();

      expect(selected).toEqual([chips[2]]);
      flush();
    }));

    it("closes the overflow popover when a chip inside it is activated", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips);
      settle();

      triggerChip().click();
      fixture.detectChanges();
      expect(popoverIsOpen()).toBe(true);

      // Leaving the popover open over a list the consumer is about to filter would
      // strand focus in stale content.
      popoverChips()[0].click();
      fixture.detectChanges();

      expect(popoverIsOpen()).toBe(false);
      flush();
    }));
  });

  // Chips are buttons, so anything the packing pass hides is a control that may hold focus.
  // JSDOM has no layout and so never blurs a `display: none` element the way a browser does;
  // these assert the replacement the component picks, which is what prevents the browser
  // from dropping focus on `document.body`.
  describe("focus management", () => {
    it("moves focus to the overflow trigger when the focused chip is packed away", fakeAsync(() => {
      containerWidth = TWO_CHIP_WIDTH;
      fixture.componentRef.setInput("chips", chips.slice(0, 2));
      settle();
      expect(rowChips().filter((chip) => !chip.hidden)).toHaveLength(2);

      rowChips()[1].focus();

      // A third chip pushes the row past the container, so "Work" is packed into the popover.
      fixture.componentRef.setInput("chips", chips);
      settle();

      expect(rowChips()[1].hidden).toBe(true);
      expect(document.activeElement).toBe(triggerChip());
      flush();
    }));

    it("moves focus into the row when the focused overflow trigger is hidden", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips);
      settle();
      expect(triggerChip().hidden).toBe(false);

      triggerChip().focus();

      // Down to one chip, nothing overflows and the trigger goes away with it.
      fixture.componentRef.setInput("chips", [chips[0]]);
      settle();

      expect(triggerChip().hidden).toBe(true);
      expect(document.activeElement).toBe(rowChips()[0]);
      flush();
    }));

    it("never hands focus to a chip element the consumer just removed", fakeAsync(() => {
      const four = [...chips, { id: "archived", label: "Archived", variant: "subtle" as const }];
      fixture.componentRef.setInput("chips", four);
      settle();
      triggerChip().focus();

      // Removing a chip destroys the last chip element while the remeasure hides the trigger;
      // focusing that destroyed element drops focus on `document.body`.
      const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
      fixture.componentRef.setInput("chips", [four[0], four[1], four[3]]);
      settle();
      flush();

      expect(focusSpy.mock.contexts.filter((el) => !(el as HTMLElement).isConnected)).toEqual([]);
      focusSpy.mockRestore();
    }));

    it("leaves focus alone when it sits outside the group", fakeAsync(() => {
      const outside = document.createElement("button");
      document.body.appendChild(outside);
      outside.focus();

      fixture.componentRef.setInput("chips", chips);
      settle();

      expect(document.activeElement).toBe(outside);
      outside.remove();
      flush();
    }));
  });

  describe("dismissible", () => {
    const rowDismissButtons = () =>
      fixture.debugElement
        .queryAll(By.css("bit-chip [bit-chip-dismiss-button]"))
        .map((el) => el.nativeElement as HTMLButtonElement);

    const popoverDismissButtons = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".cdk-overlay-container bit-chip [bit-chip-dismiss-button]",
        ),
      );

    beforeEach(() => {
      fixture.componentRef.setInput("dismissible", true);
    });

    it("emits chipDismiss, not chipSelect, from a row chip's dismiss button", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.detectChanges();

      rowDismissButtons()[1].click();

      expect(dismissed).toEqual([chips[1]]);
      expect(selected).toEqual([]);
    });

    it("ignores clicks on a chip's body", () => {
      fixture.componentRef.setInput("chips", chips);
      fixture.detectChanges();

      (fixture.debugElement.query(By.css("bit-chip")).nativeElement as HTMLElement).click();

      expect(selected).toEqual([]);
      expect(dismissed).toEqual([]);
    });

    /** Dismisses a popover chip and removes it from the input, as a consumer would. */
    const dismissFromPopover = (index: number) => {
      const button = popoverDismissButtons()[index];
      button.focus();
      button.click();
      fixture.componentRef.setInput(
        "chips",
        fixture.componentInstance.chips().filter((chip) => !dismissed.includes(chip)),
      );
      settle();
    };

    it("keeps the popover open and focuses the next chip when one of several is dismissed", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips);
      settle();
      triggerChip().click();
      fixture.detectChanges();

      dismissFromPopover(0);

      expect(dismissed).toEqual([chips[1]]);
      expect(popoverIsOpen()).toBe(true);
      expect(popoverDismissButtons()).toHaveLength(1);
      expect(document.activeElement).toBe(popoverDismissButtons()[0]);
      flush();
    }));

    it("focuses the previous chip when the last one in the popover is dismissed", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips);
      settle();
      triggerChip().click();
      fixture.detectChanges();

      dismissFromPopover(1);

      expect(dismissed).toEqual([chips[2]]);
      expect(popoverIsOpen()).toBe(true);
      expect(document.activeElement).toBe(popoverDismissButtons()[0]);
      flush();
    }));

    it("closes the popover and focuses the row once a dismissal lets every chip fit", fakeAsync(() => {
      // Three chips need the trigger and overflow two; two chips fit without it.
      containerWidth = TWO_CHIP_WIDTH;
      fixture.componentRef.setInput("chips", chips);
      settle();
      triggerChip().click();
      fixture.detectChanges();
      expect(popoverDismissButtons()).toHaveLength(2);

      dismissFromPopover(0);
      tick();
      fixture.detectChanges();

      expect(popoverIsOpen()).toBe(false);
      expect(document.activeElement).toBe(rowDismissButtons()[1]);
      flush();
    }));

    it("closes the popover when its only chip is dismissed", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips.slice(0, 2));
      settle();
      triggerChip().click();
      fixture.detectChanges();

      popoverDismissButtons()[0].click();
      fixture.detectChanges();

      expect(dismissed).toEqual([chips[1]]);
      expect(popoverIsOpen()).toBe(false);
      flush();
    }));

    it("moves focus to the overflow trigger when a focused dismiss button is packed away", fakeAsync(() => {
      containerWidth = TWO_CHIP_WIDTH;
      fixture.componentRef.setInput("chips", chips.slice(0, 2));
      settle();

      rowDismissButtons()[1].focus();

      fixture.componentRef.setInput("chips", chips);
      settle();

      expect(document.activeElement).toBe(triggerChip());
      flush();
    }));

    it("moves focus to a row chip's dismiss button when the focused trigger is hidden", fakeAsync(() => {
      fixture.componentRef.setInput("chips", chips);
      settle();

      triggerChip().focus();

      fixture.componentRef.setInput("chips", [chips[0]]);
      settle();

      expect(document.activeElement).toBe(rowDismissButtons()[0]);
      flush();
    }));
  });
});
