import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SelectComponent } from "../select/select.component";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleGroupModule } from "./toggle-group.module";
import { ToggleComponent } from "./toggle.component";

describe("Button", () => {
  let fixture: ComponentFixture<TestAppComponent>;
  let testAppComponent: TestAppComponent;
  let buttonElements: ToggleComponent<unknown>[];
  let radioButtons: HTMLInputElement[];

  beforeAll(() => {
    // jsdom does not implement ResizeObserver, which `ToggleGroupComponent`'s
    // responsive width measurement relies on. A no-op stub is enough here:
    // the tests don't exercise the observer, they only force `displayMode`
    // directly.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestAppComponent],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestAppComponent);
    testAppComponent = fixture.debugElement.componentInstance;

    fixture.detectChanges();

    buttonElements = fixture.debugElement
      .queryAll(By.css("bit-toggle"))
      .map((e) => e.componentInstance);
    radioButtons = fixture.debugElement
      .queryAll(By.css("input[type=radio]"))
      .map((e) => e.nativeElement);
  });

  it("auto-selects the first toggle when selected is undefined", () => {
    expect(testAppComponent.selected()).toBe("first");
    expect(buttonElements[0].selected()).toBe(true);
  });

  it("hides the active-pill indicator and clamps --active-toggle to 0 when selected does not match any toggle", () => {
    testAppComponent.selected.set("nope");
    fixture.detectChanges();

    const host = fixture.debugElement.query(By.css("bit-toggle-group"))
      .nativeElement as HTMLElement;
    expect(host.classList.contains("after:tw-opacity-0")).toBe(true);
    expect(host.classList.contains("after:tw-opacity-100")).toBe(false);
    expect(host.style.getPropertyValue("--active-toggle")).toBe("0");
  });

  it("should select second element when setting selected to second", () => {
    testAppComponent.selected.set("second");
    fixture.detectChanges();

    expect(buttonElements[1].selected()).toBe(true);
  });

  it("should not select second element when setting selected to third", () => {
    testAppComponent.selected.set("third");
    fixture.detectChanges();

    expect(buttonElements[1].selected()).toBe(false);
  });

  it("should emit new value when changing selection by clicking on radio button", () => {
    testAppComponent.selected.set("first");
    fixture.detectChanges();

    radioButtons[1].click();

    expect(testAppComponent.selected()).toBe("second");
  });

  describe("label", () => {
    it("does not render aria-label on the host when no label input is provided", () => {
      const host = fixture.debugElement.query(By.css("bit-toggle-group")).nativeElement;
      expect(host.getAttribute("role")).toBe("radiogroup");
      expect(host.getAttribute("aria-label")).toBeNull();
    });

    it("renders the label as aria-label on the host while in radiogroup mode", () => {
      testAppComponent.label.set("Test filter");
      fixture.detectChanges();

      const host = fixture.debugElement.query(By.css("bit-toggle-group")).nativeElement;
      expect(host.getAttribute("role")).toBe("radiogroup");
      expect(host.getAttribute("aria-label")).toBe("Test filter");
    });

    it("strips host aria-label/role and renders an sr-only <label for> in dropdown mode", () => {
      testAppComponent.label.set("Test filter");
      fixture.detectChanges();

      const group = fixture.debugElement.query(By.directive(ToggleGroupComponent));
      group.componentInstance.displayMode.set("dropdown");
      fixture.detectChanges();

      const host = group.nativeElement;
      expect(host.getAttribute("role")).toBeNull();
      expect(host.getAttribute("aria-label")).toBeNull();

      const srLabel = fixture.debugElement.query(By.css("label.tw-sr-only"));
      expect(srLabel).not.toBeNull();
      expect(srLabel.nativeElement.textContent.trim()).toBe("Test filter");

      const select = fixture.debugElement.query(By.directive(SelectComponent))
        .componentInstance as SelectComponent<unknown>;
      expect(srLabel.nativeElement.getAttribute("for")).toBe(select.labelForId());
    });

    it("renders no sr-only label in dropdown mode when no label input is provided", () => {
      const group = fixture.debugElement.query(By.directive(ToggleGroupComponent));
      group.componentInstance.displayMode.set("dropdown");
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("label.tw-sr-only"))).toBeNull();
    });
  });

  describe("responsive measurement", () => {
    // Stub the host's getBoundingClientRect so we can simulate a natural width
    // wider than the container in jsdom. The component briefly sets
    // `max-width: none` alongside `width: max-content` to measure unconstrained
    // width; jsdom drops the `max-content` value but retains `max-width: none`,
    // so we branch on that to return either the natural or current width.
    function stubHostRect(host: HTMLElement, naturalWidth: number, currentWidth: number) {
      jest.spyOn(host, "getBoundingClientRect").mockImplementation(() => {
        const width = host.style.maxWidth === "none" ? naturalWidth : currentWidth;
        return {
          width,
          height: 40,
          top: 0,
          left: 0,
          right: width,
          bottom: 40,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
    }

    it("re-measures naturalWidth after toggles render via async pipe and switches to dropdown when they overflow", async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [AsyncTogglesTestComponent],
        providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
      });
      await TestBed.compileComponents();

      const asyncFixture = TestBed.createComponent(AsyncTogglesTestComponent);
      asyncFixture.detectChanges();

      const groupDebug = asyncFixture.debugElement.query(By.directive(ToggleGroupComponent));
      const groupHost = groupDebug.nativeElement as HTMLElement;
      const group = groupDebug.componentInstance as ToggleGroupComponent<string>;

      // Natural content width (800) exceeds container (400) → should collapse to dropdown.
      stubHostRect(groupHost, 800, 400);

      // No toggles projected yet → effect short-circuits, mode stays "inline".
      expect(group.displayMode()).toBe("inline");

      asyncFixture.componentInstance.setOptions([
        { value: "a", label: "First" },
        { value: "b", label: "Second" },
        { value: "c", label: "Third" },
      ]);
      asyncFixture.detectChanges();
      await asyncFixture.whenStable();
      asyncFixture.detectChanges();

      expect(group.displayMode()).toBe("dropdown");
    });

    it("re-measures when the toggle count changes at runtime", async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [AsyncTogglesTestComponent],
        providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
      });
      await TestBed.compileComponents();

      const asyncFixture = TestBed.createComponent(AsyncTogglesTestComponent);
      asyncFixture.detectChanges();

      const groupDebug = asyncFixture.debugElement.query(By.directive(ToggleGroupComponent));
      const groupHost = groupDebug.nativeElement as HTMLElement;
      const group = groupDebug.componentInstance as ToggleGroupComponent<string>;

      // First: two toggles fit (natural 300 ≤ container 400).
      stubHostRect(groupHost, 300, 400);
      asyncFixture.componentInstance.setOptions([
        { value: "a", label: "First" },
        { value: "b", label: "Second" },
      ]);
      asyncFixture.detectChanges();
      await asyncFixture.whenStable();
      asyncFixture.detectChanges();

      expect(group.displayMode()).toBe("inline");

      // Now five toggles overflow (natural 900 > container 400). A naive
      // implementation that captured naturalWidth once would still report
      // inline; the fix re-measures on toggle-count change.
      stubHostRect(groupHost, 900, 400);
      asyncFixture.componentInstance.setOptions([
        { value: "a", label: "First" },
        { value: "b", label: "Second" },
        { value: "c", label: "Third" },
        { value: "d", label: "Fourth" },
        { value: "e", label: "Fifth" },
      ]);
      asyncFixture.detectChanges();
      await asyncFixture.whenStable();
      asyncFixture.detectChanges();

      expect(group.displayMode()).toBe("dropdown");
    });
  });
});

@Component({
  selector: "async-toggles-test",
  template: `
    <bit-toggle-group [(selected)]="selected">
      @for (option of options$ | async; track option.value) {
        <bit-toggle [value]="option.value">{{ option.label }}</bit-toggle>
      }
    </bit-toggle-group>
  `,
  imports: [AsyncPipe, ToggleGroupModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class AsyncTogglesTestComponent {
  readonly selected: WritableSignal<string | undefined> = signal(undefined);
  private readonly _options$ = new BehaviorSubject<{ value: string; label: string }[]>([]);
  readonly options$ = this._options$.asObservable();

  setOptions(options: { value: string; label: string }[]) {
    this._options$.next(options);
  }
}

@Component({
  selector: "test-app",
  template: `
    <bit-toggle-group [(selected)]="selected" [label]="label()">
      <bit-toggle value="first">First</bit-toggle>
      <bit-toggle value="second">Second</bit-toggle>
      <bit-toggle value="third">Third</bit-toggle>
    </bit-toggle-group>
  `,
  imports: [ToggleGroupModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestAppComponent {
  readonly selected: WritableSignal<string | undefined> = signal(undefined);
  readonly label = signal<string | undefined>(undefined);
}
