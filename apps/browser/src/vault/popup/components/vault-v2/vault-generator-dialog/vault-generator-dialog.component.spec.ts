import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { AlgorithmInfo } from "@bitwarden/generator-core";
import { CipherFormGeneratorComponent } from "@bitwarden/vault";

import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

import {
  GeneratorDialogAction,
  GeneratorDialogParams,
  GeneratorDialogResult,
  VaultGeneratorDialogComponent,
} from "./vault-generator-dialog.component";

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
  @Input() uri: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
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
    fixture.detectChanges();
  });

  it("should show password generator title", () => {
    const header = fixture.debugElement.query(By.css("popup-header")).componentInstance;
    expect(header.pageTitle).toBe("passwordGenerator");
  });

  it("should pass type to cipher form generator", () => {
    const generator = fixture.debugElement.query(
      By.css("vault-cipher-form-generator"),
    ).componentInstance;
    expect(generator.type).toBe("password");
  });

  it("should enable select button when value is generated", () => {
    component.onAlgorithmSelected({ useGeneratedValue: "Test" } as any);
    component.onValueGenerated("test-password");
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

  it("should update button text when algorithm is selected", () => {
    component.onAlgorithmSelected({ useGeneratedValue: "Use This Password" } as any);
    fixture.detectChanges();

    const button = fixture.debugElement.query(
      By.css("[data-testid='select-button']"),
    ).nativeElement;
    expect(button.textContent.trim()).toBe("Use This Password");
  });

  it("should close with generated value when selected", () => {
    component.onAlgorithmSelected({ useGeneratedValue: "Test" } as any);
    component.onValueGenerated("test-password");
    fixture.detectChanges();

    fixture.debugElement.query(By.css("[data-testid='select-button']")).nativeElement.click();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: GeneratorDialogAction.Selected,
      generatedValue: "test-password",
    });
  });

  it("should close with canceled action when dismissed", () => {
    fixture.debugElement.query(By.css("popup-header")).componentInstance.backAction();
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: GeneratorDialogAction.Canceled,
    });
  });
});
