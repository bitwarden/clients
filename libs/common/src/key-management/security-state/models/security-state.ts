/**
 * This class is a clear, explicit conversion, leaking the details
 * of the security state, in order to be serializable with JSON typefest.
 * This is used to store the security state to local state.
 */
export class SecurityState {
  constructor(readonly securityState: string) {}

  static fromJson(obj: any): SecurityState | null {
    if (obj == null) {
      return null;
    }

    return new SecurityState(obj.serializedSecurityState);
  }
}
