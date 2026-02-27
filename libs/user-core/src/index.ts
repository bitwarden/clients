import { Opaque } from "type-fest";

/**
 * The main identifier for a user. It is a string that should be in valid guid format.
 *
 * You should avoid `as UserId`-ing strings as much as possible and instead retrieve the {@see UserId} from
 * a valid source instead.
 */
export type UserId = Opaque<string, "UserId">;
