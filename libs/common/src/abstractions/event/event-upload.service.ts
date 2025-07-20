// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "../../types/guid";

export abstract class EventUploadService {
  uploadEvents: (userId?: UserId) => Promise<void>;
}
