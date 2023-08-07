import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import {
  DEFAULT_PBKDF2_ITERATIONS,
  DEFAULT_ARGON2_ITERATIONS,
  DEFAULT_ARGON2_MEMORY,
  DEFAULT_ARGON2_PARALLELISM,
  KdfType,
  MINIMUM_PBKDF2_ITERATIONS,
  MAXIMUM_PBKDF2_ITERATIONS,
  MINIMUM_ARGON2_ITERATIONS,
  MAXIMUM_ARGON2_ITERATIONS,
  MINIMUM_ARGON2_MEMORY,
  MAXIMUM_ARGON2_MEMORY,
  MINIMUM_ARGON2_PARALLELISM,
  MAXIMUM_ARGON2_PARALLELISM,
} from "@bitwarden/common/enums";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

@Component({
  selector: "app-change-kdf",
  templateUrl: "change-kdf.component.html",
})
export class ChangeKdfComponent implements OnInit {
  kdfType = KdfType;
  kdfOptions: any[] = [];
  recommendedPbkdf2Iterations = DEFAULT_PBKDF2_ITERATIONS;

  minimumPbkdf2Iterations = MINIMUM_PBKDF2_ITERATIONS;
  maximumPbkdf2Iterations = MAXIMUM_PBKDF2_ITERATIONS;
  minimumArgon2Iterations = MINIMUM_ARGON2_ITERATIONS;
  maximumArgon2Iterations = MAXIMUM_ARGON2_ITERATIONS;
  minimumArgon2Memory = MINIMUM_ARGON2_MEMORY;
  maximumArgon2Memory = MAXIMUM_ARGON2_MEMORY;
  minimumArgon2Parallelism = MINIMUM_ARGON2_PARALLELISM;
  maximumArgon2Parallelism = MAXIMUM_ARGON2_PARALLELISM;

  kdfForm: FormGroup;

  constructor(
    private stateService: StateService,
    private dialogService: DialogServiceAbstraction,
    private cd: ChangeDetectorRef
  ) {
    this.kdfOptions = [
      { name: "PBKDF2 SHA-256", value: KdfType.PBKDF2_SHA256 },
      { name: "Argon2id", value: KdfType.Argon2id },
    ];

    this.kdfForm = new FormGroup({
      kdf: new FormControl(KdfType.PBKDF2_SHA256, []),
      iterations: new FormControl(DEFAULT_PBKDF2_ITERATIONS, []),
      memory: new FormControl(0, []),
      parallelism: new FormControl(0, []),
    });
  }

  async ngOnInit() {
    const kdf = await this.stateService.getKdfType();
    const kdfConfig = await this.stateService.getKdfConfig();

    if (kdf === KdfType.PBKDF2_SHA256) {
      this.kdfForm.patchValue({
        kdf: KdfType.PBKDF2_SHA256,
        iterations: kdfConfig.iterations,
      });
    } else if (kdf === KdfType.Argon2id) {
      this.kdfForm.patchValue({
        kdf: KdfType.Argon2id,
        iterations: kdfConfig.iterations,
        memory: kdfConfig.memory,
        parallelism: kdfConfig.parallelism,
      });
    } else {
      throw new Error("Unknown KDF type.");
    }

    this.cd.detectChanges();
  }

  async onChangeKdf() {
    const newValue: KdfType = this.kdfForm.value.kdf;

    if (newValue === KdfType.PBKDF2_SHA256) {
      this.kdfForm.patchValue({
        iterations: DEFAULT_PBKDF2_ITERATIONS,
      });
    } else if (newValue === KdfType.Argon2id) {
      this.kdfForm.patchValue({
        iterations: DEFAULT_ARGON2_ITERATIONS,
        memory: DEFAULT_ARGON2_MEMORY,
        parallelism: DEFAULT_ARGON2_PARALLELISM,
      });
    } else {
      throw new Error("Unknown KDF type.");
    }

    await this.updateValidators(newValue);
  }

  async updateValidators(kdfType: KdfType) {
    this.kdfForm.controls.iterations.clearValidators();
    this.kdfForm.controls.memory.clearValidators();
    this.kdfForm.controls.parallelism.clearValidators();

    if (kdfType === KdfType.PBKDF2_SHA256) {
      this.kdfForm.controls.iterations.setValidators([
        Validators.min(this.minimumPbkdf2Iterations),
        Validators.max(this.maximumPbkdf2Iterations),
      ]);
    } else if (kdfType === KdfType.Argon2id) {
      this.kdfForm.controls.iterations.setValidators([
        Validators.min(this.minimumArgon2Iterations),
        Validators.max(this.maximumArgon2Iterations),
      ]);
      this.kdfForm.controls.memory.setValidators([
        Validators.min(this.minimumArgon2Memory),
        Validators.max(this.maximumArgon2Memory),
      ]);
      this.kdfForm.controls.parallelism.setValidators([
        Validators.min(this.minimumArgon2Parallelism),
        Validators.max(this.maximumArgon2Parallelism),
      ]);
    } else {
      throw new Error("Unknown KDF type.");
    }

    this.kdfForm.controls.iterations.updateValueAndValidity();
    this.kdfForm.controls.memory.updateValueAndValidity();
    this.kdfForm.controls.parallelism.updateValueAndValidity();
  }

  async openConfirmationModal() {
    this.dialogService.open(ChangeKdfConfirmationComponent, {
      data: {
        kdf: this.kdfForm.value.kdf,
        kdfConfig: new KdfConfig(
          this.kdfForm.value.iterations,
          this.kdfForm.value.memory,
          this.kdfForm.value.parallelism
        ),
      },
    });
  }
}
