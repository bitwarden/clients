export const Scope = {
  Send: "api.send",
  // TODO: migrate other scopes to this object
};

export type Scope = (typeof Scope)[keyof typeof Scope];
