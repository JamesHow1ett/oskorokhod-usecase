# @oskorokhod/usecase

> Reusable, Zod-validated service-layer building blocks: a `ServiceBase` execution pipeline, a structured `ServiceError`, and a thin `Validator` wrapper.

`@oskorokhod/usecase` extracts the service/validation core into a framework-agnostic package. It has **no dependency on Fastify or any HTTP layer** — drop it into any Node project that uses [Zod](https://zod.dev) for validation.

## What it is

`@oskorokhod/usecase` is a tiny toolkit for writing **service-layer objects** (a.k.a. interactors / command objects) with **Zod-validated input** and a single, predictable execution pipeline. It ships three building blocks:

- **`ServiceBase<TValidParams, TServiceResult>`** — an abstract class that runs every call through a fixed sequence (`run → validate → checkPermissions → aroundExecute → execute → onSuccess | onError`). You implement `execute()` (business logic) and `checkPermissions()` (authorization); everything else is provided with sensible defaults.
- **`ServiceError<T>`** — a real `instanceof Error` carrying a structured, field-level error map and a `code` (default `'VALIDATION_ERROR'`), with `.toObject()` for JSON responses. Zod errors are auto-converted to a `path → issue-code` map.
- **`Validator<TInput>` / `IValidator<TInput>`** — a thin wrapper over a `ZodType`; `validate()` returns parsed data or `false`, `getErrors()` returns the last `ZodError`.

## When to use it

Reach for `@oskorokhod/usecase` when you want to:

- Keep business logic out of controllers/route handlers and in small, testable units.
- Validate-then-act with a **consistent contract**: validation failures always surface as a `ServiceError` with structured `fields`, never as ad-hoc thrown values.
- Standardize cross-cutting concerns (transactions, retries, logging, timing) through one seam — `aroundExecute()` — instead of scattering them across call sites.
- Get end-to-end TypeScript types inferred from your Zod schema, while still being safe to call from plain JavaScript (runtime guards check that the required hooks exist).

It is **not** an HTTP framework, ORM, or DI container — it is the thin service/validation core you drop into whatever stack you already use.

## How to use it

```bash
npm install @oskorokhod/usecase zod
```

`zod` is a **peer dependency** (`^4`) — see [Why zod is a peer dependency](#why-zod-is-a-peer-dependency). You install it yourself so the package shares your single copy.

Ships ESM + CommonJS + type declarations. Importable from both:

```ts
import { ServiceBase, ServiceError, Validator } from "@oskorokhod/usecase"; // ESM
```

```js
const { ServiceBase, ServiceError, Validator } = require("@oskorokhod/usecase"); // CJS
```

## Quick start

Use `@oskorokhod/usecase` in two steps:

1. **Create one app-specific base class** that extends `ServiceBase`. This is where you centralize cross-cutting concerns shared by every service — transactions/retries via `aroundExecute`, error logging via `onError`, a default `checkPermissions` policy, and so on. You write this once.
2. **Create each service** by extending that base class and implementing the business logic (`execute`), overriding only the hooks that service needs.

### Step 1 — your app base class (write once)

```ts
import { ServiceBase } from "@oskorokhod/usecase";

// Keep the generics open so each concrete service supplies its own types.
abstract class AppService<TValidParams = unknown, TServiceResult = unknown> extends ServiceBase<
	TValidParams,
	TServiceResult
> {
	// Shared cross-cutting concerns for every service in your app.
	protected async aroundExecute(
		cleanData: TValidParams,
		proceed: (data: TValidParams) => Promise<TServiceResult>,
	): Promise<TServiceResult> {
		// e.g. wrap in a transaction, timing, retries...
		return proceed(cleanData);
	}

	// Default permission policy; override per service to restrict.
	protected async checkPermissions(): Promise<boolean> {
		return true; // throw a ServiceError to deny
	}

	protected async onError(error: unknown): Promise<void> {
		console.error("service failed", error);
	}
}
```

### Step 2 — a concrete service

```ts
import { z } from "zod";
import { ServiceError } from "@oskorokhod/usecase";

class CreateUser extends AppService<{ email: string }, { userId: string }> {
	static validation = z.object({ email: z.email() });

	protected async execute(data: { email: string }): Promise<{ userId: string }> {
		return { userId: crypto.randomUUID() };
	}
}

const result = await new CreateUser().run({ email: "user@example.com" });

try {
	await new CreateUser().run({ email: "not-an-email" });
} catch (err) {
	if (err instanceof ServiceError) {
		console.log(err.code); // 'VALIDATION_ERROR'
		console.log(err.fields); // { email: 'invalid_format' }
	}
}
```

## The pipeline

`run(inputData)` drives every service through a fixed sequence:

```
run() → validate() → checkPermissions() → aroundExecute() → execute() → onSuccess | onError
```

| Hook                                | Required?    | Purpose                                                                                                                                             |
| ----------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static validation`                 | optional     | A Zod schema. If set, input is validated and a `Validator` is **cached per subclass** (`__validator` on the constructor).                           |
| `validate(data)`                    | provided     | Runs the cached validator; throws `ServiceError` with `fields` on failure. Returns `data ?? {}` when no schema is set.                              |
| `checkPermissions(cleanData)`       | **abstract** | Implement authorization. Throw `ServiceError` to deny.                                                                                              |
| `aroundExecute(cleanData, proceed)` | optional     | Wrapping seam for cross-cutting concerns (transactions, retries). Override and call `proceed(cleanData)`; call `super.aroundExecute(...)` to chain. |
| `execute(cleanData)`                | **abstract** | Business logic.                                                                                                                                     |
| `onSuccess(result, context)`        | optional     | Called after success with a `RunContext` (timing + raw/clean data).                                                                                 |
| `onError(error, context)`           | optional     | Called on any thrown error, then the error is re-thrown.                                                                                            |

`run()` also includes runtime guards (for plain-JS callers) that throw if `execute`/`checkPermissions` are missing.

### Ad-hoc validation

For dynamic or per-call rules, use `validateWithRules` — it does **not** use the per-subclass cache:

```ts
const clean = await this.validateWithRules<{ id: number }>(input, z.object({ id: z.number() }));
```

## API

- **`ServiceBase<TValidParams, TServiceResult>`** — abstract base class (the pipeline above).
- **`RunContext<TValidParams>`** — `{ inputData, cleanData, startTime, endTime, executionTimeMs }` passed to lifecycle hooks.
- **`ServiceError<T>`** — `extends Error`. Constructed with `{ fields, code? }` where `fields` is a `ZodError` (auto-converted to a path→issue-code map) or a plain record. Exposes `.code` (default `'VALIDATION_ERROR'`), `.fields`, and `.toObject()` for JSON serialization.
- **`Validator<TInput>` / `IValidator<TInput>`** — wraps a `ZodType`; `validate(data)` returns the parsed data or `false`, `getErrors()` returns the last `ZodError` (or `null`), `prepare()` is a chainable no-op reserved for future setup.

## Gotchas

- **`Validator.validate()` returns `false` on failure, it does not throw.** `ServiceBase` translates that `false` into a `ServiceError`. Preserve this contract if you use `Validator` directly — callers may branch on the boolean.
- **`getErrors()` is only meaningful after a failed `validate()` call** (it returns the last result's `ZodError`, else `null`).
- **The validator is cached on the subclass constructor** as `__validator`. Don't mutate how rules attach in a way that invalidates this cache. `validateWithRules` intentionally bypasses it.
- **`aroundExecute` is the only intended extension seam** for transactions/retries — override it, don't wrap `run()`.
- **`ServiceError` extends `Error`** and uses private fields (`#fields`, `#code`); it is a real `instanceof Error`.

## Why zod is a peer dependency

`ServiceError` detects Zod errors with `fields instanceof ZodError`, and the `ZodError` instances it receives are produced by **your** schemas. If this package bundled its own copy of zod, that `instanceof` check would compare against a _different_ `ZodError` class and silently fail — your structured `fields` would not be extracted.

Declaring `zod` as a peer dependency (and marking it `external` in the build) guarantees the package and your app share **one** zod instance. Always install `zod@^4` alongside this package.

## Local registry (Verdaccio)

For local development and pre-release testing you can publish to a local [Verdaccio](https://verdaccio.org) registry instead of the public npm one. It runs as a Docker container — the only prerequisite is Docker, no global Verdaccio install needed.

The registry is defined in [`docker-compose.yml`](./docker-compose.yml) and configured by [`verdaccio/config.yaml`](./verdaccio/config.yaml) (anonymous install **and** publish, with everything else proxied/cached from the public npm registry). Package data persists in the `verdaccio-storage` Docker volume.

```bash
# 1. Start the registry (http://localhost:4873). One-time per machine boot.
npm run registry:up

# 2. Run all checks, then publish a commit-pinned dev build to the local registry.
#    Version becomes <version>-build.<git-short-hash> (e.g. 1.0.0-build.77e080f),
#    so every commit is a fresh version — no manual bumping, no republish conflicts.
#    package.json is restored automatically; your working tree is left untouched.
npm run dev:publish

# 3. Consume the dev build from any project:
npm install @oskorokhod/usecase@dev zod@^4 --registry http://localhost:4873/

# Stop the registry when done (data persists; add `-v` to docker compose down to wipe).
npm run registry:down
```

> The published dev build carries the `dev` dist-tag. Install it as `@oskorokhod/usecase@dev`, or pin the exact `@oskorokhod/usecase@1.0.0-build.<hash>`. Production releases go to the public npm registry separately (`npm publish`).

## Scripts

| Script                  | Purpose                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run build`         | Bundle ESM + CJS + `.d.ts`/`.d.cts` via tsup                                                             |
| `npm run typecheck`     | `tsc --noEmit`                                                                                           |
| `npm test`              | Run the vitest suite                                                                                     |
| `npm run check:exports` | Validate the types/exports matrix with `@arethetypeswrong/cli`                                           |
| `npm run check:publish` | Lint the publish surface with `publint`                                                                  |
| `npm run check`         | Run the full pre-publish gate (typecheck → lint → format → test → build → exports → publish)             |
| `npm run registry:up`   | Start the local Verdaccio registry (Docker) on port 4873                                                 |
| `npm run registry:down` | Stop the local Verdaccio registry                                                                        |
| `npm run dev:publish`   | Run `check`, then publish a commit-pinned dev build to the local registry                                |
| `npm run release`       | Run `check`, then publish a production release to the public npm registry (uses `NPM_TOKEN` from `.env`) |

## Acknowledgements

`@oskorokhod/usecase` is inspired by [chista](https://www.npmjs.com/package/chista) — a minimal, framework-agnostic base class for building clean service layers. `@oskorokhod/usecase` follows the same service/use-case philosophy, swapping chista's [LIVR](https://livr-spec.org) validation for [Zod](https://zod.dev) and end-to-end TypeScript inference.

## License

ISC.
