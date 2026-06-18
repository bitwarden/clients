import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ReplaySubject, Subject, debounceTime, first, firstValueFrom, skip } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  CheckboxModule,
  ColorPasswordModule,
  FormFieldModule,
} from "@bitwarden/components";
import {
  Algorithm,
  BuiltIn,
  CredentialGeneratorService,
  GenerateRequest,
  PasswordGenerationOptions,
  Profile,
} from "@bitwarden/generator-core";
import { I18nPipe } from "@bitwarden/ui-common";

const SETTINGS_WAIT_MS = 100;

@Component({
  selector: "sm-secret-generator",
  templateUrl: "./secret-generator.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    CheckboxModule,
    ColorPasswordModule,
    I18nPipe,
  ],
})
export class SecretGeneratorComponent implements OnInit {
  readonly valueGenerated = output<string>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly generatorService = inject(CredentialGeneratorService);
  private readonly accountService = inject(AccountService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly settingsForm = this.formBuilder.group({
    length: [14],
    uppercase: [true],
    lowercase: [true],
    number: [true],
    special: [false],
    avoidAmbiguous: [false],
  });

  protected readonly lengthMin = signal(5);
  protected readonly lengthMax = signal(128);
  protected readonly isOpen = signal(false);
  protected readonly preview = signal("");
  protected readonly generating = signal(false);
  protected readonly ready = signal(false);

  private readonly account$ = new ReplaySubject<Account>(1);

  protected get canGenerate(): boolean {
    const { uppercase, lowercase, number, special } = this.settingsForm.value;
    return !!(uppercase || lowercase || number || special);
  }

  async ngOnInit() {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account == null) {
      this.logService.error("Secret generator: no active account; generator disabled.");
      return;
    }
    this.account$.next(account);

    const settings = this.generatorService.settings(
      BuiltIn.password,
      { account$: this.account$ },
      Profile.secretsManager,
    );

    let latestSettings: PasswordGenerationOptions = {};

    // { emitEvent: false } prevents a valueChanges → settings loop.
    settings.withConstraints$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ state, constraints }) => {
        latestSettings = { ...state };
        this.lengthMin.set(constraints.length?.min ?? 5);
        this.lengthMax.set(constraints.length?.max ?? 128);
        this.settingsForm.patchValue(
          {
            length: state.length ?? 14,
            uppercase: !!state.uppercase,
            lowercase: !!state.lowercase,
            number: !!state.number,
            special: !!state.special,
            avoidAmbiguous: !state.ambiguous,
          },
          { emitEvent: false },
        );
      });

    // Zero minX when unchecked so constraint calibration doesn't re-enable the type.
    this.settingsForm.valueChanges
      .pipe(debounceTime(SETTINGS_WAIT_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const upper = value.uppercase ?? false;
        const lower = value.lowercase ?? false;
        const number = value.number ?? false;
        const special = value.special ?? false;
        latestSettings = {
          ...latestSettings,
          length: value.length != null ? Number(value.length) : latestSettings.length,
          ambiguous: !value.avoidAmbiguous,
          uppercase: upper,
          minUppercase: upper ? latestSettings.minUppercase || 1 : 0,
          lowercase: lower,
          minLowercase: lower ? latestSettings.minLowercase || 1 : 0,
          number: number,
          minNumber: number ? latestSettings.minNumber || 1 : 0,
          special: special,
          minSpecial: special ? latestSettings.minSpecial || 1 : 0,
        };
        settings.next(latestSettings);
      });

    // skip(1) avoids regenerating on the initial settings seed.
    settings.withConstraints$
      .pipe(skip(1), debounceTime(SETTINGS_WAIT_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isOpen() && this.canGenerate) {
          void this.generate();
        }
      });

    this.ready.set(true);
  }

  protected toggle() {
    if (!this.ready()) {
      return;
    }
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      void this.generate();
    }
  }

  // New Subject per call bypasses the generator's internal cache.
  protected async generate() {
    if (this.generating()) {
      return;
    }
    this.generating.set(true);
    const request$ = new Subject<GenerateRequest>();
    const promise = firstValueFrom(
      this.generatorService
        .generate$({ on$: request$, account$: this.account$ })
        .pipe(first(), takeUntilDestroyed(this.destroyRef)),
    );
    request$.next({
      algorithm: Algorithm.password,
      profile: Profile.secretsManager,
      source: "sm secret generator",
    });
    try {
      const generated = await promise;
      this.preview.set(generated.credential);
    } catch (e: unknown) {
      this.logService.error(e);
    } finally {
      request$.complete();
      this.generating.set(false);
    }
  }

  protected useValue() {
    this.valueGenerated.emit(this.preview());
    this.isOpen.set(false);
  }
}
