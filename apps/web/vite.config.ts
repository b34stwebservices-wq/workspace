import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // Keep local Firebase values at the staff-app root, outside the web workspace.
  envDir: "../..",
  plugins: [react()],
});
