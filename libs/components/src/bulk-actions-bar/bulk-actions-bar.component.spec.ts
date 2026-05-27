import { ChangeDetectionStrategy, Component, signal, viewChild } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BulkActionComponent } from "./bulk-action.component";
import { BulkActionsBarComponent } from "./bulk-actions-bar.component";
import { BulkAdditionalActionComponent } from "./bulk-additional-action.component";

// JSDOM does not implement ResizeObserver — provide a no-op stub so the
// component can construct without throwing.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

@Component({
  imports: [BulkActionsBarComponent, BulkActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="outside" type="button">Outside</button>
    <bit-bulk-actions-bar [selectedCount]="count()" (clear)="onClear()">
      <bit-bulk-action [action]="first" icon="bwi-folder" label="First" />
      <bit-bulk-action [action]="second" icon="bwi-trash" label="Second" />
    </bit-bulk-actions-bar>
  `,
})
class HostComponent {
  readonly count = signal(0);
  readonly cleared = signal(0);
  readonly firstClicks = signal(0);
  readonly secondClicks = signal(0);

  readonly bar = viewChild.required(BulkActionsBarComponent);

  readonly first = () => this.firstClicks.update((v) => v + 1);
  readonly second = () => this.secondClicks.update((v) => v + 1);

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
  const primaryButtons = (): HTMLButtonElement[] =>
    Array.from(
      innerBar().querySelectorAll<HTMLButtonElement>(
        'button[bitBulkActionButton]:not([icon="bwi-clear"]):not([icon="bwi-ellipsis-v"])',
      ),
    );
  const firstAction = () => primaryButtons()[0];
  const closeBtn = () =>
    fixture.nativeElement.querySelector(
      'button[bitBulkActionButton][icon="bwi-clear"]',
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
                "__$1__ items selected. The bulk actions bar is now available at the bottom of the screen. Press __$2__ to toggle focus to the bulk action bar.",
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

  it("renders one toolbar button per projected <bit-bulk-action>", () => {
    host.count.set(2);
    fixture.detectChanges();
    const buttons = primaryButtons();
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent?.trim()).toBe("First");
    expect(buttons[1].textContent?.trim()).toBe("Second");
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

  it("invokes the consumer-provided [action] callback when a primary button is clicked", () => {
    host.count.set(2);
    fixture.detectChanges();
    primaryButtons()[0].click();
    expect(host.firstClicks()).toBe(1);
    expect(host.secondClicks()).toBe(0);
    primaryButtons()[1].click();
    expect(host.secondClicks()).toBe(1);
  });

  describe("focus shortcut", () => {
    beforeEach(() => {
      host.count.set(2);
      fixture.detectChanges();
    });

    it("moves focus into the bar on Ctrl+B from outside", () => {
      outside().focus();
      expect(document.activeElement).toBe(outside());

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
      fixture.detectChanges();

      expect(document.activeElement).toBe(closeBtn());
    });

    it("toggles focus back to the previously-focused element on second Ctrl+B", () => {
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
      expect(document.activeElement).toBe(primaryButtons()[0]);
    });

    it("ArrowLeft wraps from the first item (close button) to the last", () => {
      closeBtn().focus();
      closeBtn().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37, bubbles: true }),
      );
      fixture.detectChanges();
      expect(document.activeElement).toBe(primaryButtons()[1]);
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
      expect(document.activeElement).toBe(primaryButtons()[1]);
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

  describe("modifier label", () => {
    beforeEach(() => {
      host.count.set(3);
      fixture.detectChanges();
    });

    it("seeds the announcement modifier from the navigator (JSDOM is non-Mac)", () => {
      expect(liveRegion().textContent).toContain("Ctrl+B");
    });

    it("self-corrects to Command after observing a metaKey-only keydown", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", metaKey: true }));
      fixture.detectChanges();
      expect(liveRegion().textContent).toContain("Command+B");
    });

    it("does not flip the label when both Cmd and Ctrl are held (ambiguous)", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true, metaKey: true }),
      );
      fixture.detectChanges();
      expect(liveRegion().textContent).toContain("Ctrl+B");
    });
  });

  describe("compact mode", () => {
    const labelSpan = (action: HTMLElement) =>
      action.querySelector("span") as HTMLSpanElement | null;

    beforeEach(() => {
      host.count.set(2);
      fixture.detectChanges();
    });

    it("defaults to non-compact with labels visible", () => {
      expect(host.bar().compact()).toBe(false);
      expect(labelSpan(firstAction())?.classList.contains("tw-hidden")).toBe(false);
      expect(labelSpan(firstAction())?.textContent?.trim()).toBe("First");
    });

    it("hides labels when compact is true", () => {
      host.bar().compact.set(true);
      fixture.detectChanges();
      expect(labelSpan(firstAction())?.classList.contains("tw-hidden")).toBe(true);
      expect(labelSpan(closeBtn())?.classList.contains("tw-hidden")).toBe(true);
    });

    it("restores labels when compact toggles back off", () => {
      host.bar().compact.set(true);
      fixture.detectChanges();
      host.bar().compact.set(false);
      fixture.detectChanges();
      expect(labelSpan(firstAction())?.classList.contains("tw-hidden")).toBe(false);
    });
  });
});

@Component({
  imports: [BulkActionsBarComponent, BulkActionComponent, BulkAdditionalActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-bulk-actions-bar [selectedCount]="count()">
      <bit-bulk-action [action]="first" icon="bwi-folder" label="First" />
      @if (showAdditional()) {
        <bit-bulk-additional-action [action]="onExport" icon="bwi-upload" label="Export" />
        <bit-bulk-additional-action [action]="onShare" label="Share" />
      }
    </bit-bulk-actions-bar>
  `,
})
class AdditionalActionsHostComponent {
  readonly count = signal(2);
  readonly showAdditional = signal(true);

  readonly bar = viewChild.required(BulkActionsBarComponent);

  readonly exportClicks = signal(0);
  readonly shareClicks = signal(0);

  readonly first = () => {};
  readonly onExport = () => this.exportClicks.update((v) => v + 1);
  readonly onShare = () => this.shareClicks.update((v) => v + 1);
}

describe("BulkActionsBarComponent — additional actions", () => {
  let fixture: ComponentFixture<AdditionalActionsHostComponent>;
  let host: AdditionalActionsHostComponent;

  const trigger = () =>
    fixture.nativeElement.querySelector(
      'button[bitBulkActionButton][icon="bwi-ellipsis-v"]',
    ) as HTMLButtonElement | null;

  const menuItems = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("button[bitMenuItem]"));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdditionalActionsHostComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              selected: "selected",
              selectionCleared: "Selection cleared",
              clear: "Clear",
              bulkActionsBar: "Bulk actions",
              bulkActionsBarAnnouncement: "__$1__ items selected. Press __$2__.",
              additionalActions: "Additional actions",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdditionalActionsHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    document.body.setAttribute("tabindex", "-1");
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    if (fixture.nativeElement.parentNode) {
      fixture.nativeElement.parentNode.removeChild(fixture.nativeElement);
    }
    document.body.removeAttribute("tabindex");
  });

  it("does not render the trigger when no <bit-bulk-additional-action> is projected", () => {
    host.showAdditional.set(false);
    fixture.detectChanges();
    expect(trigger()).toBeNull();
  });

  it("renders an ellipsis trigger when at least one additional action is projected", () => {
    const btn = trigger();
    expect(btn).not.toBeNull();
    expect(btn!.querySelector("bit-icon")).not.toBeNull();
  });

  it("requests the menu open above the trigger (anchored to the trigger's end edge)", () => {
    expect(trigger()!.getAttribute("menuPosition")).toBe("above-end");
  });

  it("keeps the trigger label hidden even when the bar is not compact", () => {
    expect(host.bar().compact()).toBe(false);
    const labelSpan = trigger()!.querySelector("span") as HTMLSpanElement;
    expect(labelSpan.classList.contains("tw-hidden")).toBe(true);
    expect(labelSpan.textContent?.trim()).toBe("Additional actions");
  });

  it("opens the menu when the trigger is clicked and renders one item per projected additional action", () => {
    const btn = trigger()!;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    const items = menuItems();
    expect(items.length).toBe(2);
    expect(items[0].textContent?.replace(/\s+/g, " ").trim()).toBe("Export");
    expect(items[1].textContent?.trim()).toBe("Share");
  });

  it("renders a leading icon only on additional actions that declare one", () => {
    trigger()!.click();
    fixture.detectChanges();
    const items = menuItems();
    expect(items[0].querySelector('bit-icon[slot="start"]')).not.toBeNull();
    expect(items[1].querySelector('bit-icon[slot="start"]')).toBeNull();
  });

  it("invokes the consumer-provided [action] callback when a menu item is clicked", () => {
    trigger()!.click();
    fixture.detectChanges();
    const items = menuItems();
    items[0].click();
    expect(host.exportClicks()).toBe(1);
    expect(host.shareClicks()).toBe(0);
    items[1].click();
    expect(host.shareClicks()).toBe(1);
  });

  it("includes the trigger in the toolbar's roving tabindex", () => {
    // `End` jumps to the last item in the FocusKeyManager — if the trigger
    // were missing from the items list, focus would land on the last
    // primary button instead.
    const closeBtn = fixture.nativeElement.querySelector(
      'button[icon="bwi-clear"]',
    ) as HTMLButtonElement;
    closeBtn.focus();
    closeBtn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", keyCode: 35, bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger());
  });

  it("rebuilds the toolbar's items when additional actions are toggled off after mount", () => {
    host.showAdditional.set(false);
    fixture.detectChanges();
    expect(trigger()).toBeNull();

    const closeBtn = fixture.nativeElement.querySelector(
      'button[icon="bwi-clear"]',
    ) as HTMLButtonElement;
    // After toggling additional actions off, the trigger is gone and the only
    // remaining bulk-action button without `icon="bwi-clear"` is the primary.
    const primary = fixture.nativeElement.querySelector(
      'button[bitBulkActionButton]:not([icon="bwi-clear"])',
    ) as HTMLButtonElement;

    closeBtn.focus();
    closeBtn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", keyCode: 35, bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(primary);
  });

  it("rebuilds the toolbar's items when additional actions are toggled on after mount", () => {
    host.showAdditional.set(false);
    fixture.detectChanges();
    host.showAdditional.set(true);
    fixture.detectChanges();
    expect(trigger()).not.toBeNull();

    const closeBtn = fixture.nativeElement.querySelector(
      'button[icon="bwi-clear"]',
    ) as HTMLButtonElement;
    closeBtn.focus();
    closeBtn.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", keyCode: 35, bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger());
  });
});
