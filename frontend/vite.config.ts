import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const siteSrcPath = path.resolve(__dirname, '../site/src')
const workspaceRootPath = path.resolve(__dirname, '..')


// Create a copy of the default Vite logger
const logger = createLogger()
const originalInfo = logger.info
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg']
const fontExtensions = ['.woff', '.woff2', '.ttf', '.eot']

function getFilteredAssetType(line: string): 'image' | 'font' | null {
  const normalizedLine = line.trim().toLowerCase()

  if (imageExtensions.some((extension) => normalizedLine.includes(extension))) {
    return 'image'
  }

  if (fontExtensions.some((extension) => normalizedLine.includes(extension))) {
    return 'font'
  }

  return null
}

// Intercept info logs to filter out the artifact asset lines
logger.info = (msg, options) => {
  let skippedImages = 0
  let skippedFonts = 0

  const filteredMessage = msg
    .split(/\r?\n/)
    .filter((line) => {
      const assetType = getFilteredAssetType(line)

      if (assetType === 'image') {
        skippedImages += 1
        return false
      }

      if (assetType === 'font') {
        skippedFonts += 1
        return false
      }

      return true
    })
    .join('\n')
    .trim()

  const skippedParts = [
    skippedFonts > 0 ? `${skippedFonts} font${skippedFonts === 1 ? '' : 's'}` : null,
    skippedImages > 0 ? `${skippedImages} image${skippedImages === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  const messageWithSummary = skippedParts.length > 0
    ? `${filteredMessage}\n(Additional resources generated: ${skippedParts.join(', ')})`.trim()
    : filteredMessage

  if (!messageWithSummary) {
    return
  }

  originalInfo(messageWithSummary, options)
}

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
    watch: {
      ignored: ['../site/**'],
    },
  },
  test: {
    environment: 'node'
  },
  logLevel: 'info',
  customLogger: logger,
  build: {
    // Correct placement
    reportCompressedSize: false,
  }
})
