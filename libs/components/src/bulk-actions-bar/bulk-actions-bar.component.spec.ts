import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BulkActionComponent } from "./bulk-action.component";
import { BulkActionsBarComponent } from "./bulk-actions-bar.component";

@Component({
  imports: [BulkActionsBarComponent, BulkActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="outside" type="button">Outside</button>
    <bit-bulk-actions-bar [selectedCount]="count()" (clear)="onClear()">
      <button id="first-action" bitBulkAction icon="bwi-folder" type="button">First</button>
      <button id="second-action" bitBulkAction icon="bwi-trash" type="button">Second</button>
    </bit-bulk-actions-bar>
  `,
})
class HostComponent {
  readonly count = signal(0);
  readonly cleared = signal(0);

  readonly bar = viewChild.required(BulkActionsBarComponent);

  onClear() {
    this.cleared.update((v) => v + 1);
  }
}

describe("BulkActionsBarComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const innerBar = () =>
    fixture.debugElement.query(By.css('[role="toolbar"]')).nativeElement as HTMLElement;
  const outside = () => fixture.nativeElement.querySelector("#outside") as HTMLButtonElement;
  const firstAction = () =>
    fixture.nativeElement.querySelector("#first-action") as HTMLButtonElement;
  const closeBtn = () =>
    fixture.nativeElement.querySelector(
      'button[bitBulkAction][icon="bwi-clear"]',
    ) as HTMLButtonElement;
  const liveRegion = () => fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              selected: "selected",
              selectionCleared: "Selection cleared",
              clear: "Clear",
              clearSelection: "Clear selection",
              bulkActionsBar: "Bulk actions",
              bulkActionsBarAnnouncement:
                "__$1__ items selected. The bulk actions bar is now available at the bottom of the screen. Press __$2__+B to toggle focus to the bulk action bar.",
              close: "Close",
              loading: "Loading",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    // Attach to the DOM so focus assertions work. body needs tabindex="-1"
    // so the component's fallback `document.body.focus()` actually lands
    // there in jsdom.
    document.body.setAttribute("tabindex", "-1");
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    if (fixture.nativeElement.parentNode) {
      fixture.nativeElement.parentNode.removeChild(fixture.nativeElement);
    }
    document.body.removeAttribute("tabindex");
  });

  it("is hidden when selectedCount is 0", () => {
    expect(host.bar().selectedCount()).toBe(0);
    const bar = innerBar();
    expect(bar.getAttribute("inert")).toBe("");
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(liveRegion().textContent?.trim()).toBe("Selection cleared");
  });

  it("is visible when selectedCount > 0", () => {
    host.count.set(3);
    fixture.detectChanges();

    const bar = innerBar();
    expect(bar.getAttribute("inert")).toBeNull();
    expect(bar.getAttribute("aria-hidden")).toBeNull();
    expect(bar.textContent?.replace(/\s+/g, " ").trim()).toContain("3 selected");
    expect(liveRegion().textContent?.trim()).toBe(
      "3 items selected. The bulk actions bar is now available at the bottom of the screen. Press Ctrl+B to toggle focus to the bulk action bar.",
    );
  });

  it("renders the clear button regardless of (clear) binding", () => {
    expect(closeBtn()).toBeTruthy();
  });

  it("emits (clear) on close-button click", () => {
    host.count.set(2);
    fixture.detectChanges();
    closeBtn().click();
    expect(host.cleared()).toBe(1);
  });

  describe("focus shortcut", () => {
    beforeEach(() => {
      host.count.set(2);
      fixture.detectChanges();
    });

    it("moves focus into the bar on Alt+B from outside", () => {
      outside().focus();
      expect(document.activeElement).toBe(outside());

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();

      expect(document.activeElement).toBe(closeBtn());
    });

    it("toggles focus back to the previously-focused element on second Alt+B", () => {
      outside().focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(closeBtn());

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(outside());
    });

    it("falls back to document.body if the previously-focused element was removed", () => {
      const tmp = document.createElement("button");
      tmp.id = "tmp";
      document.body.appendChild(tmp);
      tmp.focus();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(closeBtn());

      tmp.remove();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(document.body);
    });

    it("does nothing while the bar is hidden", () => {
      host.count.set(0);
      fixture.detectChanges();
      outside().focus();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();

      expect(document.activeElement).toBe(outside());
    });

    it("accepts metaKey (Mac Cmd) as the modifier under cmdOrCtrl", () => {
      outside().focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(closeBtn());
    });

    it("ignores plain B with no modifier", () => {
      outside().focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b" }));
      fixture.detectChanges();
      expect(document.activeElement).toBe(outside());
    });

    it("ignores B when both Cmd and Ctrl are held (avoids accidental triggers)", () => {
      outside().focus();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true, metaKey: true }),
      );
      fixture.detectChanges();
      expect(document.activeElement).toBe(outside());
    });

    it("ArrowRight moves focus to the next toolbar item", () => {
      closeBtn().focus();
      closeBtn().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true }),
      );
      fixture.detectChanges();
      expect((document.activeElement as HTMLElement).id).toBe("first-action");
    });

    it("ArrowLeft wraps from the first item (close button) to the last", () => {
      closeBtn().focus();
      closeBtn().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37, bubbles: true }),
      );
      fixture.detectChanges();
      expect((document.activeElement as HTMLElement).id).toBe("second-action");
    });

    it("Home jumps to the first item (close button) from anywhere in the toolbar", () => {
      firstAction().focus();
      firstAction().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", keyCode: 36, bubbles: true }),
      );
      fixture.detectChanges();
      expect(document.activeElement).toBe(closeBtn());
    });

    it("End jumps to the last item from anywhere", () => {
      closeBtn().focus();
      closeBtn().dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", keyCode: 35, bubbles: true }),
      );
      fixture.detectChanges();
      expect((document.activeElement as HTMLElement).id).toBe("second-action");
    });

    it("does not react to plain Escape", fakeAsync(() => {
      outside().focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();
      tick();

      const before = document.activeElement;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      fixture.detectChanges();
      tick();

      expect(document.activeElement).toBe(before);
      expect(host.cleared()).toBe(0);
    }));
  });
});
