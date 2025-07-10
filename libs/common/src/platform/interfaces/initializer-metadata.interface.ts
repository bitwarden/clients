import { InitializerKey } from "../services/cryptography/initializer-key";

/**
 * This interface enables deserialization of arbitrary objects by recording their class name as an enum, which
 * will survive serialization. The enum can then be matched to a constructor or factory method for deserialization.
 * See get-class-initializer.ts for the initializer map.
 */
export interface InitializerMetadata {
  initializerKey: InitializerKey;
  toJSON?: () => { initializerKey: InitializerKey };
}
