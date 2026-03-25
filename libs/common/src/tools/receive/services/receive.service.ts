import { UserId } from "@bitwarden/user-core";

import { Receive } from "../models/receive";
import { ReceiveCreateInput } from "../models/receive-create-input";

export abstract class ReceiveService {
  abstract create(input: ReceiveCreateInput, userId: UserId): Promise<Receive>;
}
