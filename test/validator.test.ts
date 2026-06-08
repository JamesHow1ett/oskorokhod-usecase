import { describe, it, expect } from "vitest";
import { z } from "zod";
import { Validator } from "../src/validator";

describe("Validator", () => {
	it("returns parsed data on success", async () => {
		const v = new Validator<{ id: number }>(z.object({ id: z.number() }));
		await expect(v.validate({ id: 1 })).resolves.toEqual({ id: 1 });
		expect(v.getErrors()).toBeNull();
	});

	it("returns false and exposes a ZodError on failure", async () => {
		const v = new Validator<{ id: number }>(z.object({ id: z.number() }));
		const result = await v.validate({ id: "nope" } as unknown as {
			id: number;
		});
		expect(result).toBe(false);
		const errors = v.getErrors();
		expect(errors).not.toBeNull();
		expect(errors?.issues.length).toBeGreaterThan(0);
	});

	it("getErrors is null before any validate call", () => {
		const v = new Validator(z.object({}));
		expect(v.getErrors()).toBeNull();
	});

	it("prepare returns this for chaining", () => {
		const v = new Validator(z.object({}));
		expect(v.prepare()).toBe(v);
	});
});
