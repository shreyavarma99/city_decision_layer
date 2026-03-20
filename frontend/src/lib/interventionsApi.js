const DEFAULT_API_BASE_URL = 'http://localhost:4000/api'

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL
}

export async function fetchInterventionCatalog(signal) {
  const response = await fetch(`${getApiBaseUrl()}/interventions`, {
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to load intervention catalog: ${response.status}`)
  }

  const payload = await response.json()
  return payload.data ?? []
}
