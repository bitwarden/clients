import { Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ColorPasswordComponent } from "./color-password.component";

describe("ColorPasswordComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => (key === "passwordAnnounceSpace" ? "space" : key));

    await TestBed.configureTestingModule({
      imports: [ColorPasswordComponent, TestHostComponent],
      providers: [
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  function visibleSpans() {
    return fixture.debugElement.queryAll(By.css("span[data-password-character]"));
  }

  function accessibleSpan() {
    return fixture.debugElement.query(By.css("span[data-password-accessible]"));
  }

  it("marks every visible character span aria-hidden", () => {
    host.password.set("Abc1!");
    fixture.detectChanges();

    const spans = visibleSpans();
    expect(spans.length).toBe(5);
    for (const span of spans) {
      expect(span.attributes["aria-hidden"]).toBe("true");
    }
  });

  it("exposes the password as a single sr-only comma-separated string", () => {
    host.password.set("Abc1!");
    fixture.detectChanges();

    const accessible = accessibleSpan();
    expect(accessible).toBeTruthy();
    expect(accessible.nativeElement.classList).toContain("tw-sr-only");
    expect(accessible.nativeElement.textContent).toBe("A, b, c, 1, !");
  });

  it("treats a supplementary-plane emoji as a single accessible token", () => {
    // U+1F600 is a single code point that occupies two UTF-16 code units.
    // Array.from must keep it as one token so screen readers don't see surrogate halves.
    host.password.set("\u{1F600}A");
    fixture.detectChanges();

    expect(accessibleSpan().nativeElement.textContent).toBe("\u{1F600}, A");
  });

  it("substitutes the localized space token for literal spaces", () => {
    host.password.set("a b");
    fixture.detectChanges();

    expect(accessibleSpan().nativeElement.textContent).toBe("a, space, b");
  });

  it("renders an empty accessible span when the password is empty", () => {
    host.password.set("");
    fixture.detectChanges();

    expect(visibleSpans().length).toBe(0);
    expect(accessibleSpan().nativeElement.textContent).toBe("");
  });
});

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "test-host",
  template: `<bit-color-password [password]="password()"></bit-color-password>`,
  imports: [ColorPasswordComponent],
})
class TestHostComponent {
  readonly password = signal("");
}
