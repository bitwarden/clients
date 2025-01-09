// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import {
  WebVaultGeneratorDialogAction,
  WebVaultGeneratorDialogComponent,
  WebVaultGeneratorDialogParams,
} from "./web-generator-dialog.component";

@Component({
  selector: "vault-cipher-form-generator",
  template: "",
  standalone: true,
})
class MockCipherFormGenerator {
  @Input() type: "password" | "username";
  @Output() valueGenerated = new EventEmitter<string>();
}

describe("WebVaultGeneratorDialogComponent", () => {
  let component: WebVaultGeneratorDialogComponent;
  let fixture: ComponentFixture<WebVaultGeneratorDialogComponent>;

  let dialogRef: MockProxy<DialogRef<any>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    dialogRef = mock<DialogRef<any>>();
    mockI18nService = mock<I18nService>();

    const mockDialogData: WebVaultGeneratorDialogParams = { type: "password" };

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, WebVaultGeneratorDialogComponent],
      providers: [
        {
          provide: DialogRef,
          useValue: dialogRef,
        },
        {
          provide: DIALOG_DATA,
          useValue: mockDialogData,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: PlatformUtilsService,
          useValue: mock<PlatformUtilsService>(),
        },
      ],
    })
      .overrideComponent(WebVaultGeneratorDialogComponent, {
        remove: { imports: [CipherFormGeneratorComponent] },
        add: { imports: [MockCipherFormGenerator] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(WebVaultGeneratorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("initializes without errors", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("closes the dialog with 'canceled' result when close is called", () => {
    const closeSpy = jest.spyOn(dialogRef, "close");

    (component as any).close();

    expect(closeSpy).toHaveBeenCalledWith({
      action: WebVaultGeneratorDialogAction.Canceled,
    });
  });

  it("closes the dialog with 'selected' result when selectValue is called", () => {
    const closeSpy = jest.spyOn(dialogRef, "close");
    const generatedValue = "generated-value";
    component.onValueGenerated(generatedValue);

    (component as any).selectValue();

    expect(closeSpy).toHaveBeenCalledWith({
      action: WebVaultGeneratorDialogAction.Selected,
      generatedValue: generatedValue,
    });
  });

  it("updates generatedValue when onValueGenerated is called", () => {
    const generatedValue = "new-generated-value";
    component.onValueGenerated(generatedValue);

    expect((component as any).generatedValue).toBe(generatedValue);
  });
});
