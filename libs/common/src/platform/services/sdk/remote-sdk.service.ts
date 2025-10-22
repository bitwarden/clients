import { BitwardenClient, FolderView } from "@bitwarden/sdk-internal";

import { Remote } from "./remote";

export type RemoteSdk = Remote<BitwardenClient>;

const remoteClient: RemoteSdk = {} as RemoteSdk;

export async function test(): Promise<FolderView[]> {
  return await remoteClient.vault().await.folders().await.list();
}
