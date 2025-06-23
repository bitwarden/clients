import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SetupExtensionComponent } from "./setup-extension.component";

describe("SetupExtensionComponent", () => {
  let fixture: ComponentFixture<SetupExtensionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupExtensionComponent);
    fixture.detectChanges();
  });

  it("initially shows the loading spinner", () => {
    const spinner = fixture.debugElement.query(By.css("i"));

    expect(spinner.nativeElement.title).toBe("loading");
  });
});
