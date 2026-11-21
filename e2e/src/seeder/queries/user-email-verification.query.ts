import { QueryTemplate } from "../query";

/** See `UserEmailVerificationQuery.Request` in the server's util/Seeder/Queries. */
type Args = {
  /** The email the registrant typed at signup. */
  email: string;
  /** The name the registrant typed at signup, carried in the link's token. */
  name?: string;
  receiveMarketingEmails?: boolean;
};

/** See `UserEmailVerificationQuery.Response` in the server's util/Seeder/Queries. */
type Result = {
  /** Path of the link in the verification email, e.g. `/redirect-connector.html#finish-signup?...`. */
  url: string;
  /** Whether an account with the email exists and has verified it. */
  emailVerified: boolean;
};

/**
 * The link in the email that verifies a registrant's address. The server signs a fresh token
 * for the email, equal in shape to the one it mailed, so the test needs no inbox.
 */
export class UserEmailVerificationQuery extends QueryTemplate<Args, Result> {
  readonly template = "UserEmailVerificationQuery";
}
