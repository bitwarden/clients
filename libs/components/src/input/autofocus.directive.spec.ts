import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Injectable,
  NgZone,
  viewChild,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { FocusableElement } from "../shared/focusable-element";

import { AutofocusDirective } from "./autofocus.directive";

@Injectable()
class MockNgZone extends NgZone {
  override onStable: EventEmitter<any> = new EventEmitter(false);
  isStable = true;

  constructor() {
    super({ enableLongStackTrace: false });
  }

  override run(fn: any): any {
    return fn();
  }

  override runOutsideAngular(fn: any): any {
    return fn();
  }
}

/**
 * Deliberately not OnPush. The directive retries from `ngAfterContentChecked`, which only runs
 * when the host view is checked, so an OnPush host that never goes dirty gets a single attempt
 * and no retries. This mirrors `VaultSearchComponent`, which is also default change detection.
 */
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <input #target appAutofocus />
    <button type="button" #other>Other</button>
  `,
  imports: [AutofocusDirective],
})
class TestHostComponent {
  readonly target = viewChild.required<ElementRef<HTMLInputElement>>("target");
  readonly other = viewChild.required<ElementRef<HTMLButtonElement>>("other");
}

@Component({
  template: `<input #target appAutofocus="false" />`,
  imports: [AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostDisabledComponent {
  readonly target = viewChild.required<ElementRef<HTMLInputElement>>("target");
}

/** Stands in for `bit-search`, which routes autofocus to an inner input via `FocusableElement`. */
@Component({
  selector: "test-focusable",
  template: `<input #inner />`,
  providers: [{ provide: FocusableElement, useExisting: TestFocusableComponent }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestFocusableComponent implements FocusableElement {
  readonly inner = viewChild.required<ElementRef<HTMLInputElement>>("inner");

  getFocusTarget() {
    return this.inner().nativeElement;
  }
}

@Component({
  template: `<test-focusable appAutofocus></test-focusable>`,
  imports: [AutofocusDirective, TestFocusableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostFocusableComponent {
  readonly focusable = viewChild.required(TestFocusableComponent);
}

describe("AutofocusDirective", () => {
  let mockNgZone: MockNgZone;

  beforeEach(() => {
    /**
     * jsdom reports `document.hasFocus()` as false, which the directive treats as "focus is
     * not settled yet". Default to true so the common case behaves like a focused browser
     * window; the Safari popover cases below opt back out.
     */
    jest.spyOn(document, "hasFocus").mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [{ provide: NgZone, useClass: MockNgZone }],
    });

    mockNgZone = TestBed.inject(NgZone) as MockNgZone;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function createHost() {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return fixture;
  }

  const targetOf = (fixture: ComponentFixture<TestHostComponent>) =>
    fixture.componentInstance.target().nativeElement;

  describe("when the document owns focus", () => {
    it("focuses the element", () => {
      const fixture = createHost();

      expect(document.activeElement).toBe(targetOf(fixture));
    });

    it("does not focus again once the focus has settled", () => {
      const fixture = createHost();
      const focusSpy = jest.spyOn(targetOf(fixture), "focus");

      fixture.componentInstance.other().nativeElement.focus();
      fixture.detectChanges();

      expect(focusSpy).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(fixture.componentInstance.other().nativeElement);
    });

    it("routes focus through FocusableElement when the host provides one", () => {
      const fixture = TestBed.createComponent(TestHostFocusableComponent);
      fixture.detectChanges();

      expect(document.activeElement).toBe(
        fixture.componentInstance.focusable().inner().nativeElement,
      );
    });
  });

  /**
   * Safari's extension popover gives its web view keyboard focus after the page has loaded,
   * and assigns initial focus to the first focusable element — discarding anything focused
   * before that. The directive must not treat a pre-handoff focus as settled.
   */
  describe("when the document does not own focus yet", () => {
    beforeEach(() => {
      jest.spyOn(document, "hasFocus").mockReturnValue(false);
    });

    it("still focuses the element", () => {
      const fixture = createHost();

      expect(document.activeElement).toBe(targetOf(fixture));
    });

    it("re-asserts focus after the browser moves it elsewhere", () => {
      const fixture = createHost();

      fixture.componentInstance.other().nativeElement.focus();
      expect(document.activeElement).not.toBe(targetOf(fixture));

      fixture.detectChanges();

      expect(document.activeElement).toBe(targetOf(fixture));
    });

    it("does not re-focus while it already holds focus", () => {
      const fixture = createHost();
      const focusSpy = jest.spyOn(targetOf(fixture), "focus");

      fixture.detectChanges();

      expect(focusSpy).not.toHaveBeenCalled();
    });

    it("settles once the document gains focus", () => {
      const fixture = createHost();

      jest.spyOn(document, "hasFocus").mockReturnValue(true);
      fixture.detectChanges();

      const focusSpy = jest.spyOn(targetOf(fixture), "focus");
      fixture.componentInstance.other().nativeElement.focus();
      fixture.detectChanges();

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe("when autofocus is disabled", () => {
    it("does not focus the element", () => {
      const fixture = TestBed.createComponent(TestHostDisabledComponent);
      const focusSpy = jest.spyOn(fixture.componentInstance.target().nativeElement, "focus");

      fixture.detectChanges();

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe("on a mobile browser", () => {
    it("does not focus the element", () => {
      jest.replaceProperty(Utils, "isMobileBrowser", true);

      const fixture = TestBed.createComponent(TestHostComponent);
      const focusSpy = jest.spyOn(fixture.componentInstance.target().nativeElement, "focus");

      fixture.detectChanges();

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe("zone stability", () => {
    it("waits for the zone to stabilize before focusing", () => {
      mockNgZone.isStable = false;

      const fixture = createHost();

      expect(document.activeElement).not.toBe(targetOf(fixture));

      mockNgZone.onStable.emit(null);

      expect(document.activeElement).toBe(targetOf(fixture));
    });
  });
});
