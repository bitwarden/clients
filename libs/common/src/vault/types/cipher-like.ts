import { Cipher } from "../models/domain/cipher";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

/**
 * Represents either a Cipher, CipherView or CipherListView.
 *
 * {@link CipherViewLikeUtils} provides logic to perform operations on each type.
 */
export type CipherLike = Cipher | CipherViewLike;
