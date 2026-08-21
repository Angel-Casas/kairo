import type { ReferenceAsset } from '../domain/types'

/** UI display name for a reference; falls back to a kind-based placeholder. */
export function referenceDisplayName(reference: ReferenceAsset): string {
  const name = reference.name.trim()
  return name.length > 0 ? name : `Unnamed ${reference.kind}`
}
