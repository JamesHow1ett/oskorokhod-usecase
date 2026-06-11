/*
 * release — publishes a production build to the public npm registry.
 *
 * Run via `npm run release`, which invokes this with
 * `node --env-file-if-exists=.env` so NPM_TOKEN from your local .env is loaded
 * into the environment; npm then resolves `${NPM_TOKEN}` from .npmrc. In CI the
 * token comes from real env vars and .env is simply absent (tolerated).
 *
 * Steps:
 *   1. Fail fast if NPM_TOKEN is missing.
 *   2. Run the full check suite (`npm run check`).
 *   3. `npm publish` to the public npm registry — access and dist-tag come
 *      from package.json "publishConfig".
 */

import { execSync } from "node:child_process";

if (!process.env.NPM_TOKEN) {
	console.error(
		"NPM_TOKEN is not set. Add it to .env (local) or the environment (CI) before releasing.",
	);
	process.exit(1);
}

execSync("npm run check", { stdio: "inherit" });
execSync("npm publish", { stdio: "inherit" });
