export const Scopes = {
  Send: "api.send",
  // TODO: migrate other scopes to this object
};

export type Scope = (typeof Scopes)[keyof typeof Scopes];
