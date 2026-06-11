import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
	{ ignores: ["dist", "node_modules"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	// Node scripts and config files run in the Node.js runtime.
	{
		files: ["scripts/**/*.{js,mjs,cjs}", "*.{js,mjs,cjs}"],
		languageOptions: {
			globals: globals.node,
		},
	},
	prettier,
);
