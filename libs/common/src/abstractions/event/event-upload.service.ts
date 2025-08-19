import { UserId } from "../../types/guid";

export abstract class EventUploadService {
  abstract uploadEvents(userId?: UserId): Promise<void>;
}
