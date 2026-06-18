import { ComponentFixture, TestBed } from "@angular/core/testing";
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

  beforeEach(async () => {
    generatorService = mock<CredentialGeneratorService>();
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    generatorService.settings.mockReturnValue({
      withConstraints$: of({
        state: { length: 14, uppercase: true, lowercase: true, number: true, special: false },
        constraints: { length: { min: 5, max: 128 } },
      }),
      next: jest.fn(),
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
});
