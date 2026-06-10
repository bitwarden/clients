import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Injectable,
  NgZone,
} from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";

import { Utils } from "@bitwarden/common/platform/misc/utils";

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

@Component({
  template: `<input appAutofocus />`,
  imports: [AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {}

describe("AutofocusDirective", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: NgZone, useClass: MockNgZone }],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  function createFixture(): {
    fixture: ComponentFixture<TestHostComponent>;
    focusSpy: jest.SpyInstance;
  } {
    // Spy before the first change detection, since the directive focuses as soon as the element
    // becomes visible (in AfterContentChecked).
    const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return { fixture, focusSpy };
  }

  it("focuses the element when the window has focus", fakeAsync(() => {
    jest.spyOn(document, "hasFocus").mockReturnValue(true);

    const { focusSpy } = createFixture();

    TestBed.tick();
    tick(0);

    expect(focusSpy).toHaveBeenCalled();
  }));

  it("does not focus the element while the window is not focused", fakeAsync(() => {
    jest.spyOn(document, "hasFocus").mockReturnValue(false);

    const { focusSpy } = createFixture();

    TestBed.tick();
    tick(0);

    expect(focusSpy).not.toHaveBeenCalled();
  }));

  it("focuses the element once the window regains focus", fakeAsync(() => {
    const hasFocusSpy = jest.spyOn(document, "hasFocus").mockReturnValue(false);

    const { focusSpy } = createFixture();

    TestBed.tick();
    tick(0);

    expect(focusSpy).not.toHaveBeenCalled();

    // Simulate the user bringing the window back to the foreground.
    hasFocusSpy.mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    tick(0);

    expect(focusSpy).toHaveBeenCalled();
  }));

  it("does not focus a deferred element after the directive is destroyed", fakeAsync(() => {
    const hasFocusSpy = jest.spyOn(document, "hasFocus").mockReturnValue(false);

    const { fixture, focusSpy } = createFixture();

    TestBed.tick();
    tick(0);

    fixture.destroy();

    hasFocusSpy.mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    tick(0);

    expect(focusSpy).not.toHaveBeenCalled();
  }));

  it("does not focus the element on a mobile browser", fakeAsync(() => {
    jest.replaceProperty(Utils, "isMobileBrowser", true);
    jest.spyOn(document, "hasFocus").mockReturnValue(true);

    const { focusSpy } = createFixture();

    TestBed.tick();
    tick(0);

    expect(focusSpy).not.toHaveBeenCalled();
  }));
});
