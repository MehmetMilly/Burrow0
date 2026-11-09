import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Isolated QA builds must not reload a live gameplay input run.
    watch: { ignored: ['**/artifacts/**'] },
  },
});
