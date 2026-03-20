import cors from 'cors'
import express from 'express'
import { getEnv } from './config/env.js'
import { interventionRouter } from './presentation/http/routes/interventionRoutes.js'

const env = getEnv()

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.frontendOrigin,
    }),
  )
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
    })
  })

  app.use('/api/interventions', interventionRouter)

  return app
}
