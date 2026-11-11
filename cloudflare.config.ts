import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "ai-spend-control-course",
		compatibilityDate: "2026-11-10",
		entrypoint,
		assets: {
			notFoundHandling: "404-page",
			runWorkerFirst: ["/api/*"],
		},
		env: {
			AI: bindings.ai({ dev: { remote: true } }),
			ASSETS: bindings.assets(),
		},
	},
});
