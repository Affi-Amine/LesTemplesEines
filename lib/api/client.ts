/**
 * API Client Utilities
 * Centralized fetch functions for making API requests
 */

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = "APIError"
  }
}

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `/api${endpoint}`

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new APIError(error.error || `HTTP ${response.status}`, response.status, error.code)
  }

  return response.json()
}

export async function fetchAPIWithoutJSON(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `/api${endpoint}`

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new APIError(error.error || `HTTP ${response.status}`, response.status, error.code)
  }

  return response
}
