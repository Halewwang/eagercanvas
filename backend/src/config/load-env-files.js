import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'

const DEFAULT_ENV_FILES = ['.env.local', '.env']

export const loadBackendEnvFiles = ({
  cwd = process.cwd(),
  config = dotenv.config
} = {}) => {
  DEFAULT_ENV_FILES.forEach((fileName) => {
    config({
      path: path.join(cwd, fileName),
      override: false
    })
  })
}
