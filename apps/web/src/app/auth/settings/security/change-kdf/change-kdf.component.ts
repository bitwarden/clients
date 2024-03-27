import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import {
  DEFAULT_KDF_CONFIG,
  PBKDF2_ITERATIONS,
  ARGON2_ITERATIONS,
  ARGON2_MEMORY,
  ARGON2_PARALLELISM,
  KdfType,
} from "@bitwarden/common/platform/enums";
import { DialogService } from "@bitwarden/components";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

@Component({
  selector: "app-change-kdf",
  templateUrl: "change-kdf.component.html",
})
export class ChangeKdfComponent implements OnInit {
  kdfType = KdfType;
  kdfOptions: any[] = [];
  formGroup = this.formBuilder.group({
    kdf: this.formBuilder.control(KdfType.PBKDF2_SHA256, [Validators.required]),
    kdfConfig: this.formBuilder.group({
      iterations: this.formBuilder.control<number>(DEFAULT_KDF_CONFIG.iterations, [
        Validators.required,
        Validators.min(PBKDF2_ITERATIONS.min),
        Validators.max(PBKDF2_ITERATIONS.max),
      ]),
      memory: this.formBuilder.control<number>(DEFAULT_KDF_CONFIG.memory, [
        Validators.required,
        Validators.min(ARGON2_MEMORY.min),
        Validators.max(ARGON2_MEMORY.max),
      ]),
      parallelism: this.formBuilder.control<number>(DEFAULT_KDF_CONFIG.parallelism, [
        Validators.required,
        Validators.min(ARGON2_PARALLELISM.min),
        Validators.max(ARGON2_PARALLELISM.max),
      ]),
    }),
  });
  // Default values for template
  protected PBKDF2_ITERATIONS = PBKDF2_ITERATIONS;
  protected ARGON2_ITERATIONS = ARGON2_ITERATIONS;
  protected ARGON2_MEMORY = ARGON2_MEMORY;
  protected ARGON2_PARALLELISM = ARGON2_PARALLELISM;
  private destroy$ = new Subject<void>();

  constructor(
    private stateService: StateService,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
  ) {
    this.kdfOptions = [
      { name: "PBKDF2 SHA-256", value: KdfType.PBKDF2_SHA256 },
      { name: "Argon2id", value: KdfType.Argon2id },
    ];
  }
  get kdfValue() {
    return this.formGroup.get("kdf").value;
  }
  get kdfConfigValue() {
    const kdfConfigValue = this.formGroup.get("kdfConfig").value;
    return new KdfConfig(
      kdfConfigValue.iterations,
      kdfConfigValue.memory,
      kdfConfigValue.parallelism,
    );
  }
  async ngOnInit() {
    this.formGroup.patchValue({
      kdf: await this.stateService.getKdfType(),
      kdfConfig: await this.stateService.getKdfConfig(),
    });
    this.formGroup
      .get("kdf")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.onChangeKdf(value);
        const iterationsControl = this.formGroup.get("kdfConfig").get("iterations");
        if (this.kdfValue == this.kdfType.Argon2id) {
          iterationsControl.setValidators([
            Validators.required,
            Validators.min(ARGON2_ITERATIONS.min),
            Validators.max(ARGON2_ITERATIONS.max),
          ]);
        } else {
          iterationsControl.setValidators([
            Validators.required,
            Validators.min(PBKDF2_ITERATIONS.min),
            Validators.max(PBKDF2_ITERATIONS.max),
          ]);
        }
      });
  }
  onChangeKdf(newValue: KdfType) {
    if (newValue === KdfType.PBKDF2_SHA256) {
      this.formGroup.get("kdfConfig").get("iterations").setValue(PBKDF2_ITERATIONS.defaultValue);
    } else if (newValue === KdfType.Argon2id) {
      this.formGroup.get("kdfConfig").setValue({
        iterations: ARGON2_ITERATIONS.defaultValue,
        memory: ARGON2_MEMORY.defaultValue,
        parallelism: ARGON2_PARALLELISM.defaultValue,
      });
    } else {
      throw new Error("Unknown KDF type.");
    }
  }

  async openConfirmationModal() {
    this.dialogService.open(ChangeKdfConfirmationComponent, {
      data: {
        kdf: this.kdfValue,
        kdfConfig: this.kdfConfigValue,
      },
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
