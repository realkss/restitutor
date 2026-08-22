// Profiles: per-literature symbol tables paired with their source conventions
// (product-design §5, tier 1 of symbol acquisition). The GR profile wraps the
// production engine's registry — the site's conventions page as data, the
// registry the floater runs in production.
//
// New profiles are CORPUS-DRIVEN, never invented: a profile encodes a real
// conventions page or a real subfield's declared readings, built and verified
// the way the census was (enumerate → adversarially verify → adjudicate).
// This module is the mounting point, not a license to fabricate registries.
import { HubRegistry, findRegistryForSlug } from "./unitsEngine"

export type Profile = {
  id: string
  name: string
  registry: HubRegistry
  /** The CONVENTIONS key of the registry's source convention. */
  sourceConventionKey: string
}

const grRegistry = findRegistryForSlug("Topics/Physics/Relativity-and-Gravitation/")
if (!grRegistry) throw new Error("GR registry missing from the engine")

export const PROFILES: Profile[] = [
  {
    id: "gr",
    name: "General relativity (the site's conventions page as data)",
    registry: grRegistry,
    sourceConventionKey: "geometrized",
  },
]

export function profileFor(slug: string): Profile | null {
  return PROFILES.find((p) => p.registry.slugPattern.test(slug)) ?? null
}

export function defaultProfile(): Profile {
  return PROFILES[0]
}
