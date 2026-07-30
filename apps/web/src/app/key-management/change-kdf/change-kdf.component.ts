import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService } from "@bitwarden/components";
import {
  KdfConfigService,
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  KdfType,
} from "@bitwarden/key-management";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

type KdfOption = { name: string; value: KdfType };

const ALL_KDF_OPTIONS: KdfOption[] = [
  { name: "PBKDF2 SHA-256", value: KdfType.PBKDF2_SHA256 },
  { name: "Argon2id", value: KdfType.Argon2id },
];

function defaultKdfConfig(kdfType: KdfType): KdfConfig {
  switch (kdfType) {
    case KdfType.PBKDF2_SHA256:
      return PBKDF2KdfConfig.createDefault();
    case KdfType.Argon2id:
      return Argon2KdfConfig.createDefault();
    default:
      throw new Error("Unknown KDF type.");
  }
}

@Component({
  selector: "app-change-kdf",
  templateUrl: "change-kdf.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeKdfComponent implements OnInit {
  private readonly dialogService = inject(DialogService);
  private readonly kdfConfigService = inject(KdfConfigService);
  private readonly accountService = inject(AccountService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly configService = inject(ConfigService);
  private readonly sdkService = inject(SdkService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly kdfConfig = signal<KdfConfig>(PBKDF2KdfConfig.createDefault());
  protected readonly isPBKDF2 = computed(() => this.kdfConfig() instanceof PBKDF2KdfConfig);
  protected readonly isArgon2 = computed(() => this.kdfConfig() instanceof Argon2KdfConfig);

  /**
   * The KDF algorithms the user is allowed to select, filtered by the SDK's environment-aware
   * compliance check. In a FIPS (gov) environment only PBKDF2 is compliant, so Argon2id is removed.
   */
  protected readonly kdfOptions = toSignal(
    this.sdkService.client$.pipe(
      map((client) => {
        const cipherSuite = client.crypto_cipher_suite();
        return ALL_KDF_OPTIONS.filter((option) =>
          cipherSuite.is_kdf_compliant(defaultKdfConfig(option.value).toSdkConfig()),
        );
      }),
    ),
    { initialValue: [] as KdfOption[] },
  );

  protected readonly argon2Available = computed(() =>
    this.kdfOptions().some((option) => option.value === KdfType.Argon2id),
  );

  protected readonly formGroup = this.formBuilder.group({
    kdf: new FormControl<KdfType>(KdfType.PBKDF2_SHA256, [Validators.required]),
    kdfConfig: this.formBuilder.group({
      iterations: new FormControl<number | null>(null),
      memory: new FormControl<number | null>(null),
      parallelism: new FormControl<number | null>(null),
    }),
  });

  // Default values for template
  protected readonly PBKDF2_ITERATIONS = PBKDF2KdfConfig.ITERATIONS;
  protected readonly ARGON2_ITERATIONS = Argon2KdfConfig.ITERATIONS;
  protected readonly ARGON2_MEMORY = Argon2KdfConfig.MEMORY;
  protected readonly ARGON2_PARALLELISM = Argon2KdfConfig.PARALLELISM;

  protected readonly noLogoutOnKdfChangeFeatureFlag$ = this.configService.getFeatureFlag$(
    FeatureFlag.NoLogoutOnKdfChange,
  );

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
    this.kdfConfig.set(kdfConfig);
    this.formGroup.controls.kdf.setValue(kdfConfig.kdfType);
    this.setFormControlValues(kdfConfig);
    this.setFormValidators(kdfConfig.kdfType);

    this.formGroup.controls.kdf.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newValue) => {
        this.updateKdfConfig(newValue!);
      });
  }

  private updateKdfConfig(newValue: KdfType) {
    const config = defaultKdfConfig(newValue);
    this.kdfConfig.set(config);
    this.setFormValidators(newValue);
    this.setFormControlValues(config);
  }

  private setFormValidators(kdfType: KdfType) {
    const kdfConfigFormGroup = this.formGroup.controls.kdfConfig;
    switch (kdfType) {
      case KdfType.PBKDF2_SHA256:
        kdfConfigFormGroup.controls.iterations.setValidators([
          Validators.required,
          Validators.min(PBKDF2KdfConfig.ITERATIONS.min),
          Validators.max(PBKDF2KdfConfig.ITERATIONS.max),
        ]);
        kdfConfigFormGroup.controls.memory.setValidators([]);
        kdfConfigFormGroup.controls.parallelism.setValidators([]);
        break;
      case KdfType.Argon2id:
        kdfConfigFormGroup.controls.iterations.setValidators([
          Validators.required,
          Validators.min(Argon2KdfConfig.ITERATIONS.min),
          Validators.max(Argon2KdfConfig.ITERATIONS.max),
        ]);
        kdfConfigFormGroup.controls.memory.setValidators([
          Validators.required,
          Validators.min(Argon2KdfConfig.MEMORY.min),
          Validators.max(Argon2KdfConfig.MEMORY.max),
        ]);
        kdfConfigFormGroup.controls.parallelism.setValidators([
          Validators.required,
          Validators.min(Argon2KdfConfig.PARALLELISM.min),
          Validators.max(Argon2KdfConfig.PARALLELISM.max),
        ]);
        break;
      default:
        throw new Error("Unknown KDF type.");
    }
    kdfConfigFormGroup.controls.iterations.updateValueAndValidity();
    kdfConfigFormGroup.controls.memory.updateValueAndValidity();
    kdfConfigFormGroup.controls.parallelism.updateValueAndValidity();
  }

  private setFormControlValues(kdfConfig: KdfConfig) {
    const kdfConfigFormGroup = this.formGroup.controls.kdfConfig;
    kdfConfigFormGroup.reset();
    if (kdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      kdfConfigFormGroup.controls.iterations.setValue(kdfConfig.iterations);
    } else if (kdfConfig.kdfType === KdfType.Argon2id) {
      kdfConfigFormGroup.controls.iterations.setValue(kdfConfig.iterations);
      kdfConfigFormGroup.controls.memory.setValue(kdfConfig.memory);
      kdfConfigFormGroup.controls.parallelism.setValue(kdfConfig.parallelism);
    }
  }

  async openConfirmationModal() {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const kdfConfigFormGroup = this.formGroup.controls.kdfConfig;
    const currentKdfConfig = this.kdfConfig();
    let kdfConfig: KdfConfig;
    if (currentKdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      kdfConfig = new PBKDF2KdfConfig(kdfConfigFormGroup.controls.iterations.value!);
    } else {
      kdfConfig = new Argon2KdfConfig(
        kdfConfigFormGroup.controls.iterations.value!,
        kdfConfigFormGroup.controls.memory.value!,
        kdfConfigFormGroup.controls.parallelism.value!,
      );
    }
    this.kdfConfig.set(kdfConfig);
    this.dialogService.open(ChangeKdfConfirmationComponent, {
      data: {
        kdfConfig,
      },
    });
  }
}
