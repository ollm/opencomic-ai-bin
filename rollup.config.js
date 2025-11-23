import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
	{
		input: 'index.mts',
		output: [
			{
				file: 'dist/index.cjs',
				format: 'cjs',
			},
			{
				file: 'dist/index.mjs',
				format: 'es',
			},
		],
		plugins: [
			typescript({
				tsconfig: './tsconfig.json',
				declaration: false,
			}),
		],
	},
	{
		input: 'calculate-latency.mts',
		output: [
			{
				file: 'dist/calculate-latency.mjs',
				format: 'es',
			},
		],
		plugins: [
			typescript({
				tsconfig: './tsconfig.json',
				declaration: false,
			}),
		],
	},
	{
		input: 'index.mts',
		output: {
			file: 'dist/index.d.ts',
			format: 'es',
		},
		plugins: [dts()],
	},
];