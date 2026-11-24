import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef } from "@bitwarden/components";

import { HTTPAuthenticationWarningDialogComponent } from "./http-authentication-warning-dialog.component";

describe("HTTPAuthenticationWarningDialogComponent", () => {
  let fixture: ComponentFixture<HTTPAuthenticationWarningDialogComponent>;
  let dialogRef: MockProxy<DialogRef<boolean>>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  const click = (selector: string) => {
    (fixture.nativeElement.querySelector(selector) as HTMLElement).click();
  };

  beforeEach(async () => {
    dialogRef = mock<DialogRef<boolean>>();
    platformUtilsService = mock<PlatformUtilsService>();

    await TestBed.configureTestingModule({
      imports: [HTTPAuthenticationWarningDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HTTPAuthenticationWarningDialogComponent);
    fixture.detectChanges();
  });

  it("closes with true when the user turns the setting on", () => {
    click("#http-authentication-warning_button_turn-on");

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("closes with false when the user cancels", () => {
    click("#http-authentication-warning_button_cancel");

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it("opens the help article from the Learn more link", () => {
    click("#http-authentication-warning_link_learn-more");

    expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
      "https://bitwarden.com/help/basic-auth-autofill/",
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("labels the Learn more link as opening in a new tab", () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      "#http-authentication-warning_link_learn-more",
    );

    expect(link.getAttribute("aria-label")).toBe("fillLoginPopUpPromptsHelpArticleSignpost");
  });
});
