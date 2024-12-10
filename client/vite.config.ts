// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0', // Allows access from any network interface
    port: 3000      // Use a specific port
  }
})

