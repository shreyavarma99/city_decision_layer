import {
  getInterventionById,
  listInterventions,
} from '../../../application/interventions/interventionService.js'

export function listInterventionsHandler(_request, response) {
  response.json({
    data: listInterventions(),
  })
}

export function getInterventionHandler(request, response) {
  const intervention = getInterventionById(request.params.interventionId)

  if (!intervention) {
    response.status(404).json({
      error: `Intervention "${request.params.interventionId}" was not found.`,
    })
    return
  }

  response.json({
    data: intervention,
  })
}
