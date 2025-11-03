import { Result } from "@bitwarden/common/platform/services/sdk/rpc/protocol";

export type RemoteSdkRequest = {
  type: "RemoteSdkRequest";
  command: string;
};

export type RemoteSdkResponse = {
  type: "RemoteSdkResponse";
  response: string;
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
    typeof message === "object" && message !== null && (message as any).type === "RemoteSdkRequest"
  );
}

export function isRemoteSdkResponse(message: unknown): message is RemoteSdkResponse {
  return (
    typeof message === "object" && message !== null && (message as any).type === "RemoteSdkResponse"
  );
}

export function isRemoteSdkResendRootRequest(
  message: unknown,
): message is RemoteSdkResendRootRequest {
  return message !== null && (message as any).type === "RemoteSdkResendRootRequest";
}

export function isRemoteSdkRoot(message: unknown): message is RemoteSdkRoot {
  return message !== null && (message as any).type === "RemoteSdkRoot";
}
