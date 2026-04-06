import { Injectable } from "@angular/core";

import {
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";

import { CipherFormGenerationService } from "../abstractions/cipher-form-generation.service";

@Injectable()
export class DefaultCipherFormGenerationService implements CipherFormGenerationService {
  constructor(
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private usernameGenerationService: UsernameGenerationServiceAbstraction,
  ) {}

  async generatePassword(): Promise<string> {
    const [options] = await this.passwordGenerationService.getOptions();
    return await this.passwordGenerationService.generatePassword(options);
  }

  async generateUsername(): Promise<string> {
    const options = await this.usernameGenerationService.getOptions();
    return await this.usernameGenerationService.generateUsername(options);
  }
}
