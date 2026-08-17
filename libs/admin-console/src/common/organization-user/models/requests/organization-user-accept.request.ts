export class OrganizationUserAcceptRequest {
  token!: string;
  // Used to auto-enroll in master password reset
  resetPasswordKey?: string;
}
