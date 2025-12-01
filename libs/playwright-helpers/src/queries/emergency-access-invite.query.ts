import { Query } from "./query";

export class EmergencyAccessInviteQuery extends Query<
  {
    email: string;
  },
  string[]
> {
  template: string = "EmergencyAccessInviteQuery";
}
