import { defineConfig, loadEnv, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage, ServerResponse } from "node:http";

function neonApiPlugin() {
  return {
    name: "neon-api-dev",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith("/api/")) { next(); return; }

        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
          });
          res.end();
          return;
        }

        // Parse JSON body
        const body = await new Promise<any>((resolve) => {
          if ((req as any).body !== undefined) { resolve((req as any).body); return; }
          let raw = "";
          req.on("data", (c) => { raw += c; });
          req.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
          req.on("error", () => resolve({}));
        });
        Object.defineProperty(req, "body", { value: body, writable: true, configurable: true });

        // Resolve handler file from URL path
        const pathname = req.url!.split("?")[0]; // e.g. /api/auth/login
        const handlerPath = path.resolve(process.cwd(), `.${pathname}.ts`);

        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const handler = mod.default ?? mod;
          await handler(req, res);
        } catch (e: any) {
          if (!res.headersSent) {
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ error: e.message || "Internal server error" }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load ALL .env vars (no prefix filter) into process.env so SSR API handlers can read them
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      neonApiPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
