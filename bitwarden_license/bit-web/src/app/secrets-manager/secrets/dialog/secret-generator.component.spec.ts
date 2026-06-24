import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ToastService } from "@bitwarden/components";
import { GeneratorClient, PasswordManagerClient } from "@bitwarden/sdk-internal";

import { SecretGeneratorComponent } from "./secret-generator.component";

describe("SecretGeneratorComponent", () => {
  let component: SecretGeneratorComponent;
  let fixture: ComponentFixture<SecretGeneratorComponent>;
  let generator: MockProxy<GeneratorClient>;
  let toastService: MockProxy<ToastService>;

  beforeEach(async () => {
    generator = mock<GeneratorClient>();
    generator.password.mockReturnValue("generated-password");

    const client = mock<PasswordManagerClient>();
    client.generator.mockReturnValue(generator);

    const sdkService = mock<SdkService>();
    // BehaviorSubject, not of(client): the mock client auto-stubs Symbol.observable, which
    // makes of() treat it as an observable-input and subscribe into it instead of emitting it.
    sdkService.client$ = new BehaviorSubject(client).asObservable();

    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, SecretGeneratorComponent],
      providers: [
        { provide: SdkService, useValue: sdkService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecretGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("exposes the configured length boundaries", () => {
    expect(component["lengthMin"]).toBe(5);
    expect(component["lengthMax"]).toBe(128);
  });

  it("generates via the SDK with the mapped request", async () => {
    component["settingsForm"].patchValue({ length: 20, special: true });

    await component["generate"]();

    expect(generator.password).toHaveBeenCalledWith(
      expect.objectContaining({
        length: 20,
        lowercase: true,
        uppercase: true,
        numbers: true,
        special: true,
        avoidAmbiguous: false,
        minSpecial: 1,
      }),
    );
    expect(component["preview"]()).toBe("generated-password");
  });

  it("emits the generated value only on Use value", async () => {
    const emitted: string[] = [];
    component.valueGenerated.subscribe((v) => emitted.push(v));

    await component["generate"]();
    expect(emitted).toEqual([]);

    component["useValue"]();

    expect(emitted).toEqual(["generated-password"]);
  });

  it("shows an error toast and leaves the preview empty when generation fails", async () => {
    generator.password.mockImplementation(() => {
      throw new Error("sdk failure");
    });

    await component["generate"]();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
    expect(component["preview"]()).toBe("");
  });

  it("disables generation when no character set is selected", () => {
    component["settingsForm"].patchValue({
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    });

    expect(component["canGenerate"]).toBe(false);
  });

  it("opens the panel and generates a preview when toggled", async () => {
    expect(component["isOpen"]()).toBe(false);

    component["toggle"]();
    // Flush the microtasks from toggle()'s fire-and-forget generate().
    await new Promise((resolve) => setTimeout(resolve));

    expect(component["isOpen"]()).toBe(true);
    expect(component["preview"]()).toBe("generated-password");
  });

  it("closes the panel when toggled while open", async () => {
    component["toggle"]();
    await fixture.whenStable();
    expect(component["isOpen"]()).toBe(true);

    component["toggle"]();
    expect(component["isOpen"]()).toBe(false);
  });
});
