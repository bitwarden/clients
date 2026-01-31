import { Query } from "./query";

/** Takes the email of the grantee and returns a list of invite links for the grantee account */
export class EmergencyAccessInviteQuery extends Query<
  {
    email: string;
  },
  string[]
> {
  template: string = "EmergencyAccessInviteQuery";
}
