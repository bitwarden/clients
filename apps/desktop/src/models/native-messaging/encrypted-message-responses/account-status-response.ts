import { Guid } from "@bitwarden/common/types/guid";

export type AccountStatusResponse = {
  id: Guid;
  email: string;
  status: "locked" | "unlocked";
  active: boolean;
};
