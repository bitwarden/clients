import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { VaultArrowNavDirective } from "./vault-arrow-nav.directive";

/**
 * Test host component that recreates a minimal vault popup structure:
 * - A bit-search input
 * - Multiple bit-item elements, each with a content button and action buttons
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div appVaultArrowNav>
      <bit-search>
        <input id="search-input" type="text" />
      </bit-search>

      <bit-item id="item-0">
        <bit-item-action data-item-main-content>
          <button type="button" bit-item-content id="content-0">Item 0</button>
        </bit-item-action>
        <div>
          <bit-item-action><button type="button" id="action-0-fill">Fill</button></bit-item-action>
          <app-item-copy-actions>
            <bit-item-action
              ><button type="button" id="action-0-user">Copy Username</button></bit-item-action
            >
            <bit-item-action
              ><button type="button" id="action-0-pass">Copy Password</button></bit-item-action
            >
          </app-item-copy-actions>
          <app-item-more-options>
            <bit-item-action
              ><button type="button" id="action-0-more">More</button></bit-item-action
            >
          </app-item-more-options>
        </div>
      </bit-item>

      <bit-item id="item-1">
        <bit-item-action data-item-main-content>
          <button type="button" bit-item-content id="content-1">Item 1</button>
        </bit-item-action>
        <div>
          <bit-item-action><button type="button" id="action-1-fill">Fill</button></bit-item-action>
          <app-item-copy-actions>
            <bit-item-action
              ><button type="button" id="action-1-user">Copy Username</button></bit-item-action
            >
          </app-item-copy-actions>
        </div>
      </bit-item>

      <bit-item id="item-2">
        <bit-item-action data-item-main-content>
          <button type="button" bit-item-content id="content-2">Item 2</button>
        </bit-item-action>
        <div>
          <bit-item-action><button type="button" id="action-2-fill">Fill</button></bit-item-action>
          <bit-item-action>
            <button type="button" id="action-2-disabled" disabled>Disabled</button>
          </bit-item-action>
          <app-item-more-options>
            <bit-item-action
              ><button type="button" id="action-2-more">More</button></bit-item-action
            >
          </app-item-more-options>
        </div>
      </bit-item>
    </div>
  `,
  imports: [VaultArrowNavDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class TestHostComponent {}

describe("VaultArrowNavDirective", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostEl: HTMLElement;
  let originalOffsetParent: PropertyDescriptor | undefined;

  function getEl(id: string): HTMLElement {
    return hostEl.querySelector(`#${id}`) as HTMLElement;
  }

  function dispatchKey(target: HTMLElement, key: string): void {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
  }

  beforeEach(async () => {
    originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return this.parentNode;
      },
    });

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostEl = fixture.nativeElement;
  });

  afterEach(() => {
    if (originalOffsetParent) {
      Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
    }
  });

  describe("ArrowDown", () => {
    it("should move focus from search input to first list item", () => {
      const searchInput = getEl("search-input");
      searchInput.focus();

      dispatchKey(searchInput, "ArrowDown");

      expect(document.activeElement).toBe(getEl("content-0"));
    });

    it("should move focus from first item to second item", () => {
      const content0 = getEl("content-0");
      content0.focus();

      dispatchKey(content0, "ArrowDown");

      expect(document.activeElement).toBe(getEl("content-1"));
    });

    it("should move focus from second item to third item", () => {
      const content1 = getEl("content-1");
      content1.focus();

      dispatchKey(content1, "ArrowDown");

      expect(document.activeElement).toBe(getEl("content-2"));
    });

    it("should not move focus when on the last item", () => {
      const content2 = getEl("content-2");
      content2.focus();

      dispatchKey(content2, "ArrowDown");

      expect(document.activeElement).toBe(content2);
    });

    it("should move to next item even when focused on an action button", () => {
      const actionFill = getEl("action-0-fill");
      actionFill.focus();

      dispatchKey(actionFill, "ArrowDown");

      expect(document.activeElement).toBe(getEl("content-1"));
    });
  });

  describe("ArrowUp", () => {
    it("should move focus from second item to first item", () => {
      const content1 = getEl("content-1");
      content1.focus();

      dispatchKey(content1, "ArrowUp");

      expect(document.activeElement).toBe(getEl("content-0"));
    });

    it("should move focus from first item back to search input", () => {
      const content0 = getEl("content-0");
      content0.focus();

      dispatchKey(content0, "ArrowUp");

      expect(document.activeElement).toBe(getEl("search-input"));
    });

    it("should move to previous item when focused on an action button", () => {
      const actionFill = getEl("action-1-fill");
      actionFill.focus();

      dispatchKey(actionFill, "ArrowUp");

      expect(document.activeElement).toBe(getEl("content-0"));
    });
  });

  describe("ArrowRight", () => {
    it("should move focus from content button to first action button", () => {
      const content0 = getEl("content-0");
      content0.focus();

      dispatchKey(content0, "ArrowRight");

      expect(document.activeElement).toBe(getEl("action-0-fill"));
    });

    it("should cycle through action buttons", () => {
      const actionFill = getEl("action-0-fill");
      actionFill.focus();

      dispatchKey(actionFill, "ArrowRight");
      expect(document.activeElement).toBe(getEl("action-0-user"));

      dispatchKey(getEl("action-0-user"), "ArrowRight");
      expect(document.activeElement).toBe(getEl("action-0-pass"));

      dispatchKey(getEl("action-0-pass"), "ArrowRight");
      expect(document.activeElement).toBe(getEl("action-0-more"));
    });

    it("should not move past the last action button", () => {
      const actionMore = getEl("action-0-more");
      actionMore.focus();

      dispatchKey(actionMore, "ArrowRight");

      expect(document.activeElement).toBe(actionMore);
    });

    it("should skip disabled buttons", () => {
      const content2 = getEl("content-2");
      content2.focus();

      dispatchKey(content2, "ArrowRight");
      expect(document.activeElement).toBe(getEl("action-2-fill"));

      dispatchKey(getEl("action-2-fill"), "ArrowRight");
      // Should skip action-2-disabled and go to action-2-more
      expect(document.activeElement).toBe(getEl("action-2-more"));
    });
  });

  describe("ArrowLeft", () => {
    it("should move focus from action button back to content button", () => {
      const actionFill = getEl("action-0-fill");
      actionFill.focus();

      dispatchKey(actionFill, "ArrowLeft");

      expect(document.activeElement).toBe(getEl("content-0"));
    });

    it("should move focus from second action to first action", () => {
      const actionUser = getEl("action-0-user");
      actionUser.focus();

      dispatchKey(actionUser, "ArrowLeft");

      expect(document.activeElement).toBe(getEl("action-0-fill"));
    });

    it("should not move past the content button", () => {
      const content0 = getEl("content-0");
      content0.focus();

      dispatchKey(content0, "ArrowLeft");

      expect(document.activeElement).toBe(content0);
    });
  });

  describe("Non-arrow keys", () => {
    it("should not interfere with non-arrow key events", () => {
      const searchInput = getEl("search-input");
      searchInput.focus();

      dispatchKey(searchInput, "Tab");

      // Focus should remain on search input (Tab doesn't trigger our directive logic)
      expect(document.activeElement).toBe(searchInput);
    });
  });
});
