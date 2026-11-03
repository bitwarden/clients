import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportControlsKeeperWaitingComponent } from "./import-controls-keeper-waiting.component";

describe("ImportControlsKeeperWaitingComponent", () => {
  let fixture: ComponentFixture<ImportControlsKeeperWaitingComponent>;

  const status = () => fixture.nativeElement.querySelector("[role=status]") as HTMLElement;
  const paragraphs = () =>
    [...fixture.nativeElement.querySelectorAll("p")].map((p) => (p as HTMLElement).textContent);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportControlsKeeperWaitingComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportControlsKeeperWaitingComponent);
  });

  it("shows a spinner with the title and the body", () => {
    fixture.componentRef.setInput("titleKey", "keeperPushSent");
    fixture.componentRef.setInput("bodyKey", "keeperLoginPushSentDesc");
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("bit-spinner")).not.toBeNull();
    expect(paragraphs()).toEqual(["keeperPushSent", "keeperLoginPushSentDesc"]);
  });

  it("is a status region that can take focus, so the card can move focus onto it", () => {
    fixture.componentRef.setInput("titleKey", "keeperPushSent");
    fixture.detectChanges();

    expect(status().getAttribute("tabindex")).toBe("-1");
  });

  it("leaves out a title or body that isn't given", () => {
    fixture.componentRef.setInput("bodyKey", "keeperLoginPushSentDesc");
    fixture.detectChanges();

    expect(paragraphs()).toEqual(["keeperLoginPushSentDesc"]);
  });

  it("does not put a native title attribute on the host", () => {
    fixture.componentRef.setInput("titleKey", "keeperPushSent");
    fixture.detectChanges();

    expect(fixture.nativeElement.hasAttribute("title")).toBe(false);
  });
});
