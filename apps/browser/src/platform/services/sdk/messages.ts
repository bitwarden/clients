import { Command, Response, Result } from "@bitwarden/common/platform/services/sdk/rpc/protocol";

export type RemoteSdkRequest = {
  type: "RemoteSdkRequest";
  command: Command;
};

export type RemoteSdkResponse = {
  type: "RemoteSdkResponse";
  response: Response;
};

export type RemoteSdkResendRootRequest = {
  type: "RemoteSdkResendRootRequest";
};

export type RemoteSdkRoot = {
  type: "RemoteSdkRoot";
  result: Result;
};

export function isRemoteSdkRequest(message: unknown): message is RemoteSdkRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as any).type === "RemoteSdkRequest" &&
    typeof (message as any).command === "object"
  );
}

export function isRemoteSdkResponse(message: unknown): message is RemoteSdkResponse {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as any).type === "RemoteSdkResponse" &&
    typeof (message as any).response === "object"
  );
}

export function isRemoteSdkResendRootRequest(
  message: unknown,
): message is RemoteSdkResendRootRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as any).type === "RemoteSdkResendRootRequest"
  );
}

export function isRemoteSdkRoot(message: unknown): message is RemoteSdkRoot {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as any).type === "RemoteSdkRoot" &&
    typeof (message as any).result === "object"
  );
}
