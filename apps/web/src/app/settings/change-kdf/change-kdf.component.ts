import { Component, OnInit } from "@angular/core";

import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import {
  DEFAULT_KDF_CONFIG,
  DEFAULT_PBKDF2_ITERATIONS,
  DEFAULT_ARGON2_ITERATIONS,
  DEFAULT_ARGON2_MEMORY,
  DEFAULT_ARGON2_PARALLELISM,
  KdfType,
} from "@bitwarden/common/enums";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

import { ChangeKdfConfirmationComponent } from "./change-kdf-confirmation.component";

@Component({
  selector: "app-change-kdf",
  templateUrl: "change-kdf.component.html",
})
export class ChangeKdfComponent implements OnInit {
  kdf = KdfType.PBKDF2_SHA256;
  kdfConfig: KdfConfig = DEFAULT_KDF_CONFIG;
  kdfType = KdfType;
  kdfOptions: any[] = [];
  recommendedPbkdf2Iterations = DEFAULT_PBKDF2_ITERATIONS;

  constructor(private stateService: StateService, private dialogService: DialogService) {
    this.kdfOptions = [
      { name: "PBKDF2 SHA-256", value: KdfType.PBKDF2_SHA256 },
      { name: "Argon2id", value: KdfType.Argon2id },
    ];
  }

  async ngOnInit() {
    this.kdf = await this.stateService.getKdfType();
    this.kdfConfig = await this.stateService.getKdfConfig();
  }

  async onChangeKdf(newValue: KdfType) {
    if (newValue === KdfType.PBKDF2_SHA256) {
      this.kdfConfig = new KdfConfig(DEFAULT_PBKDF2_ITERATIONS);
    } else if (newValue === KdfType.Argon2id) {
      this.kdfConfig = new KdfConfig(
        DEFAULT_ARGON2_ITERATIONS,
        DEFAULT_ARGON2_MEMORY,
        DEFAULT_ARGON2_PARALLELISM
      );
    } else {
      throw new Error("Unknown KDF type.");
    }
  }

  async openConfirmationModal() {
    this.dialogService.open(ChangeKdfConfirmationComponent, {
      data: {
        kdf: this.kdf,
        kdfConfig: this.kdfConfig,
      },
    });
  }
}
