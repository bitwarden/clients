// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl, ValidatorFn, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

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
})
export class ChangeKdfComponent implements OnInit, OnDestroy {
  kdfConfig: KdfConfig = DEFAULT_KDF_CONFIG;
  kdfOptions: any[] = [];
  private destroy$ = new Subject<void>();

  protected formGroup = this.formBuilder.group({
    kdf: new FormControl(KdfType.PBKDF2_SHA256, [Validators.required]),
    kdfConfig: this.formBuilder.group({
      iterations: [this.kdfConfig.iterations],
      memory: [null as number],
      parallelism: [null as number],
    }),
  });

  // Default values for template
  protected PBKDF2_ITERATIONS = PBKDF2KdfConfig.ITERATIONS;
  protected ARGON2_ITERATIONS = Argon2KdfConfig.ITERATIONS;
  protected ARGON2_MEMORY = Argon2KdfConfig.MEMORY;
  protected ARGON2_PARALLELISM = Argon2KdfConfig.PARALLELISM;

  constructor(
    private dialogService: DialogService,
    private kdfConfigService: KdfConfigService,
    private formBuilder: FormBuilder,
  ) {
    this.kdfOptions = [
      { name: "PBKDF2 SHA-256", value: KdfType.PBKDF2_SHA256 },
      { name: "Argon2id", value: KdfType.Argon2id },
    ];
  }

  async ngOnInit() {
    this.kdfConfig = await this.kdfConfigService.getKdfConfig();
    this.formGroup.get("kdf").setValue(this.kdfConfig.kdfType);
    this.setFormControlValues(this.kdfConfig);

    this.formGroup
      .get("kdf")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((newValue) => {
        this.updateKdfConfig(newValue);
      });
  }
  private updateKdfConfig(newValue: KdfType) {
    let config: KdfConfig;
    const validators: { [key: string]: ValidatorFn[] } = {
      iterations: [],
      memory: [],
      parallelism: [],
    };

    switch (newValue) {
      case KdfType.PBKDF2_SHA256:
        config = new PBKDF2KdfConfig();
        validators.iterations = [
          Validators.required,
          Validators.min(PBKDF2KdfConfig.ITERATIONS.min),
          Validators.max(PBKDF2KdfConfig.ITERATIONS.max),
        ];
        break;
      case KdfType.Argon2id:
        config = new Argon2KdfConfig();
        validators.iterations = [
          Validators.required,
          Validators.min(Argon2KdfConfig.ITERATIONS.min),
          Validators.max(Argon2KdfConfig.ITERATIONS.max),
        ];
        validators.memory = [
          Validators.required,
          Validators.min(Argon2KdfConfig.MEMORY.min),
          Validators.max(Argon2KdfConfig.MEMORY.max),
        ];
        validators.parallelism = [
          Validators.required,
          Validators.min(Argon2KdfConfig.PARALLELISM.min),
          Validators.max(Argon2KdfConfig.PARALLELISM.max),
        ];
        break;
      default:
        throw new Error("Unknown KDF type.");
    }

    this.kdfConfig = config;
    this.setFormValidators(validators);
    this.setFormControlValues(this.kdfConfig);
  }

  private setFormValidators(validators: { [key: string]: ValidatorFn[] }) {
    this.setValidators("kdfConfig.iterations", validators.iterations);
    this.setValidators("kdfConfig.memory", validators.memory);
    this.setValidators("kdfConfig.parallelism", validators.parallelism);
  }
  private setValidators(controlName: string, validators: ValidatorFn[]) {
    const control = this.formGroup.get(controlName);
    if (control) {
      control.setValidators(validators);
      control.updateValueAndValidity();
    }
  }
  private setFormControlValues(kdfConfig: KdfConfig) {
    this.formGroup.get("kdfConfig").reset();
    if (kdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      this.formGroup.get("kdfConfig.iterations").setValue(kdfConfig.iterations);
    } else if (kdfConfig.kdfType === KdfType.Argon2id) {
      this.formGroup.get("kdfConfig.iterations").setValue(kdfConfig.iterations);
      this.formGroup.get("kdfConfig.memory").setValue(kdfConfig.memory);
      this.formGroup.get("kdfConfig.parallelism").setValue(kdfConfig.parallelism);
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
    if (this.kdfConfig.kdfType === KdfType.PBKDF2_SHA256) {
      this.kdfConfig.iterations = this.formGroup.get("kdfConfig.iterations").value;
    } else if (this.kdfConfig.kdfType === KdfType.Argon2id) {
      this.kdfConfig.iterations = this.formGroup.get("kdfConfig.iterations").value;
      this.kdfConfig.memory = this.formGroup.get("kdfConfig.memory").value;
      this.kdfConfig.parallelism = this.formGroup.get("kdfConfig.parallelism").value;
    }
    this.dialogService.open(ChangeKdfConfirmationComponent, {
      data: {
        kdfConfig: this.kdfConfig,
      },
    });
  }
}
