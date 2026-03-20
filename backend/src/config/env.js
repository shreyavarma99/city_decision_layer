const DEFAULT_PORT = 4000
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173'

export function getEnv() {
  return {
    port: Number(process.env.PORT ?? DEFAULT_PORT),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
  }
}
