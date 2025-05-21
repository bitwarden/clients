import { Jsonify } from "type-fest";

import { StateProvider } from "../../platform/state";
import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";
import { SemanticLogger } from "../log";

/** Aggregates user state subject dependencies */
export abstract class UserStateSubjectDependencyProvider {
  /** Provides objects that encrypt and decrypt user and organization data */
  abstract encryptor: LegacyEncryptorProvider;

  /** Provides local object persistence */
  abstract state: StateProvider;

  // FIXME: remove `log` and inject the system provider into the USS instead
  /** Provides semantic logging */
  abstract log: <Context extends object>(_context: Jsonify<Context>) => SemanticLogger;
}
