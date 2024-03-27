import { UserId } from "../../types/guid";

export abstract class EventUploadService {
  uploadEvents: (userId?: UserId) => Promise<void>;
}
