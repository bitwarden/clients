import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollapseOnScrollDirective, I18nMockService } from "@bitwarden/components";

import { PopupPageComponent } from "./popup-page.component";

@Component({
  template: `
    <popup-page [loading]="loading()" [collapseAboveScrollArea]="collapse()">
      <span slot="above-scroll-area" data-testid="above-scroll-area">Search</span>
      <span data-testid="content">Page content</span>
      @if (showFloatingAction()) {
        <button slot="floating-action" type="button" data-testid="floating-action">Add</button>
      }
    </popup-page>
  `,
  imports: [PopupPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly loading = signal(false);
  readonly showFloatingAction = signal(true);
  readonly collapse = signal(true);
}

describe("PopupPageComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  const scrollRegion = (): HTMLElement =>
    fixture.nativeElement.querySelector("[data-testid=popup-layout-scroll-region]");
  /** The element `popup-page` hands to `bitCollapseOnScroll`, which publishes `data-state`. */
  const collapsingRegion = (): HTMLElement => fixture.nativeElement.querySelector("[data-state]");
  const floatingAction = (): HTMLElement | null =>
    fixture.nativeElement.querySelector("[data-testid=floating-action]");
  /** The positioning wrapper `popup-page` puts around the projected action. */
  const floatingActionWrapper = (): HTMLElement =>
    floatingAction()!.closest(".tw-absolute") as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ loading: "Loading" }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("above-scroll-area", () => {
    it("hands the region to the collapse directive when opted in", () => {
      // Expanded until something scrolls; the directive owns the collapse itself.
      expect(collapsingRegion().dataset.state).toBe("expanded");
    });

    it("forwards the opt-out to the collapse directive", () => {
      host.collapse.set(false);
      fixture.detectChanges();

      const directive = fixture.debugElement
        .query(By.directive(CollapseOnScrollDirective))
        .injector.get(CollapseOnScrollDirective);

      expect(directive.bitCollapseOnScroll()).toBe(false);
    });

    it("keeps the projected content inside the collapsing row", () => {
      const content = fixture.nativeElement.querySelector("[data-testid=above-scroll-area]");

      expect(collapsingRegion().contains(content)).toBe(true);
    });
  });

  it("projects content into the floating action slot", () => {
    expect(floatingAction()).not.toBeNull();
  });

  /**
   * The action is visually pinned to the bottom of the page, but rendering it last would force
   * keyboard and screen reader users through every row of the list to reach it.
   */
  it("renders the floating action before the scroll region in tab order", () => {
    const position = floatingAction()!.compareDocumentPosition(scrollRegion());

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /**
   * The scroll region's extra bottom padding is applied by a `:has()` rule on the wrapper rather than
   * a class binding, because whether the slot received content is not reactively observable. Asserting
   * the selector matches is what proves the rule fires — jsdom computes no layout.
   */
  it("pads the scroll region so the floating action does not occlude the last row", () => {
    const wrapper = floatingActionWrapper();

    expect(wrapper.classList).toContain("[&:has([slot=floating-action])~div]:!tw-pb-20");
    expect(wrapper.matches(":has([slot=floating-action])")).toBe(true);
    expect(wrapper.nextElementSibling).toBe(scrollRegion());

    host.showFloatingAction.set(false);
    fixture.detectChanges();

    expect(wrapper.matches(":has([slot=floating-action])")).toBe(false);
  });

  /** The loading spinner carries no z-index, so the action has to step aside for it. */
  it("hides the floating action while loading", () => {
    expect(floatingActionWrapper().classList).not.toContain("tw-invisible");

    host.loading.set(true);
    fixture.detectChanges();

    expect(floatingActionWrapper().classList).toContain("tw-invisible");
  });
});
