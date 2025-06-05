import { UnionOfValues } from "../../types/union-of-values";

export const SecurityTaskType = {
  /**
   * Task to update a cipher's password that was found to be at-risk by an administrator
   */
  UpdateAtRiskCredential: 0,
} as const;

export type SecurityTaskType = UnionOfValues<typeof SecurityTaskType>;
