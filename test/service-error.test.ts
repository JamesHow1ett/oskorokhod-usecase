import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ServiceError } from "../src/service-error";

describe("ServiceError", () => {
	it("defaults code to VALIDATION_ERROR", () => {
		const err = new ServiceError({ fields: { email: "REQUIRED" } });
		expect(err.code).toBe("VALIDATION_ERROR");
		expect(err.fields).toEqual({ email: "REQUIRED" });
	});

	it("accepts a custom code", () => {
		const err = new ServiceError({
			code: "NOT_FOUND",
			fields: { id: "WRONG_ID" },
		});
		expect(err.code).toBe("NOT_FOUND");
		expect(err.message).toContain("NOT_FOUND");
	});

	it("converts a real ZodError into a path→code field map (peer-zod instanceof path)", () => {
		const schema = z.object({ email: z.email(), age: z.number() });
		const parsed = schema.safeParse({ email: "nope", age: "x" });
		expect(parsed.success).toBe(false);
		if (parsed.success) return;

		const err = new ServiceError({ fields: parsed.error });
		expect(err.fields).toHaveProperty("email");
		expect(err.fields).toHaveProperty("age");
		// values are zod issue codes, not raw issue objects
		expect(typeof err.fields.email).toBe("string");
	});

	it("toObject returns a JSON-serializable shape", () => {
		const err = new ServiceError({ code: "X", fields: { a: "b" } });
		expect(err.toObject()).toEqual({ code: "X", fields: { a: "b" } });
		expect(JSON.parse(JSON.stringify(err.toObject()))).toEqual({
			code: "X",
			fields: { a: "b" },
		});
	});

	it("is an instanceof Error", () => {
		expect(new ServiceError({ fields: {} })).toBeInstanceOf(Error);
	});
});
