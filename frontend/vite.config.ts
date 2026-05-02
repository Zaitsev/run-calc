import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const siteSrcPath = path.resolve(__dirname, '../site/src')
const workspaceRootPath = path.resolve(__dirname, '..')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@site': siteSrcPath,
    },
  },
  server: {
    fs: {
      allow: [workspaceRootPath],
    },
  },
  test: {
    environment: 'node'
  }
})
