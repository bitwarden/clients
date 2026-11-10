import { QueryTemplate } from "../query";

/** See `EmergencyAccessInviteQuery.Request` in the server's util/Seeder/Queries. */
type Args = {
  /** The grantee's email, as stored, e.g. from `scene.mangle`. */
  email: string;
};

/** See `EmergencyAccessInviteQuery.Response` in the server's util/Seeder/Queries. */
type Result = {
  /** Hash-route paths accepting each invite, e.g. `/accept-emergency?id=...`. */
  urls: string[];
};

/** The links in the emergency access invite emails sent to a grantee. */
export class EmergencyAccessInviteQuery extends QueryTemplate<Args, Result> {
  readonly template = "EmergencyAccessInviteQuery";
}
