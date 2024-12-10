// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UsernameGeneratorOptions } from "./username-generation-options";

/** @deprecated Use {@link GeneratorService} with a username {@link GeneratorStrategy} instead. */
export abstract class UsernameGenerationServiceAbstraction {
  generateUsername: (options: UsernameGeneratorOptions) => Promise<string>;
  generateWord: (options: UsernameGeneratorOptions) => Promise<string>;
  generateSubaddress: (options: UsernameGeneratorOptions) => Promise<string>;
  generateCatchall: (options: UsernameGeneratorOptions) => Promise<string>;
  generateForwarded: (options: UsernameGeneratorOptions) => Promise<string>;
  getOptions: () => Promise<UsernameGeneratorOptions>;
  getOptions$: () => Observable<UsernameGeneratorOptions>;
  saveOptions: (options: UsernameGeneratorOptions) => Promise<void>;
}
