import { Field, Site, Permission } from "./data";
import { FieldId, SiteId, SiteMetadata } from "./type";

export const DefaultSites: SiteId[] = Object.freeze(Object.keys(Site) as any);

export const DefaultFields: FieldId[] = Object.freeze(Object.keys(Field) as any);

export const Extension: Record<string, SiteMetadata> = {
  [Site.forwarder]: {
    id: Site.forwarder,
    availableFields: [Field.baseUrl, Field.domain, Field.prefix, Field.token],
  },
};

export const AllowedPermissions: ReadonlyArray<keyof typeof Permission> = Object.freeze(
  Object.values(Permission),
);
