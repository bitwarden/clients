import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { PopupPageComponent } from "./popup-page.component";

@Component({
  template: `
    <popup-page [loading]="loading()">
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
}

describe("PopupPageComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  const scrollRegion = (): HTMLElement =>
    fixture.nativeElement.querySelector("[data-testid=popup-layout-scroll-region]");
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

  /** The loading spinner carries no z-index, so the action has to step aside for it. */
  it("hides the floating action while loading", () => {
    expect(floatingActionWrapper().classList).not.toContain("tw-invisible");

    host.loading.set(true);
    fixture.detectChanges();

    expect(floatingActionWrapper().classList).toContain("tw-invisible");
  });
});
