import { interventionCatalog } from '../../domain/interventions/interventionCatalog.js'

export function listInterventions() {
  return interventionCatalog
}

export function getInterventionById(interventionId) {
  return interventionCatalog.find((intervention) => intervention.id === interventionId) ?? null
}
