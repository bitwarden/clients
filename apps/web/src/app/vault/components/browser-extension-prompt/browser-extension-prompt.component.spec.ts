import { ComponentFixture, TestBed } from "@angular/core/testing";
import mock from "jest-mock-extended/lib/Mock";

import { AnonLayoutWrapperDataService } from "@bitwarden/auth/angular";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BrowserExtensionPromptComponent } from "./browser-extension-prompt.component";

describe("BrowserExtensionPromptComponent", () => {
  let fixture: ComponentFixture<BrowserExtensionPromptComponent>;
  let component: BrowserExtensionPromptComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        {
          provide: AnonLayoutWrapperDataService,
          useValue: mock<AnonLayoutWrapperDataService>(),
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowserExtensionPromptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should have initial state as loading", () => {
    expect(component["pageState$"].value).toBe("loading");
  });
});
