import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // zod is a peer dependency: never inline it. ServiceError relies on
  // `instanceof ZodError` against the CONSUMER's zod, so the package must
  // share the consumer's single zod copy rather than bundle its own.
  external: ['zod'],
});
