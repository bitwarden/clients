import { UsernameGeneratorOptions } from "./username-generation-options";

export abstract class UsernameGenerationServiceAbstraction {
  generateUsername: (options: UsernameGeneratorOptions) => Promise<string>;
  generateWord: (options: UsernameGeneratorOptions) => Promise<string>;
  generateSubaddress: (options: UsernameGeneratorOptions) => Promise<string>;
  generateCatchall: (options: UsernameGeneratorOptions) => Promise<string>;
  generateForwarded: (options: UsernameGeneratorOptions) => Promise<string>;
  getOptions: () => Promise<UsernameGeneratorOptions>;
  saveOptions: (options: UsernameGeneratorOptions) => Promise<void>;
}
