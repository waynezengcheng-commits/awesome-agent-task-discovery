import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/awesome-agent-task-discovery/",
  plugins: [react(), tailwindcss()],
});
