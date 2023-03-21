import { Guid } from "../types/guid";

export abstract class AppIdService {
  getAppId: () => Promise<Guid>;
  getAnonymousAppId: () => Promise<Guid>;
}
