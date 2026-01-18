import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills() // Fixes simple-peer Buffer error
  ],
  server: {
    host: true, // This exposes the app to your network (IP address)
    port: 3000
  } 
})