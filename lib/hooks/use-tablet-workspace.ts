"use client"

import { useSyncExternalStore } from "react"

const query = "(max-width: 1535px), (pointer: coarse)"
function subscribe(notify: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}

export function useTabletWorkspace() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
