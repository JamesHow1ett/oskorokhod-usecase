import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ZodType } from "zod";
import { ServiceBase } from "../src/service-base";
import { ServiceError } from "../src/service-error";

describe("ServiceBase pipeline", () => {
	it("runs validate → checkPermissions → execute → onSuccess in order", async () => {
		const calls: string[] = [];

		class Svc extends ServiceBase<{ name: string }, { greeting: string }> {
			static validation = z.object({ name: z.string() });

			protected async checkPermissions(): Promise<boolean> {
				calls.push("checkPermissions");
				return true;
			}

			protected async execute(data: { name: string }): Promise<{ greeting: string }> {
				calls.push("execute");
				return { greeting: `hi ${data.name}` };
			}

			protected override async onSuccess(): Promise<void> {
				calls.push("onSuccess");
			}
		}

		const result = await new Svc().run({ name: "ada" });
		expect(result).toEqual({ greeting: "hi ada" });
		expect(calls).toEqual(["checkPermissions", "execute", "onSuccess"]);
	});

	it("throws ServiceError with field map on validation failure", async () => {
		class Svc extends ServiceBase<{ email: string }, void> {
			static validation = z.object({ email: z.email() });
			protected async checkPermissions(): Promise<boolean> {
				return true;
			}
			protected async execute(): Promise<void> {}
		}

		await expect(new Svc().run({ email: "not-an-email" })).rejects.toBeInstanceOf(ServiceError);

		try {
			await new Svc().run({ email: "not-an-email" });
		} catch (err) {
			const se = err as ServiceError<unknown>;
			expect(se.code).toBe("VALIDATION_ERROR");
			expect(se.fields).toHaveProperty("email");
		}
	});

	it("passes through when no validation schema is set", async () => {
		class Svc extends ServiceBase<unknown, string> {
			protected async checkPermissions(): Promise<boolean> {
				return true;
			}
			protected async execute(data: unknown): Promise<string> {
				return typeof data;
			}
		}
		await expect(new Svc().run(undefined)).resolves.toBe("object");
	});

	it("aroundExecute wraps execute and can short-circuit / decorate", async () => {
		const order: string[] = [];

		class Svc extends ServiceBase<{ n: number }, number> {
			static validation = z.object({ n: z.number() });
			protected async checkPermissions(): Promise<boolean> {
				return true;
			}
			protected override async aroundExecute(
				data: { n: number },
				proceed: (d: { n: number }) => Promise<number>,
			): Promise<number> {
				order.push("before");
				const r = await proceed(data);
				order.push("after");
				return r * 10;
			}
			protected async execute(data: { n: number }): Promise<number> {
				order.push("execute");
				return data.n;
			}
		}

		const result = await new Svc().run({ n: 5 });
		expect(result).toBe(50);
		expect(order).toEqual(["before", "execute", "after"]);
	});

	it("validateWithRules validates ad-hoc and throws ServiceError on failure", async () => {
		class Svc extends ServiceBase<unknown, unknown> {
			protected async checkPermissions(): Promise<boolean> {
				return true;
			}
			protected async execute(): Promise<unknown> {
				return null;
			}
			public callValidate<T>(data: unknown, rules: ZodType) {
				return this.validateWithRules<T>(data, rules);
			}
		}

		const svc = new Svc();
		await expect(svc.callValidate({ id: 1 }, z.object({ id: z.number() }))).resolves.toEqual({
			id: 1,
		});
		await expect(
			svc.callValidate({ id: "x" }, z.object({ id: z.number() })),
		).rejects.toBeInstanceOf(ServiceError);
	});

	it("invokes onError and rethrows when execute throws", async () => {
		let captured: unknown = null;

		class Svc extends ServiceBase<unknown, void> {
			protected async checkPermissions(): Promise<boolean> {
				return true;
			}
			protected async execute(): Promise<void> {
				throw new Error("boom");
			}
			protected override async onError(error: unknown): Promise<void> {
				captured = error;
			}
		}

		await expect(new Svc().run({})).rejects.toThrow("boom");
		expect(captured).toBeInstanceOf(Error);
	});

	it("rejects a non-object validation schema at runtime", async () => {
		class Svc extends ServiceBase<unknown, void> {
			// intentionally invalid schema for the JS-caller guard
			static override validation = "nope" as unknown as never;
			protected async checkPermissions(): Promise<boolean> {
				return true;
			}
			protected async execute(): Promise<void> {}
		}
		await expect(new Svc().run({})).rejects.toThrow(/validation must be a non-null object/);
	});
});
