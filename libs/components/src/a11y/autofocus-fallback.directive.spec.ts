import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Injectable,
  NgZone,
  viewChild,
} from "@angular/core";
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from "@angular/core/testing";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { AutofocusFallbackDirective } from "./autofocus-fallback.directive";

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

@Component({
  template: `
    <div bitAutofocusFallback>
      <h1 tabindex="-1" #header>Dialog Title</h1>
    </div>
  `,
  imports: [AutofocusFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly header = viewChild.required<ElementRef<HTMLHeadingElement>>("header");
  readonly directive = viewChild.required(AutofocusFallbackDirective);
}

@Component({
  template: `
    <div bitAutofocusFallback>
      <h1 tabindex="-1" #header>Dialog Title</h1>
      <button type="button" bitAutofocus>Submit</button>
    </div>
  `,
  imports: [AutofocusFallbackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostWithAutofocusDescendantComponent {
  readonly header = viewChild.required<ElementRef<HTMLHeadingElement>>("header");
  readonly directive = viewChild.required(AutofocusFallbackDirective);
}

describe("AutofocusFallbackDirective", () => {
  let mockNgZone: MockNgZone;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: NgZone, useClass: MockNgZone }],
    });

    mockNgZone = TestBed.inject(NgZone) as MockNgZone;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function createAndSetFallback(
    fixture: ComponentFixture<TestHostComponent | TestHostWithAutofocusDescendantComponent>,
  ) {
    fixture.detectChanges();
    const headerRef = fixture.componentInstance.header();
    fixture.componentInstance.directive().bitAutofocusFallback.set(headerRef);
    return jest.spyOn(headerRef.nativeElement, "focus");
  }

  describe("when no fallback element is provided", () => {
    it("does not focus any element", fakeAsync(() => {
      const fixture = TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();
      const focusSpy = jest.spyOn(fixture.componentInstance.header().nativeElement, "focus");

      TestBed.tick();
      tick(0);

      expect(focusSpy).not.toHaveBeenCalled();
    }));
  });

  describe("when a fallback element is provided", () => {
    it("focuses the fallback element when no autofocus descendants are present", fakeAsync(() => {
      const fixture = TestBed.createComponent(TestHostComponent);
      const focusSpy = createAndSetFallback(fixture);

      TestBed.tick();
      tick(0);

      expect(focusSpy).toHaveBeenCalled();
    }));

    it("does not focus the fallback element when autofocus descendants are present", fakeAsync(() => {
      const fixture = TestBed.createComponent(TestHostWithAutofocusDescendantComponent);
      const focusSpy = createAndSetFallback(fixture);

      TestBed.tick();
      tick(0);

      expect(focusSpy).not.toHaveBeenCalled();
    }));
  });

  describe("on a mobile browser", () => {
    it("does not focus the fallback element", fakeAsync(() => {
      jest.replaceProperty(Utils, "isMobileBrowser", true);

      const fixture = TestBed.createComponent(TestHostComponent);
      const focusSpy = createAndSetFallback(fixture);

      TestBed.tick();
      tick(0);

      expect(focusSpy).not.toHaveBeenCalled();
    }));
  });

  describe("zone stability", () => {
    it("focuses the fallback element when the zone is already stable", fakeAsync(() => {
      mockNgZone.isStable = true;

      const fixture = TestBed.createComponent(TestHostComponent);
      const focusSpy = createAndSetFallback(fixture);

      TestBed.tick();
      tick(0);

      expect(focusSpy).toHaveBeenCalled();
    }));

    it("waits for the zone to stabilize before focusing", fakeAsync(() => {
      mockNgZone.isStable = false;

      const fixture = TestBed.createComponent(TestHostComponent);
      const focusSpy = createAndSetFallback(fixture);

      TestBed.tick();

      expect(focusSpy).not.toHaveBeenCalled();

      mockNgZone.onStable.emit(null);
      flushMicrotasks();
      tick(0);

      expect(focusSpy).toHaveBeenCalled();
    }));
  });
});
