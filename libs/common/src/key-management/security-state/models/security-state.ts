/**
 * This class is a clear, explicit conversion, leaking the details
 * of the security state, in order to be serializable with JSON typefest.
 * This is used to store the security state to local state.
 */
export class SerializedSecurityState {
  constructor(readonly securityState: string) {}

  static fromJson(obj: any): SerializedSecurityState | null {
    if (obj == null) {
      return null;
    }

    return new SerializedSecurityState(obj.serializedSecurityState);
  }
}
