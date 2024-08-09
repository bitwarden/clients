import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { I18nPartDirective } from "./i18n-part.directive";
import { I18nComponent } from "./i18n.component";

@Component({
  selector: "test",
  template: `
    <p [bit-i18n]="translationKey" [args]="args">
      <a *bit-i18n-part="let text" href="javascript:;">{{ text }}</a>
      <strong *bit-i18n-part="let text">{{ text }}</strong>
      <a
        *bit-i18n-part="let text"
        href="https://localization.blog/2022/05/16/i18n-best-practices-keep-it-together/"
      >
        <strong>{{ text }}</strong>
      </a>
    </p>
  `,
})
class TestComponent {
  translationKey: string;
  args: any[] = [];
}

describe("I18nComponent", () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  const mockLogService = mock<LogService>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestComponent],
      imports: [I18nComponent, I18nPartDirective],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              basicExample: () =>
                `This is an example with <0>link</0> tags and <1>bold</1> tags. The entire sentence can be <2>translated as a whole</2> and re-arranged according to each language's grammar rules.`,
              outOfOrder: () =>
                `This is another example with <1>bold</1> tags to show that tag order does not matter and the <0>link</0> tags are after.`,
              tooManyTags: () => `<0>First</0>, <1>Second</1>, <2>Third</2>, <3>Missing Fourth</3>`,
              argsExample: (arg1: string) =>
                `This is an example with <0>link</0> tags and ${arg1}.`,
            });
          },
        },
        {
          provide: LogService,
          useValue: mockLogService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
  });

  it("should render the basicExample translation with all templates rendered", () => {
    component.translationKey = "basicExample";
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("p").textContent).toContain(
      "This is an example with link tags and bold tags. The entire sentence can be translated as a whole and re-arranged according to each language's grammar rules",
    );
    expect(compiled.querySelector("a").textContent).toContain("link");
    expect(compiled.querySelector("strong").textContent).toContain("bold");
    expect(compiled.querySelector("a > strong").textContent).toContain("translated as a whole");
  });

  it("should render the outOfOrder translation with all templates rendered", () => {
    component.translationKey = "outOfOrder";
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("p").textContent).toContain(
      "This is another example with bold tags to show that tag order does not matter and the link tags are after",
    );
    expect(compiled.querySelector("a").textContent).toContain("link");
    expect(compiled.querySelector("strong").textContent).toContain("bold");
    expect(compiled.querySelector("a > strong")).toBeNull(); // 3rd tag is not present
    expect(compiled.querySelector("strong + a")).not.toBeNull(); // strong should come before a
  });

  it("should render the tooManyTags translation without extra identifiers", () => {
    component.translationKey = "tooManyTags";
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("p").textContent).toContain(
      "First, Second, Third, Missing Fourth",
    );

    expect(mockLogService.warning).toHaveBeenCalledWith(
      `The translation for "tooManyTags" has 4 template tag(s), but 3 bit-i18n-part directive(s) were found.`,
    );

    expect(compiled.querySelector("a").textContent).toContain("First");
    expect(compiled.querySelector("strong").textContent).toContain("Second");
    expect(compiled.querySelector("a > strong").textContent).toContain("Third");
  });

  it("should render the argsExample translation with the passed args", () => {
    component.translationKey = "argsExample";
    component.args = ["passed args"];
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("p").textContent).toContain(
      "This is an example with link tags and passed args.",
    );
    expect(compiled.querySelector("a").textContent).toContain("link");
  });
});
