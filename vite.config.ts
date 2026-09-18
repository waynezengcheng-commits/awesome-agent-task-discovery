import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/awesome-agent-task-discovery/",
  plugins: [react()],
});
