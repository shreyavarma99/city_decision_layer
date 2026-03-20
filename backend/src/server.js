import { createApp } from './app.js'
import { getEnv } from './config/env.js'

const env = getEnv()
const app = createApp()

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`)
})
