import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { map, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { CredentialGeneratorService, GenerateRequest, Profile } from "@bitwarden/generator-core";

import { SecretGeneratorComponent } from "./secret-generator.component";

describe("SecretGeneratorComponent", () => {
  let component: SecretGeneratorComponent;
  let fixture: ComponentFixture<SecretGeneratorComponent>;
  let generatorService: MockProxy<CredentialGeneratorService>;
  let settingsNext: jest.Mock;

  beforeEach(async () => {
    generatorService = mock<CredentialGeneratorService>();
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    settingsNext = jest.fn();
    generatorService.settings.mockReturnValue({
      withConstraints$: of({
        state: { length: 14, uppercase: true, lowercase: true, number: true, special: false },
        constraints: { length: { min: 5, max: 128 } },
      }),
      next: settingsNext,
    } as any);

    generatorService.generate$.mockImplementation(({ on$ }: any) =>
      on$.pipe(
        map((req: GenerateRequest) => ({ credential: `gen-${req.algorithm}-${req.profile}` })),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, SecretGeneratorComponent],
      providers: [
        { provide: CredentialGeneratorService, useValue: generatorService },
        { provide: AccountService, useValue: accountService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
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

  it("seeds length boundaries from the generator constraints", () => {
    expect(component["lengthMin"]()).toBe(5);
    expect(component["lengthMax"]()).toBe(128);
  });

  it("scopes settings to the Secrets Manager profile, isolated from the account profile", () => {
    expect(generatorService.settings).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      Profile.secretsManager,
    );
  });

  it("emits the generated value only on Use value, generated under the Secrets Manager profile", async () => {
    const emitted: string[] = [];
    component.valueGenerated.subscribe((v) => emitted.push(v));

    await component["generate"]();
    expect(emitted).toEqual([]);

    component["useValue"]();

    expect(emitted).toEqual(["gen-password-secretsManager"]);
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
    await fixture.whenStable();

    expect(component["isOpen"]()).toBe(true);
    expect(component["preview"]()).toBe("gen-password-secretsManager");
  });

  it("closes the panel when toggled while open", async () => {
    component["toggle"]();
    await fixture.whenStable();
    expect(component["isOpen"]()).toBe(true);

    component["toggle"]();
    expect(component["isOpen"]()).toBe(false);
  });

  it("writes the updated settings back to the generator when the form changes", fakeAsync(() => {
    settingsNext.mockClear();

    component["settingsForm"].patchValue({ length: 20, special: true });
    tick(100);

    expect(settingsNext).toHaveBeenCalledWith(
      expect.objectContaining({ length: 20, special: true, minSpecial: 1 }),
    );
  }));
});
