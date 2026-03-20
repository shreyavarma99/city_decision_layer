import { Router } from 'express'
import {
  getInterventionHandler,
  listInterventionsHandler,
} from '../controllers/interventionController.js'

export const interventionRouter = Router()

interventionRouter.get('/', listInterventionsHandler)
interventionRouter.get('/:interventionId', getInterventionHandler)
