export const GrantType = {
  SendAccess: "send_access",
  // TODO: migrate other grant types to this object
};

export type GrantType = (typeof GrantType)[keyof typeof GrantType];
