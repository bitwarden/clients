import { UserId } from "@bitwarden/user-core";

import { Receive } from "../models/receive";
import { ReceiveCreateInput } from "../models/receive-create-input";
import { ReceiveSharedData } from "../models/receive-shared-data";
import { ReceiveUrlData } from "../models/receive-url-data";

export abstract class ReceiveService {
  abstract create(input: ReceiveCreateInput, userId: UserId): Promise<Receive>;

  abstract getSharedData(urlData: ReceiveUrlData): Promise<ReceiveSharedData>;
}
