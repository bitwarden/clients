// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BreachAccountResponse } from "../models/response/breach-account.response";

export abstract class AuditService {
  passwordLeaked: (password: string) => Promise<number>;
  breachedAccounts: (username: string) => Promise<BreachAccountResponse[]>;
}
