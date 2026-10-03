import {
  CollectionType,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionType as SdkCollectionType } from "@bitwarden/sdk-internal";

/**
 * Maps a client {@link CollectionType} to the SDK's `CollectionType`. The two enums share numeric
 * values today, but the explicit per-value mapping turns any future divergence (a renamed/removed
 * SDK member, or a new client member) into a compile error instead of a silent mismatch through a
 * cast.
 */
export function toSdkCollectionType(type: CollectionType): SdkCollectionType {
  switch (type) {
    case CollectionTypes.SharedCollection:
      return SdkCollectionType.SharedCollection;
    case CollectionTypes.DefaultUserCollection:
      return SdkCollectionType.DefaultUserCollection;
  }
}
