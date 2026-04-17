import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Backend REST API (alarm history etc.)
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
            },
            // Simulator scenario control
            "/scenario": {
                target: "http://localhost:8090",
                changeOrigin: true,
            },
        },
    },
});
