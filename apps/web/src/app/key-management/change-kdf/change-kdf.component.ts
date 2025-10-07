import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { Subject, firstValueFrom, takeUntil, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";
import {
  KdfConfigService,
  Argon2KdfConfig,
  DEFAULT_KDF_CONFIG,
  KdfConfig,
  PBKDF2KdfConfig,
  KdfType,
} from "@bitwarden/key-management";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

@Component({
  selector: "app-change-kdf",
  templateUrl: "change-kdf.component.html",
  standalone: false,
})
export class ChangeKdfComponent implements OnInit, OnDestroy {
  kdfConfig: KdfConfig = DEFAULT_KDF_CONFIG;
  kdfOptions: any[] = [];
  private destroy$ = new Subject<void>();

  protected formGroup = this.formBuilder.group({
    kdf: new FormControl<KdfType>(KdfType.PBKDF2_SHA256, [Validators.required]),
    kdfConfig: this.formBuilder.group({
      iterations: new FormControl<number | null>(null),
      memory: new FormControl<number | null>(null),
      parallelism: new FormControl<number | null>(null),
    }),
  });

  // Default values for template
  protected PBKDF2_ITERATIONS = PBKDF2KdfConfig.ITERATIONS;
  protected ARGON2_ITERATIONS = Argon2KdfConfig.ITERATIONS;
  protected ARGON2_MEMORY = Argon2KdfConfig.MEMORY;
  protected ARGON2_PARALLELISM = Argon2KdfConfig.PARALLELISM;

  noLogoutOnKdfChangeFeatureFlag$: Observable<boolean>;

  constructor(
    private dialogService: DialogService,
    private kdfConfigService: KdfConfigService,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    configService: ConfigService,
  ) {
    this.kdfOptions = [
      { name: "PBKDF2 SHA-256", value: KdfType.PBKDF2_SHA256 },
      { name: "Argon2id", value: KdfType.Argon2id },
    ];
    this.noLogoutOnKdfChangeFeatureFlag$ = configService.getFeatureFlag$(
      FeatureFlag.NoLogoutOnKdfChange,
    );
  }

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
    this.formGroup.controls.kdf.setValue(this.kdfConfig.kdfType);
    this.setFormControlValues(this.kdfConfig);
    this.setFormValidators(this.kdfConfig.kdfType);

    this.formGroup.controls.kdf.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((newValue) => {
        this.updateKdfConfig(newValue!);
      });
  }
  private updateKdfConfig(newValue: KdfType) {
    let config: KdfConfig;

    switch (newValue) {
      case KdfType.PBKDF2_SHA256:
        config = new PBKDF2KdfConfig();
        break;
      case KdfType.Argon2id:
        config = new Argon2KdfConfig();
        break;
      default:
        throw new Error("Unknown KDF type.");
    }

    this.kdfConfig = config;
    this.setFormValidators(newValue);
    this.setFormControlValues(this.kdfConfig);
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isPBKDF2(t: KdfConfig): t is PBKDF2KdfConfig {
    return t instanceof PBKDF2KdfConfig;
  }

  isArgon2(t: KdfConfig): t is Argon2KdfConfig {
    return t instanceof Argon2KdfConfig;
  }

  async openConfirmationModal() {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const kdfConfigFormGroup = this.formGroup.controls.kdfConfig;
    if (this.kdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      this.kdfConfig.iterations = kdfConfigFormGroup.controls.iterations.value!;
    } else if (this.kdfConfig.kdfType === KdfType.Argon2id) {
      this.kdfConfig.iterations = kdfConfigFormGroup.controls.iterations.value!;
      this.kdfConfig.memory = kdfConfigFormGroup.controls.memory.value!;
      this.kdfConfig.parallelism = kdfConfigFormGroup.controls.parallelism.value!;
    }
    this.dialogService.open(ChangeKdfConfirmationComponent, {
      data: {
        kdfConfig: this.kdfConfig,
      },
    });
  }
}
