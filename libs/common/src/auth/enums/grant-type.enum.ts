export const GrantTypes = {
  SendAccess: "send_access",
  // TODO: migrate other grant types to this object
};

export type GrantType = (typeof GrantTypes)[keyof typeof GrantTypes];
