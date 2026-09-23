import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { MenuModule, MenuTriggerForDirective } from "../menu";
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

const i18nMock = () =>
  new I18nMockService({
    search: "Search",
    resetSearch: "Reset search",
    clearSearchTooltip: "Clear search",
  });

describe("SearchComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let openDialogs: DialogRef[];
  let reachedDocument: jest.Mock;

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
    reachedDocument = jest.fn();
    document.addEventListener("keydown", reachedDocument);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: Dialog, useValue: { openDialogs } as unknown as Dialog },
        { provide: I18nService, useFactory: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.removeEventListener("keydown", reachedDocument);
  });

  const setText = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  // Dispatched on the input so it bubbles through the form handler, the way a real press does.
  const escape = async (init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      ...init,
    });
    input().dispatchEvent(event);
    // `ngModel` writes back through a microtask, so the DOM only catches up after settling.
    await fixture.whenStable();
    fixture.detectChanges();
    return event;
  };

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

  describe("Escape", () => {
    it("clears a field that has text", async () => {
      await setText("secrets");

      const event = await escape();

      expect(input().value).toBe("");
      expect(event.defaultPrevented).toBe(true);
    });

    it("clears regardless of the shortcuts opt-in", async () => {
      host.useKeyShortcuts.set(false);
      fixture.detectChanges();
      await setText("secrets");

      await escape();

      expect(input().value).toBe("");
    });

    it("stops propagating once it clears, so an enclosing overlay stays open", async () => {
      await setText("secrets");

      await escape();

      expect(reachedDocument).not.toHaveBeenCalled();
    });

    it("leaves an empty field alone and keeps propagating", async () => {
      const event = await escape();

      expect(event.defaultPrevented).toBe(false);
      expect(reachedDocument).toHaveBeenCalled();
    });

    it("is a noop for a modified Escape", async () => {
      await setText("secrets");

      const event = await escape({ shiftKey: true });

      expect(input().value).toBe("secrets");
      expect(event.defaultPrevented).toBe(false);
      expect(reachedDocument).toHaveBeenCalled();
    });
  });
});

// `bit-menu` with a dialog role closes on Escape (menu-trigger-for.directive.ts), so a search
// nested inside one must not let a clearing Escape through.
describe("SearchComponent inside a dialog-role menu", () => {
  @Component({
    imports: [MenuModule, SearchComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <button type="button" [bitMenuTriggerFor]="menu">Filter</button>
      <bit-menu #menu ariaRole="dialog"><bit-search /></bit-menu>
    `,
  })
  class MenuHostComponent {}

  let fixture: ComponentFixture<MenuHostComponent>;
  let consoleError: jest.SpyInstance;

  // Opening a CDK overlay makes JSDOM parse the library's stylesheets, which it cannot do.
  // Same suppression as menu.component.spec.ts.
  beforeAll(() => {
    // eslint-disable-next-line no-console
    const original = console.error;
    consoleError = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (args[0] instanceof Error && args[0].message.includes("Could not parse CSS stylesheet")) {
        return;
      }
      original(...args);
    });
  });

  afterAll(() => consoleError.mockRestore());

  const panel = () => document.querySelector(".bit-menu-panel");
  const input = () => document.querySelector(".bit-menu-panel input") as HTMLInputElement;

  const setText = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const escape = async () => {
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuHostComponent],
      providers: [
        { provide: Dialog, useValue: { openDialogs: [] } as unknown as Dialog },
        { provide: I18nService, useFactory: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuHostComponent);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.directive(MenuTriggerForDirective))
      .injector.get(MenuTriggerForDirective)
      .toggleMenu();
    fixture.detectChanges();
  });

  it("takes two presses: the first clears the field, the second closes the menu", async () => {
    await setText("secrets");

    await escape();

    expect(input().value).toBe("");
    expect(panel()).toBeTruthy();

    await escape();

    expect(panel()).toBeFalsy();
  });

  it("closes the menu on the first press when the field is empty", async () => {
    await escape();

    expect(panel()).toBeFalsy();
  });
});
