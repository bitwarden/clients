import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AddExtensionLaterDialogComponent } from "./add-extension-later-dialog.component";

describe("AddExtensionLaterDialogComponent", () => {
  let fixture: ComponentFixture<AddExtensionLaterDialogComponent>;
  const getDevice = jest.fn().mockReturnValue(null);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddExtensionLaterDialogComponent, RouterModule.forRoot([])],
      providers: [
        provideNoopAnimations(),
        { provide: PlatformUtilsService, useValue: { getDevice } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddExtensionLaterDialogComponent);
    fixture.detectChanges();
  });

  it("renders the 'Get the Extension' link with correct href", () => {
    const link = fixture.debugElement.queryAll(By.css("a[bitButton]"))[0];

    expect(link.nativeElement.getAttribute("href")).toBe(
      "https://bitwarden.com/download/#downloads-web-browser",
    );
  });

  it("renders the 'Skip to Web App' link with correct routerLink", () => {
    const skipLink = fixture.debugElement.queryAll(By.css("a[bitButton]"))[1];

    expect(skipLink.attributes.href).toBe("/vault");
  });
});
