import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { PopupFocusWrapDirective } from "./popup-focus-wrap.directive";

@Component({
  template: `
    <div appPopupFocusWrap>
      <button type="button" id="first">First</button>
      <button type="button" id="last">Last</button>
    </div>
  `,
  imports: [PopupFocusWrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {}

describe("PopupFocusWrapDirective", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let fixture: ComponentFixture<TestHostComponent>;

  /** The sentinels are the only elements the directive gives both of these attributes. */
  const sentinelSelector = '[aria-hidden="true"][tabindex="0"]';

  const host = () => fixture.nativeElement.querySelector("[appPopupFocusWrap]") as HTMLElement;
  const sentinels = () => Array.from(host().querySelectorAll<HTMLElement>(sentinelSelector));
  const button = (id: string) => host().querySelector<HTMLElement>(`#${id}`);

  function setup(isFirefox: boolean) {
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isFirefox.mockReturnValue(isFirefox);

    TestBed.configureTestingModule({
      providers: [{ provide: PlatformUtilsService, useValue: platformUtilsService }],
    });

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    /**
     * jsdom performs no layout, so `offsetParent` is always null. The directive filters on
     * it to skip hidden elements, which would otherwise leave nothing to wrap to.
     */
    for (const el of Array.from(host().querySelectorAll<HTMLElement>("button"))) {
      Object.defineProperty(el, "offsetParent", { get: () => el.parentElement });
    }
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe("on Firefox", () => {
    beforeEach(() => setup(true));

    it("inserts a sentinel at the start and end of the host", () => {
      const [start, end] = sentinels();

      expect(sentinels()).toHaveLength(2);
      expect(host().firstElementChild).toBe(start);
      expect(host().lastElementChild).toBe(end);
    });

    it("redirects focus on the start sentinel to the last focusable element", () => {
      sentinels()[0].dispatchEvent(new FocusEvent("focus"));

      expect(document.activeElement).toBe(button("last"));
    });

    it("redirects focus on the end sentinel to the first focusable element", () => {
      sentinels()[1].dispatchEvent(new FocusEvent("focus"));

      expect(document.activeElement).toBe(button("first"));
    });

    it("stops redirecting once destroyed", () => {
      const [start] = sentinels();
      const focusSpy = jest.spyOn(button("last"), "focus");
      fixture.destroy();

      start.dispatchEvent(new FocusEvent("focus"));

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe("on browsers other than Firefox", () => {
    beforeEach(() => setup(false));

    it("does not insert sentinels", () => {
      expect(sentinels()).toHaveLength(0);
    });

    it("leaves a focused element alone rather than redirecting to the last focusable element", () => {
      button("first").focus();

      expect(document.activeElement).toBe(button("first"));
    });
  });
});
