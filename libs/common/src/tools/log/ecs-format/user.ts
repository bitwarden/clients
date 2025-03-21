import { UserId } from "../../../types/guid";

import { EcsFormat } from "./core";

export type UserFormat = EcsFormat & {
  /** Account indicators collected by the provider
   *  WARNING: `UserFormat` should be used sparingly; it is PII.
   */
  user: {
    id: UserId;
    email?: string;
  };
};
