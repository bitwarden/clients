import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportInstructionsCalloutComponent } from "./import-instructions-callout.component";

describe("ImportInstructionsCalloutComponent", () => {
  let fixture: ComponentFixture<ImportInstructionsCalloutComponent>;
  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ImportInstructionsCalloutComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportInstructionsCalloutComponent);
    fixture.componentRef.setInput("vendorName", "1Password");
  });

  it("names the help site, not the help center, and links to it", () => {
    fixture.componentRef.setInput("instructionLink", "https://bitwarden.com/help/x");
    fixture.detectChanges();

    expect(text()).toContain("importHelpSiteInstructions");
    expect(text()).toContain("importHelpSiteLinkText");
    expect(text()).not.toContain("importHelpCenter");
    const link = fixture.nativeElement.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://bitwarden.com/help/x");
  });

  it("shows nothing when there is neither an instruction nor a link", () => {
    fixture.detectChanges();

    expect(text().trim()).toBe("");
  });
});
