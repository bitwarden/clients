import { UserKey } from "../../types/key";

export abstract class PasswordResetEnrollmentServiceAbstraction {
  /*
   * Checks the user's enrollment status and enrolls them if required
   * NOTE: Will also enroll the user in the organization if in the
   * invited status
   */
  abstract enrollIfRequired(organizationSsoIdentifier: string): Promise<void>;

  /**
   * Enroll current user in password reset
   * NOTE: Will also enroll the user in the organization if in the
   * invited status
   * @param organizationId - Organization in which to enroll the user
   * @returns Promise that resolves when the user is enrolled
   * @throws Error if the action fails
   */
  abstract enroll(organizationId: string): Promise<void>;

  /**
   * Enroll user in password reset
   * NOTE: Will also enroll the user in the organization if in the
   * invited status
   * @param organizationId - Organization in which to enroll the user
   * @param userId - User to enroll
   * @param userKey - User's symmetric key
   * @returns Promise that resolves when the user is enrolled
   * @throws Error if the action fails
   */
  abstract enroll(organizationId: string, userId: string, userKey: UserKey): Promise<void>;
}
