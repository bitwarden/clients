export const MAX_CONNECTION_NAME_LENGTH = 50;

/** A saved agent connection as the renderer and the hub see it. Never includes the key or its hash. */
export type AgentFillConnectionView = {
  id: string;
  name: string;
  /** ISO 8601 date. */
  createdDate: string;
  paused: boolean;
};

/** A newly saved connection and its key, which is shown to the user once. */
export type CreatedAgentFillConnection = {
  connection: AgentFillConnectionView;
  /** 43-character base64url connection key. */
  key: string;
};
