import type { ZodError, ZodSafeParseResult, ZodType } from "zod";

/**
 * Type-safe interface for Zod Validator with generic support.
 * This wraps the zod to provide proper type inference
 * for validated data based on the TInput type parameter.
 */
export interface IValidator<TInput = unknown> {
	validate(data: TInput): Promise<TInput | false>;
	getErrors(): ZodError<TInput> | null;
	prepare(): this;
}

export class Validator<TInput = unknown> implements IValidator<TInput> {
	private validationResult?: ZodSafeParseResult<TInput>;
	private rules: ZodType;

	constructor(rules: ZodType) {
		this.rules = rules;
	}

	async validate(data: TInput): Promise<TInput | false> {
		this.validationResult = (await this.rules.safeParseAsync(data)) as ZodSafeParseResult<TInput>;

		if (this.validationResult.success) {
			return this.validationResult.data;
		}

		return false;
	}

	getErrors(): ZodError<TInput> | null {
		if (this.validationResult?.error) {
			return this.validationResult.error;
		}

		return null;
	}

	prepare(): this {
		// do some stuff
		return this;
	}
}
