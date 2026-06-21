import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    port: 5174
  },
  preview: {
    port: 4174
  }
});
