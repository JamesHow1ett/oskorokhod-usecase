import { ZodError } from "zod";

/**
 * Error class for validation and business logic errors.
 * Contains structured field-level errors and an error code.
 *
 * @example
 * ```typescript
 * // Validation error (default code)
 * throw new ServiceError({ fields: { email: 'REQUIRED' } });
 *
 * // Business logic error with custom code
 * throw new ServiceError({ code: 'NOT_FOUND', fields: { id: 'WRONG_ID' } });
 * ```
 */
export class ServiceError<T> extends Error {
	#fields: Record<string, unknown>;
	#code: string;

	/**
	 * Creates a ServiceError with optional ZodError or field mapping
	 *
	 * @param options - Error options
	 * @param options.fields - ZodError instance or object mapping field names to error codes
	 * @param options.code - Error type code (defaults to 'VALIDATION_ERROR')
	 */
	constructor({
		fields,
		code = "VALIDATION_ERROR",
	}: {
		fields: ZodError<T> | Record<string, unknown>;
		code?: string;
	}) {
		// Convert ZodError to plain object if needed
		const fieldsObject =
			fields instanceof ZodError ? ServiceError.zodErrorToObject(fields) : fields;

		const fieldKeys = Object.keys(fieldsObject);
		super(`${code}: ${fieldKeys.join(", ") || "validation failed"}`);

		if (typeof fieldsObject !== "object" || fieldsObject === null) {
			throw new Error("'fields' must be a non-null object");
		}
		if (typeof code !== "string" || !code) {
			throw new Error("'code' must be a non-empty string");
		}

		this.#fields = fieldsObject;
		this.#code = code;
	}

	/** Error type code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND', 'PERMISSION_DENIED') */
	public get code(): string {
		return this.#code;
	}

	/** Object mapping field names to their error codes */
	public get fields(): Record<string, unknown> {
		return this.#fields;
	}

	/** Convert to plain object for JSON serialization */
	public toObject(): { fields: Record<string, unknown>; code: string } {
		return { fields: this.fields, code: this.code };
	}

	/**
	 * Converts a ZodError to a plain object mapping field paths to error codes
	 *
	 * @param error - The ZodError to convert
	 * @returns Object with field paths as keys and error codes as values
	 */
	private static zodErrorToObject(error: ZodError): Record<string, unknown> {
		const fieldsMap: Record<string, unknown> = {};
		error.issues.forEach((err) => {
			const path = err.path.join(".");
			fieldsMap[path] = err.code;
		});
		return fieldsMap;
	}
}
