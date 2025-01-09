import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

import {
  GeneratorDialogParams,
  GeneratorDialogResult,
  VaultGeneratorDialogComponent,
} from "./vault-generator-dialog.component";

@Component({
  selector: "vault-cipher-form-generator",
  template: "",
  standalone: true,
})
class MockCipherFormGenerator {
  @Input() type: "password" | "username";
  @Output() valueGenerated = new EventEmitter<string>();
}

describe("VaultGeneratorDialogComponent", () => {
  let component: VaultGeneratorDialogComponent;
  let fixture: ComponentFixture<VaultGeneratorDialogComponent>;
  let mockDialogRef: MockProxy<DialogRef<GeneratorDialogResult>>;
  let dialogData: GeneratorDialogParams;

  beforeEach(async () => {
    mockDialogRef = mock<DialogRef<GeneratorDialogResult>>();
    dialogData = { type: "password" };

    await TestBed.configureTestingModule({
      imports: [VaultGeneratorDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
      ],
    })
      .overrideComponent(VaultGeneratorDialogComponent, {
        remove: { imports: [CipherFormGeneratorComponent] },
        add: { imports: [MockCipherFormGenerator] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultGeneratorDialogComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("should use the appropriate text based on generator type", () => {
    expect(component["title"]).toBe("passwordGenerator");
    expect(component["selectButtonText"]).toBe("useThisPassword");

    dialogData.type = "username";

    fixture = TestBed.createComponent(VaultGeneratorDialogComponent);
    component = fixture.componentInstance;

    expect(component["title"]).toBe("usernameGenerator");
    expect(component["selectButtonText"]).toBe("useThisUsername");
  });

  it("should close the dialog with the generated value when the user selects it", () => {
    component["generatedValue"] = "generated-value";

    fixture.nativeElement.querySelector("button[data-testid='select-button']").click();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: "selected",
      generatedValue: "generated-value",
    });
  });
});
