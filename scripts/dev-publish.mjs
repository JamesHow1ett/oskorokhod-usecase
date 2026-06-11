/*
 * dev-publish — publishes a development build to the local Verdaccio registry.
 *
 * Run via `npm run dev:publish`. Publishes the package as
 * <version>-build.<git-short-hash> with the `dev` dist-tag, so every commit is
 * a fresh version (no manual bumping, no republish conflicts).
 *
 * Steps:
 *   1. Read the current version and the short git commit hash.
 *   2. Temporarily rewrite package.json with the dev version.
 *   3. `npm publish` to http://localhost:4873/ using a throwaway anonymous
 *      token (Verdaccio allows anonymous publishing, but npm still requires
 *      some token — see verdaccio/config.yaml).
 *   4. Always restore package.json and remove the temp token in `finally`,
 *      so the working tree is left untouched even if publishing fails.
 */

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY = "http://localhost:4873/";
const DIST_TAG = "dev";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const original = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(original);

const hash = execSync("git rev-parse --short HEAD").toString().trim();
const devVersion = `${pkg.version}-build.${hash}`;

// Throwaway userconfig carrying an anonymous publish token for localhost only.
const tmpDir = mkdtempSync(join(tmpdir(), "usecase-publish-"));
const userconfig = join(tmpDir, ".npmrc");
writeFileSync(userconfig, `//localhost:4873/:_authToken=dev-anonymous\n`);

try {
	pkg.version = devVersion;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

	console.log(`Publishing ${pkg.name}@${devVersion} to ${REGISTRY} (tag: ${DIST_TAG})`);
	execSync(`npm publish --registry ${REGISTRY} --tag ${DIST_TAG} --userconfig "${userconfig}"`, {
		stdio: "inherit",
	});
} finally {
	// Restore the original package.json exactly, and drop the temp config.
	writeFileSync(pkgPath, original);
	rmSync(tmpDir, { recursive: true, force: true });
}
