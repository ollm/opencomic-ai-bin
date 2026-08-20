import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
	{
		input: 'src/index.mts',
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
		input: 'src/calculate-latency.mts',
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
		input: 'src/test-yolo.mts',
		output: [
			{
				file: 'dist/test-yolo.mjs',
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
		input: 'src/test-keep-big-halftone.mts',
		output: [
			{
				file: 'dist/test-keep-big-halftone.mjs',
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
		input: 'src/test-panels.mts',
		output: [
			{
				file: 'dist/test-panels.mjs',
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
		input: 'src/index.mts',
		output: {
			file: 'dist/index.d.ts',
			format: 'es',
		},
		plugins: [dts()],
	},
];