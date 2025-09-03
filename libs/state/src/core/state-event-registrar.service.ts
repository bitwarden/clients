import { UserKeyDefinition } from "./user-key-definition";

export abstract class StateEventRegistrarService {
  abstract registerEvents(keyDefinition: UserKeyDefinition<unknown>): Promise<void>;
}
