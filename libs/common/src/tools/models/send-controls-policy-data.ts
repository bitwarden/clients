import { SendType } from "../send/types/send-type";

import { WhoCanAccessType } from "./send-who-can-access-type";

export class SendControlsPolicyData {
  /** When true prevent users from creating Sends at all. The Send page will be hidden on the client. */
  disableSend: boolean = false;
  /** Specify what kind of authentication created Sends must have. */
  whoCanAccess: WhoCanAccessType = WhoCanAccessType.Any;
  /** When specifying email verification as the required Send auth type the
   * Send's emails must belong to the following comma-separated list of domains */
  allowedDomains: string | null = null;
  /** When true prevent users from creating Sends with their email hidden */
  disableHideEmail: boolean = false;
  /** Specify the deletion interval that new Sends must have when created */
  deletionHours: number | null = null;
  /** Specify which types of Sends can be created */
  allowedSendTypes: SendType[] = [SendType.Text, SendType.File];
}
