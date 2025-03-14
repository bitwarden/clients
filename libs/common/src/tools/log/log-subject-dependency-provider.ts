import { LogService } from "../../platform/abstractions/log.service";
import { StateProvider } from "../../platform/state";
import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";

export abstract class LogSubjectDependencyProvider {
  /** Provides objects that encrypt and decrypt user and organization data */
  abstract encryptor: LegacyEncryptorProvider;

  /** Provides local object persistence */
  abstract state: StateProvider;

  /** `LogSubject` uses the log service instead of semantic logging
   *   to avoid creating a loop where it logs its own actions.
   */
  abstract log: LogService;
}
