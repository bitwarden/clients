import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RotationLoadErrorComponent } from "./rotation-load-error.component";

describe("RotationLoadErrorComponent", () => {
  let fixture: ComponentFixture<RotationLoadErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotationLoadErrorComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: { t: (id: string) => id } }],
    }).compileComponents();

    fixture = TestBed.createComponent(RotationLoadErrorComponent);
    fixture.detectChanges();
  });

  function retryButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      "#rotation-load-error_button_retry",
    ) as HTMLButtonElement;
  }

  it("renders the failure copy as an alert", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute("role")).toBe("alert");
    expect(el.textContent).toContain("pamRotationListLoadErrorTitle");
    expect(el.textContent).toContain("pamRotationListLoadErrorDescription");
  });

  it("emits retry when the button is clicked", () => {
    const spy = jest.fn();
    fixture.componentInstance.retry.subscribe(spy);

    retryButton().click();

    expect(spy).toHaveBeenCalled();
  });

  it("leaves focus alone on the first read's failure", () => {
    expect(document.activeElement).not.toBe(retryButton());
  });

  it("takes focus when it is the answer to a retry", () => {
    const retried = TestBed.createComponent(RotationLoadErrorComponent);
    retried.componentRef.setInput("focusRetry", true);
    retried.detectChanges();

    expect(document.activeElement).toBe(
      retried.nativeElement.querySelector("#rotation-load-error_button_retry"),
    );
  });
});
