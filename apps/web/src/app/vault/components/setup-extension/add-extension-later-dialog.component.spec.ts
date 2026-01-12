import { DialogRef } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA } from "@bitwarden/components";

import { AddExtensionLaterDialogComponent } from "./add-extension-later-dialog.component";

describe("AddExtensionLaterDialogComponent", () => {
  let fixture: ComponentFixture<AddExtensionLaterDialogComponent>;
  const getDevice = jest.fn().mockReturnValue(null);
  const onDismiss = jest.fn();

  beforeEach(async () => {
    onDismiss.mockClear();

    await TestBed.configureTestingModule({
      imports: [AddExtensionLaterDialogComponent, RouterModule.forRoot([])],
      providers: [
        provideNoopAnimations(),
        { provide: PlatformUtilsService, useValue: { getDevice } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogRef, useValue: { close: jest.fn() } },
        { provide: DIALOG_DATA, useValue: { onDismiss } },
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

  it('invokes `onDismiss` when "Skip to Web App" is clicked', () => {
    const skipLink = fixture.debugElement.queryAll(By.css("a[bitButton]"))[1];
    skipLink.triggerEventHandler("click", {});

    expect(onDismiss).toHaveBeenCalled();
  });
});
