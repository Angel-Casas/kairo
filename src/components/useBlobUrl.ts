import { useEffect, useState } from 'react'
import { getRepository } from '../state/repo'

/**
 * Resolve a BlobStore path to an object URL for display, revoking it on
 * cleanup so object URLs don't leak as users browse versions.
 */
export function useBlobUrl(blobPath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    if (blobPath !== null) {
      void getRepository()
        .then((repo) => repo.blobs.get(blobPath))
        .then((blob) => {
          if (blob !== null && !cancelled) {
            objectUrl = URL.createObjectURL(blob)
            setUrl(objectUrl)
          }
        })
    }
    return () => {
      cancelled = true
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [blobPath])

  return url
}
