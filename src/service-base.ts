/* eslint-disable @typescript-eslint/no-unused-vars */
// Disabling unused-vars due to it's base class implementation and vars should be used in subclasses

import type { ZodType } from "zod";
import { ServiceError } from "./service-error";
import { Validator } from "./validator";
import type { IValidator } from "./validator";

/**
 * Context object passed to lifecycle hooks (onSuccess, onError).
 * Contains timing information and both raw and validated data.
 */
export interface RunContext<TValidParams = unknown> {
	/** Original unvalidated input data */
	inputData: unknown;
	/** Validated and cleaned data (null if validation failed) */
	cleanData: TValidParams | null;
	/** When run() was called */
	startTime: Date;
	/** When execution completed (null if still running or failed) */
	endTime: Date | null;
	/** Execution duration in milliseconds */
	executionTimeMs: number | null;
}

/**
 * Abstract base class for building service layers with Zod validation.
 *
 * Execution flow: run() → validate() → checkPermissions() → aroundExecute() → execute() → onSuccess/onError
 *
 * @template TValidParams - Type of validated input data
 * @template TServiceResult - Type of service result
 *
 * @example
 * ```typescript
 * class UsersCreate extends ServiceBase<{ email: string }, { userId: string }> {
 *   static validation = { email: ['required', 'email'] };
 *
 *   async checkPermissions(data) { return true; }
 *   async execute(data) { return { userId: '123' }; }
 * }
 *
 * const result = await new UsersCreate().run({ email: 'user@example.com' });
 * ```
 */
export abstract class ServiceBase<TValidParams = unknown, TServiceResult = unknown> {
	/** Zod validation rules. Override in subclass. Validators are cached per class. */
	static validation?: ZodType;

	/**
	 * Main entry point. Validates input, checks permissions, executes business logic.
	 *
	 * @param inputData - Raw input data to validate and process
	 * @returns Promise resolving to the service result
	 * @throws {ServiceError} On validation failure or business logic errors
	 */
	public async run(inputData: unknown): Promise<TServiceResult> {
		// Runtime checks for JavaScript users
		if (typeof this.execute !== "function") {
			throw new Error(`${this.constructor.name}: execute() must be implemented`);
		}
		if (typeof this.checkPermissions !== "function") {
			throw new Error(`${this.constructor.name}: checkPermissions() must be implemented`);
		}

		const startTime = new Date();
		const context: RunContext<TValidParams> = {
			inputData,
			cleanData: null,
			startTime,
			endTime: null,
			executionTimeMs: null,
		};

		try {
			const cleanData = await this.validate(inputData);
			context.cleanData = cleanData;

			await this.checkPermissions(cleanData);

			const result = await this.aroundExecute(cleanData, (data) => this.execute(data));

			context.endTime = new Date();
			context.executionTimeMs = context.endTime.getTime() - startTime.getTime();
			await this.onSuccess(result, context);

			return result;
		} catch (error) {
			await this.onError(error, context);
			throw error;
		}
	}

	public async validate(data: unknown): Promise<TValidParams> {
		const ctor = this.constructor as typeof ServiceBase & {
			__validator?: IValidator;
		};
		const validation = ctor.validation;

		if (validation !== undefined && (typeof validation !== "object" || validation === null)) {
			throw new Error(`${this.constructor.name}: validation must be a non-null object`);
		}

		if (!validation) {
			return (data ?? {}) as TValidParams;
		}

		if (!ctor.__validator) {
			ctor.__validator = new Validator(validation) as IValidator;
		}

		return await this.doValidationWithValidator(data, ctor.__validator as IValidator<TValidParams>);
	}

	/**
	 * Validate data with custom rules. Use for dynamic or multi-step validation.
	 * Unlike the static validation property, this creates a new validator each call.
	 *
	 * @template T - Expected type of validated data
	 * @param data - Data to validate
	 * @param rules - Zod schema object
	 * @returns Validated and cleaned data
	 * @throws {ServiceError} On validation failure
	 */
	public validateWithRules<T = unknown>(data: unknown, rules: ZodType): Promise<T> {
		if (!rules || typeof rules !== "object") {
			throw new Error("validateWithRules: rules must be a non-null object");
		}

		const validator = new Validator(rules) as IValidator<T>;
		return this.doValidationWithValidator(data, validator);
	}

	private async doValidationWithValidator<T>(data: unknown, validator: IValidator<T>): Promise<T> {
		const validData = await validator.validate(data as T);
		if (validData) {
			return validData;
		}
		throw new ServiceError({ fields: validator.getErrors() ?? {} });
	}

	/**
	 * Wraps execute() to add cross-cutting concerns like transactions, retries, etc.
	 * Override in intermediate base classes to add wrapping behavior.
	 * Call super.aroundExecute() to chain multiple wrappers.
	 *
	 * @param cleanData - Validated input data
	 * @param proceed - Function that calls execute() - invoke this to run business logic
	 * @returns Promise resolving to the service result
	 *
	 * @example
	 * ```typescript
	 * protected override async aroundExecute(data, proceed) {
	 *   return this.db.withTransaction(() => super.aroundExecute(data, proceed));
	 * }
	 * ```
	 */
	protected async aroundExecute(
		cleanData: TValidParams,
		proceed: (data: TValidParams) => Promise<TServiceResult>,
	): Promise<TServiceResult> {
		return proceed(cleanData);
	}

	/**
	 * Business logic implementation. Override in concrete service classes.
	 *
	 * @param cleanData - Validated input data
	 * @returns Promise resolving to the service result
	 */
	protected abstract execute(cleanData: TValidParams): Promise<TServiceResult>;

	/**
	 * Check if the current user has the necessary permissions to execute the service.
	 * Override in concrete service classes to implement custom permission logic.
	 *
	 * @param cleanData - Validated input data
	 * @returns Promise resolving to a boolean indicating if the user has permission
	 * @throws {ServiceError} If permission is denied
	 */
	protected abstract checkPermissions(cleanData: TValidParams): Promise<boolean>;

	protected async onSuccess(
		result: TServiceResult,
		context: RunContext<TValidParams>,
	): Promise<void> {
		// Override in subclass
	}

	protected async onError(error: unknown, context: RunContext<TValidParams>): Promise<void> {
		// Override in subclass
	}
}
