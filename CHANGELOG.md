# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-06-11

First stable release.

### Added

- `ServiceBase<TValidParams, TServiceResult>` abstract class with the
  `run → validate → checkPermissions → aroundExecute → execute → onSuccess | onError`
  execution pipeline.
- `validate()` and `validateWithRules()` for Zod-based input validation; the
  per-subclass validator is cached on the constructor, while `validateWithRules()`
  intentionally bypasses the cache.
- `aroundExecute()` wrapping seam for cross-cutting concerns (transactions, retries).
- `onSuccess()` / `onError()` lifecycle hooks, each receiving a `RunContext`
  (raw input, validated data, start/end time, `executionTimeMs`).
- `ServiceError<T>` carrying structured field-level `fields`, a `code`
  (default `'VALIDATION_ERROR'`), automatic `ZodError` conversion, and `toObject()`
  serialization.
- `Validator<TInput>` / `IValidator<TInput>` wrapper around `ZodType`.
- Runtime guards that throw when `execute()` or `checkPermissions()` is missing,
  for plain-JavaScript callers.
- Dual ESM + CommonJS builds with bundled `.d.ts` / `.d.cts` type declarations.
- `zod@^4` declared as a peer dependency and marked external in the build, so the
  package and the host app share a single Zod instance.

[1.0.0]: https://github.com/oskorokhod/usecase/releases/tag/v1.0.0
