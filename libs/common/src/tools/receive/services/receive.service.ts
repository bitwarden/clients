import { Observable } from "rxjs";

import { ReceiveId } from "@bitwarden/common/types/guid";
import { UserId } from "@bitwarden/user-core";

import { ReceiveData } from "../models/data/receive.data";
import { Receive } from "../models/domain/receive";
import { ReceiveCreateInput } from "../models/receive-create-input";
import { ReceiveSharedData } from "../models/receive-shared-data";
import { ReceiveUrlData } from "../models/receive-url-data";
import { ReceiveView } from "../models/view/receive.view";

export abstract class ReceiveService {
  // Get all the decrypted receive views for the user.
  abstract receiveViews$(userId: UserId): Observable<ReceiveView[]>;
  // Create a new receive with the given input and return the created receive.
  abstract create(input: ReceiveCreateInput, userId: UserId): Promise<ReceiveView>;
  // Update a receive
  abstract update(receiveView: ReceiveView, userId: UserId): Promise<void>;

  abstract getSharedData(urlData: ReceiveUrlData): Promise<ReceiveSharedData>;

  // Build the full shareable URL for a receive, based on the current environment.
  abstract buildReceiveUrl$(receive: ReceiveView): Observable<string | null>;
}

export abstract class InternalReceiveService extends ReceiveService {
  // Replace the existing encrypted receive state for the user with the given receives. This is used to sync the local state with the server state.
  abstract replace(receives: { [id: string]: ReceiveData }, userId: UserId): Promise<void>;
  // Upsert a encrypted receive for the user. This is used to add or update a receive in the local state.
  abstract upsert(receiveData: ReceiveData | ReceiveData[], userId: UserId): Promise<void>;
  // Used to get local state by receive id & userId for sync notification processing.
  abstract get(id: ReceiveId, userId: UserId): Promise<Receive | undefined>;
  // Delete a receive by id for the user.
  abstract delete(id: ReceiveId, userId: UserId): Promise<void>;
}
