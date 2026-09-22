import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { SearchComponent } from "./search.component";

@Component({
  imports: [SearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<bit-search [useKeyShortcuts]="useKeyShortcuts()" [disabled]="disabled()" />`,
})
class HostComponent {
  readonly useKeyShortcuts = signal(true);
  readonly disabled = signal(false);
}

// Only `overlayRef.overlayElement` is read, and `mock<DialogRef>()` cannot supply it: its
// DeepPartial argument recurses into the DOM types and fails to typecheck.
const dialogOver = (overlayElement: HTMLElement) =>
  ({ overlayRef: { overlayElement } }) as unknown as DialogRef;

describe("SearchComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let openDialogs: DialogRef[];

  const input = () => fixture.nativeElement.querySelector("input") as HTMLInputElement;

  const keydown = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { ...init, cancelable: true });
    document.dispatchEvent(event);
    return event;
  };

  const expectFocused = (event: KeyboardEvent) => {
    expect(document.activeElement).toBe(input());
    expect(event.defaultPrevented).toBe(true);
  };

  const expectIgnored = (event: KeyboardEvent) => {
    expect(document.activeElement).not.toBe(input());
    expect(event.defaultPrevented).toBe(false);
  };

  beforeEach(async () => {
    openDialogs = [];

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: Dialog, useValue: { openDialogs } as unknown as Dialog },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              search: "Search",
              resetSearch: "Reset search",
              clearSearchTooltip: "Clear search",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("the ⌘/Ctrl+F shortcut", () => {
    it.each([{ metaKey: true }, { ctrlKey: true }])("focuses the input on %o", (modifier) => {
      const event = keydown({ key: "f", ...modifier });

      expectFocused(event);
    });

    it("is a noop without the shortcuts opt-in", () => {
      host.useKeyShortcuts.set(false);
      fixture.detectChanges();

      const event = keydown({ key: "f", metaKey: true });

      expectIgnored(event);
    });

    it("is a noop while disabled", () => {
      host.disabled.set(true);
      fixture.detectChanges();

      const event = keydown({ key: "f", metaKey: true });

      expectIgnored(event);
    });

    it("is a noop for an unmodified F", () => {
      const event = keydown({ key: "f" });

      expectIgnored(event);
    });

    it("is a noop for an ambiguous Cmd+Ctrl+F", () => {
      const event = keydown({ key: "f", metaKey: true, ctrlKey: true });

      expectIgnored(event);
    });
  });

  describe("with a dialog open", () => {
    it("is a noop for a search behind the dialog", () => {
      openDialogs.push(dialogOver(document.createElement("div")));

      const event = keydown({ key: "f", metaKey: true });

      expectIgnored(event);
    });

    it("still focuses a search inside the dialog", () => {
      openDialogs.push(dialogOver(document.body));

      const event = keydown({ key: "f", metaKey: true });

      expectFocused(event);
    });
  });
});
