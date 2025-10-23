import { Component, Input, Output, EventEmitter } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import {
  WebVaultGeneratorDialogAction,
  WebVaultGeneratorDialogComponent,
  WebVaultGeneratorDialogResult,
} from "./web-generator-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-cipher-form-generator",
  template: "",
})
class MockCipherFormGenerator {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() type: "password" | "username" = "password";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() algorithmSelected: EventEmitter<AlgorithmInfo> = new EventEmitter();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() uri?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() valueGenerated = new EventEmitter<string>();
}

describe("WebVaultGeneratorDialogComponent", () => {
  let component: WebVaultGeneratorDialogComponent;
  let fixture: ComponentFixture<WebVaultGeneratorDialogComponent>;
  let dialogRef: MockProxy<DialogRef<WebVaultGeneratorDialogResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    dialogRef = mock<DialogRef<WebVaultGeneratorDialogResult>>();
    mockI18nService = mock<I18nService>();

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, WebVaultGeneratorDialogComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { type: "password" } },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
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

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should enable button when value and algorithm are selected", () => {
    const generator = fixture.debugElement.query(
      By.css("vault-cipher-form-generator"),
    ).componentInstance;

    generator.algorithmSelected.emit({ useGeneratedValue: "Use Password" } as any);
    generator.valueGenerated.emit("test-password");
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css("[data-testid='select-button']"));
    expect(button.attributes["aria-disabled"]).toBe(undefined);
  });

  it("should disable the button if no value has been generated", () => {
    const generator = fixture.debugElement.query(
      By.css("vault-cipher-form-generator"),
    ).componentInstance;

    generator.algorithmSelected.emit({ useGeneratedValue: "Use Password" } as any);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css("[data-testid='select-button']"));
    expect(button.attributes["aria-disabled"]).toBe("true");
  });

  it("should disable the button if no algorithm is selected", () => {
    const generator = fixture.debugElement.query(
      By.css("vault-cipher-form-generator"),
    ).componentInstance;

    generator.valueGenerated.emit("test-password");
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css("[data-testid='select-button']"));
    expect(button.attributes["aria-disabled"]).toBe("true");
  });

  it("should close with selected value when confirmed", () => {
    const generator = fixture.debugElement.query(
      By.css("vault-cipher-form-generator"),
    ).componentInstance;
    generator.algorithmSelected.emit({ useGeneratedValue: "Use Password" } as any);
    generator.valueGenerated.emit("test-password");
    fixture.detectChanges();

    fixture.debugElement.query(By.css("[data-testid='select-button']")).nativeElement.click();

    expect(dialogRef.close).toHaveBeenCalledWith({
      action: WebVaultGeneratorDialogAction.Selected,
      generatedValue: "test-password",
    });
  });

  it("should close with canceled action when dismissed", () => {
    component["close"]();
    expect(dialogRef.close).toHaveBeenCalledWith({
      action: WebVaultGeneratorDialogAction.Canceled,
    });
  });
});
