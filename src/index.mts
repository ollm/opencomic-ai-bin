import p from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import panels from './panels.mjs';
import keepBigHalftone from './descreen/keep-big-halftone.mjs';

const ___dirname = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;

export type Formats =
	| 'bmp'
	| 'dib'
	| 'exr'
	| 'hdr'
	| 'jpe'
	| 'jpeg'
	| 'jpg'
	| 'pbm'
	| 'pgm'
	| 'pic'
	| 'png'
	| 'pnm'
	| 'ppm'
	| 'pxm'
	| 'ras'
	| 'sr'
	| 'tif'
	| 'tiff'
	| 'webp';

export type ModelType = 'upscale' | 'descreen' | 'descreen-mask' | 'artifact-removal' | 'panels';
export type Upscaler = 'realcugan' | 'waifu2x' | 'upscayl';
export type Speed = 'Very Fast' | 'Fast' | 'Medium' | 'Slow' | 'Very Slow';

export interface UpscalerObject {
	name: string;
	binary: string;
	platforms: Partial<Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, string>>>>;
}

const upscalers: Record<Upscaler, UpscalerObject> = {
	realcugan: {
		name: 'RealCUGAN NCNN Vulkan',
		binary: 'realcugan-ncnn-vulkan',
		platforms: {
			darwin: {
				x64: 'mac/x64/realcugan/realcugan-ncnn-vulkan.app',
				arm64: 'mac/arm64/realcugan/realcugan-ncnn-vulkan.app',
			},
			win32: {
				x64: 'win/x64/realcugan/realcugan-ncnn-vulkan.exe',
			},
			linux: {
				x64: 'linux/x64/realcugan/realcugan-ncnn-vulkan',
				arm64: 'linux/arm64/realcugan/realcugan-ncnn-vulkan',
			},
		},
	},
	waifu2x: {
		name: 'Waifu2x NCNN Vulkan',
		binary: 'waifu2x-ncnn-vulkan',
		platforms: {
			darwin: {
				x64: 'mac/x64/waifu2x/waifu2x-ncnn-vulkan.app',
				arm64: 'mac/arm64/waifu2x/waifu2x-ncnn-vulkan.app',
			},
			win32: {
				x64: 'win/x64/waifu2x/waifu2x-ncnn-vulkan.exe',
			},
			linux: {
				x64: 'linux/x64/waifu2x/waifu2x-ncnn-vulkan',
				arm64: 'linux/arm64/waifu2x/waifu2x-ncnn-vulkan',
			},
		},
	},
	upscayl: {
		name: 'Upscayl',
		binary: 'upscayl-bin',
		platforms: {
			darwin: {
				x64: 'mac/x64/upscayl/upscayl-bin.app',
				arm64: 'mac/arm64/upscayl/upscayl-bin.app',
			},
			win32: {
				x64: 'win/x64/upscayl/upscayl-bin.exe',
				arm64: 'win/arm64/upscayl/upscayl-bin.exe',
			},
			linux: {
				x64: 'linux/x64/upscayl/upscayl-bin',
				arm64: 'linux/arm64/upscayl/upscayl-bin',
			},
		},
	},
}

export interface ModelObject {
	key?: Model,
	name: string;
	upscaler: Upscaler;
	type?: ModelType;
	tileSize?: number;
	tileSizeFromMem128?: number; // Model memory usage in MB measured at tile=128 for auto tile estimation
	scales: number[];
	noise: number[] | undefined;
	latency: number;
	speed?: Speed;
	folder: string;
	path?: string;
	files: string[];
	scaleFiles?: Record<number, Model>;
	supportCurrentPlatform?: boolean;
}

let models: Record<ModelType, Record<string, ModelObject>> = {
	upscale: {
		'opencomic-ai-upscale-compact': {
			name: 'OpenComic AI Upscale Compact',
			upscaler: 'upscayl',
// 			tileSize: 128,
			scales: [2, 3, 4],
			noise: undefined,
			latency: 0.63,
			folder: './models',
			files: [
				'opencomic-ai-upscale-2x-compact.bin',
				'opencomic-ai-upscale-2x-compact.param',
				'opencomic-ai-upscale-3x-compact.bin',
				'opencomic-ai-upscale-3x-compact.param',
				'opencomic-ai-upscale-4x-compact.bin',
				'opencomic-ai-upscale-4x-compact.param',
			],
			scaleFiles: {
				2: 'opencomic-ai-upscale-2x-compact',
				3: 'opencomic-ai-upscale-3x-compact',
				4: 'opencomic-ai-upscale-4x-compact',
			},
		},
		'opencomic-ai-upscale-lite': {
			name: 'OpenComic AI Upscale Lite',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 2.59,
			folder: './models',
			files: [
				'opencomic-ai-upscale-2x-lite.bin',
				'opencomic-ai-upscale-2x-lite.param',
				'opencomic-ai-upscale-3x-lite.bin',
				'opencomic-ai-upscale-3x-lite.param',
				'opencomic-ai-upscale-4x-lite.bin',
				'opencomic-ai-upscale-4x-lite.param',
			],
			scaleFiles: {
				2: 'opencomic-ai-upscale-2x-lite',
				3: 'opencomic-ai-upscale-3x-lite',
				4: 'opencomic-ai-upscale-4x-lite',
			},
		},
		'opencomic-ai-upscale': {
			name: 'OpenComic AI Upscale',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 8.36,
			folder: './models',
			files: [
				'opencomic-ai-upscale-2x.bin',
				'opencomic-ai-upscale-2x.param',
				'opencomic-ai-upscale-3x.bin',
				'opencomic-ai-upscale-3x.param',
				'opencomic-ai-upscale-4x.bin',
				'opencomic-ai-upscale-4x.param',
			],
			scaleFiles: {
				2: 'opencomic-ai-upscale-2x',
				3: 'opencomic-ai-upscale-3x',
				4: 'opencomic-ai-upscale-4x',
			},
		},
		/*'realcugan-nose': {
			name: 'RealCUGAN NoSE',
			upscaper: 'realcugan',
			scales: [2],
			noise: [0, 3],
			latency: 0,
			folder: './realcugan/models-nose',
			files: [],
		},
		'realcugan-pro': {
			name: 'RealCUGAN Pro',
			upscaper: 'realcugan',
			scales: [1, 2, 3],
			noise: [0, 3],
			latency: 0,
			folder: './realcugan/models-pro',
			files: [],
		},*/
		'realcugan': {
			name: 'RealCUGAN',
			upscaler: 'realcugan',
			scales: [/*1, */2, 3, 4],
			noise: [0, 3],
			latency: 2.96,
			folder: './realcugan/models-se',
			files: [
				'up2x-conservative.bin',
				'up2x-conservative.param',
				'up2x-denoise1x.bin',
				'up2x-denoise1x.param',
				'up2x-denoise2x.bin',
				'up2x-denoise2x.param',
				'up2x-denoise3x.bin',
				'up2x-denoise3x.param',
				'up2x-no-denoise.bin',
				'up2x-no-denoise.param',
				'up3x-conservative.bin',
				'up3x-conservative.param',
				'up3x-denoise3x.bin',
				'up3x-denoise3x.param',
				'up3x-no-denoise.bin',
				'up3x-no-denoise.param',
				'up4x-conservative.bin',
				'up4x-conservative.param',
				'up4x-denoise3x.bin',
				'up4x-denoise3x.param',
				'up4x-no-denoise.bin',
				'up4x-no-denoise.param',
			],
		},
		'realesr-animevideov3': {
			name: 'RealESR AnimeVideo v3',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 1.36,
			folder: './models',
			files: [
				'realesr-animevideov3-x2.bin',
				'realesr-animevideov3-x2.param',
				'realesr-animevideov3-x3.bin',
				'realesr-animevideov3-x3.param',
				'realesr-animevideov3-x4.bin',
				'realesr-animevideov3-x4.param',
			],
		},
		'realesrgan-x4plus': {
			name: 'RealESRGAN x4 Plus',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.44,
			folder: './models',
			files: [
				'realesrgan-x4plus.bin',
				'realesrgan-x4plus.param',
			],
		},
		'realesrgan-x4plus-anime': {
			name: 'RealESRGAN x4 Plus Anime',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 3.61,
			folder: './models',
			files: [
				'realesrgan-x4plus-anime.bin',
				'realesrgan-x4plus-anime.param',
			],
		},
		'realesrnet-x4plus': {
			name: 'RealESRNet x4 Plus',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.35,
			folder: './models',
			files: [
				'realesrnet-x4plus.bin',
				'realesrnet-x4plus.param',
			],
		},
		'waifu2x-models-cunet': {
			name: 'Waifu2x CUnet',
			upscaler: 'waifu2x',
			scales: [/*1, */2, 4, 8, 16, 32],
			noise: [0, 1, 2, 3],
			latency: 5.2,
			folder: './waifu2x/models-cunet',
			files: [
				'noise0_model.bin',
				'noise0_model.param',
				'noise0_scale2.0x_model.bin',
				'noise0_scale2.0x_model.param',
				'noise1_model.bin',
				'noise1_model.param',
				'noise1_scale2.0x_model.bin',
				'noise1_scale2.0x_model.param',
				'noise2_model.bin',
				'noise2_model.param',
				'noise2_scale2.0x_model.bin',
				'noise2_scale2.0x_model.param',
				'noise3_model.bin',
				'noise3_model.param',
				'noise3_scale2.0x_model.bin',
				'noise3_scale2.0x_model.param',
				'scale2.0x_model.bin',
				'scale2.0x_model.param',
			],
		},
		'waifu2x-models-upconv': {
			name: 'Waifu2x UpConv',
			upscaler: 'waifu2x',
			scales: [/*1, */2, 4, 8, 16, 32],
			noise: [0, 1, 2, 3],
			latency: 2.61,
			folder: './waifu2x/models-upconv_7_anime_style_art_rgb',
			files: [
				'noise0_scale2.0x_model.bin',
				'noise0_scale2.0x_model.param',
				'noise1_scale2.0x_model.bin',
				'noise1_scale2.0x_model.param',
				'noise2_scale2.0x_model.bin',
				'noise2_scale2.0x_model.param',
				'noise3_scale2.0x_model.bin',
				'noise3_scale2.0x_model.param',
				'scale2.0x_model.bin',
				'scale2.0x_model.param',
			],
		},
		'4x-WTP-ColorDS': {
			name: 'WTP ColorDS',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.53,
			folder: './models',
			files: [
				'4x-WTP-ColorDS.bin',
				'4x-WTP-ColorDS.param',
			],
		},
		'remacri-4x': {
			name: 'Remacri',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.84,
			folder: './models',
			files: [
				'remacri-4x.bin',
				'remacri-4x.param',
			],
		},
		'ultramix-balanced-4x': {
			name: 'Ultramix Balanced',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 10,
			folder: './models',
			files: [
				'ultramix-balanced-4x.bin',
				'ultramix-balanced-4x.param',
			],
		},
		'ultrasharp-4x': {
			name: 'Ultrasharp',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.73,
			folder: './models',
			files: [
				'ultrasharp-4x.bin',
				'ultrasharp-4x.param',
			],
		},
		/*'2x-AnimeSharpV4_RCAN_fp16_op17': {
			name: 'AnimeSharpV4 RCAN',
			upscaler: 'upscayl',
			scales: [2],
			noise: undefined,
			latency: 0,
			folder: './models',
			files: [
				'2x-AnimeSharpV4_RCAN_fp16_op17.bin',
				'2x-AnimeSharpV4_RCAN_fp16_op17.param',
			],
		},*/
		'4xInt-RemAnime': {
			name: 'Int-RemAnime',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.46,
			folder: './models',
			files: [
				'4xInt-RemAnime.bin',
				'4xInt-RemAnime.param',
			],
		},
		'AI-Forever_x4plus': {
			name: 'AI-Forever x4plus',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.55,
			folder: './models',
			files: [
				'AI-Forever_x4plus.bin',
				'AI-Forever_x4plus.param',
			],
		},
		'4xNomosWebPhoto_esrgan': {
			name: 'Nomos Web Photo ESRGAN',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.77,
			folder: './models',
			files: [
				'4xNomosWebPhoto_esrgan.bin',
				'4xNomosWebPhoto_esrgan.param',
			],
		},
		'4xHFA2k': {
			name: 'HFA2k',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.69,
			folder: './models',
			files: [
				'4xHFA2k.bin',
				'4xHFA2k.param',
			],
		},
		'4xLSDIRCompactC3': {
			name: 'LSDIR Compact C3',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 1.31,
			folder: './models',
			files: [
				'4xLSDIRCompactC3.bin',
				'4xLSDIRCompactC3.param',
			],
		},
		'4xLSDIRplusC': {
			name: 'LSDIR Plus C',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.51,
			folder: './models',
			files: [
				'4xLSDIRplusC.bin',
				'4xLSDIRplusC.param',
			],
		},
		'4x_NMKD-Siax_200k': {
			name: 'NMKD Siax',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.67,
			folder: './models',
			files: [
				'4x_NMKD-Siax_200k.bin',
				'4x_NMKD-Siax_200k.param',
			],
		},
		'4xNomos8kSC': {
			name: 'Nomos 8k SC',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.58,
			folder: './models',
			files: [
				'4xNomos8kSC.bin',
				'4xNomos8kSC.param',
			],
		},
		'RealESRGAN_General_WDN_x4_v3': {
			name: 'RealESRGAN General WDN v3',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 1.6,
			folder: './models',
			files: [
				'RealESRGAN_General_WDN_x4_v3.bin',
				'RealESRGAN_General_WDN_x4_v3.param',
			],
		},
		'RealESRGAN_General_x4_v3': {
			name: 'RealESRGAN General v3',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 1.35,
			folder: './models',
			files: [
				'RealESRGAN_General_x4_v3.bin',
				'RealESRGAN_General_x4_v3.param',
			],
		},
		'uniscale_restore_x4': {
			name: 'Uniscale Restore x4',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.51,
			folder: './models',
			files: [
				'uniscale_restore_x4.bin',
				'uniscale_restore_x4.param',
			],
		},
		'unknown-2.0.1': {
			name: 'Unknown 2.0.1',
			upscaler: 'upscayl',
			scales: [2, 3, 4],
			noise: undefined,
			latency: 9.87,
			folder: './models',
			files: [
				'unknown-2.0.1.bin',
				'unknown-2.0.1.param',
			],
		},
	},
	descreen: {
		'opencomic-ai-descreen-hard-compact': {
			name: 'OpenComic AI Descreen Hard Compact',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 0.52,
			folder: './models',
			files: [
				'opencomic-ai-descreen-hard-compact.bin',
				'opencomic-ai-descreen-hard-compact.param',
			],
		},
		'opencomic-ai-descreen-hard-lite': {
			name: 'OpenComic AI Descreen Hard Lite',
			upscaler: 'upscayl',
			tileSizeFromMem128: 32, // TODO: Test only for now, need calculate tile size from memory usage for all models
			scales: [1],
			noise: undefined,
			latency: 3,
			folder: './models',
			files: [
				'opencomic-ai-descreen-hard-lite.bin',
				'opencomic-ai-descreen-hard-lite.param',
			],
		},
		'opencomic-ai-descreen-hard': {
			name: 'OpenComic AI Descreen Hard',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 8.67,
			folder: './models',
			files: [
				'opencomic-ai-descreen-hard.bin',
				'opencomic-ai-descreen-hard.param',
			],
		},
		'1x_halftone_patch_060000_G': {
			name: 'Halftone Patch 060000 G',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 8.26,
			folder: './models',
			files: [
				'1x_halftone_patch_060000_G.bin',
				'1x_halftone_patch_060000_G.param',
			],
		},
		'1x_wtp_descreenton_compact': {
			name: 'WTP DescreenTon Compact',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 0.51,
			folder: './models',
			files: [
				'1x_wtp_descreenton_compact.bin',
				'1x_wtp_descreenton_compact.param',
			],
		},
	},
	'artifact-removal': {
		'opencomic-ai-artifact-removal-compact': {
			name: 'OpenComic AI Artifact Removal Compact',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 0.5,
			folder: './models',
			files: [
				'opencomic-ai-artifact-removal-compact.bin',
				'opencomic-ai-artifact-removal-compact.param',
			],
		},
		'opencomic-ai-artifact-removal-lite': {
			name: 'OpenComic AI Artifact Removal Lite',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 2.97,
			folder: './models',
			files: [
				'opencomic-ai-artifact-removal-lite.bin',
				'opencomic-ai-artifact-removal-lite.param',
			],
		},

		'opencomic-ai-artifact-removal': {
			name: 'OpenComic AI Artifact Removal',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 8.21,
			folder: './models',
			files: [
				'opencomic-ai-artifact-removal.bin',
				'opencomic-ai-artifact-removal.param',
			],
		},
		'1x_NMKD-Jaywreck3-Lite_320k': {
			name: 'NMKD Jaywreck3 Lite',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 2.98,
			folder: './models',
			files: [
				'1x_NMKD-Jaywreck3-Lite_320k.bin',
				'1x_NMKD-Jaywreck3-Lite_320k.param',
			],
		},
		'1x_NMKD-Jaywreck3-Soft-Lite_320k': {
			name: 'NMKD Jaywreck3 Soft Lite',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 2.98,
			folder: './models',
			files: [
				'1x_NMKD-Jaywreck3-Soft-Lite_320k.bin',
				'1x_NMKD-Jaywreck3-Soft-Lite_320k.param',
			],
		},
		'1x-SaiyaJin-DeJpeg': {
			name: 'SaiyaJin DeJpeg',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 8.2,
			folder: './models',
			files: [
				'1x-SaiyaJin-DeJpeg.bin',
				'1x-SaiyaJin-DeJpeg.param',
			],
		},
		'1x_JPEGDestroyerV2_96000G': {
			name: 'JPEG Destroyer V2',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 8.22,
			folder: './models',
			files: [
				'1x_JPEGDestroyerV2_96000G.bin',
				'1x_JPEGDestroyerV2_96000G.param',
			],
		},
	},
	'descreen-mask': {
		'opencomic-ai-descreen-mask-balanced-v3-test2-100000': { // TODO: Test model
			name: 'OpenComic AI Descreen Mask Balanced v3 Test Model 100000',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 0,
			folder: './models',
			files: [
				'opencomic-ai-descreen-mask-balanced-v3-test2-100000.bin',
				'opencomic-ai-descreen-mask-balanced-v3-test2-100000.param',
			],
		},
	},
	panels: {
		'opencomic-ai-panels-fast-256-channels-inverted-155000': {
			name: 'OpenComic AI Panels Fast V3 Test Model',
			upscaler: 'upscayl',
			tileSize: 256,
			scales: [1],
			noise: undefined,
			latency: 0,
			folder: './models',
			files: [
				'opencomic-ai-panels-fast-256-channels-inverted-155000.bin',
				'opencomic-ai-panels-fast-256-channels-inverted-155000.param',
			],
		},
	},
};

const modelSpeed = (latency: number): Speed => {

	if(latency <= 1)
		return 'Very Fast';
	else if(latency <= 4)
		return 'Fast';
	else if(latency <= 7)
		return 'Medium';
	else if(latency <= 10)
		return 'Slow';
	else
		return 'Very Slow'; // Not used yet

}

let scalesModels: Record<string, number> = {};

const parseModels = (models: Record<string, ModelObject>, type: ModelType): Record<string, ModelObject> => {

	const parsedModels: Record<string, ModelObject> = {};

	for(const [key, model] of Object.entries(models))
	{
		parsedModels[key] = {
			key,
			type,
			...model,
			speed: modelSpeed(model.latency),
			supportCurrentPlatform: upscalers[model.upscaler].platforms[process.platform]?.[process.arch] ? true : false,
		};

		if(model.scaleFiles)
		{
			for(const scale in model.scaleFiles)
			{
				const _model = model.scaleFiles[scale];
				scalesModels[_model] = +scale;
			}
		}
	}

	return parsedModels;
}

models = {
	upscale: parseModels(models.upscale, 'upscale'),
	descreen: parseModels(models.descreen, 'descreen'),
	'artifact-removal': parseModels(models['artifact-removal'], 'artifact-removal'),
	'descreen-mask': parseModels(models['descreen-mask'], 'descreen-mask'),
	panels: parseModels(models.panels, 'panels'),
};

export type Model = keyof typeof models.upscale & keyof typeof models.descreen & keyof typeof models['artifact-removal'] & keyof typeof models['descreen-mask'] & keyof typeof models.panels & keyof typeof scalesModels;
export type ModelUpscale = keyof typeof models.upscale;
export type ModelArtifactRemoval = keyof typeof models['artifact-removal'];
export type ModelMask = keyof typeof models['descreen-mask'];
export type ModelPanels = keyof typeof models.panels;

export interface OpenComicAIOptions {
	model?: Model;
	noise?: 0 | 1 | 2 | 3;
	scale?: number;
	// format?: 'jpg' | 'png' | 'webp';
	tileSize?: number | 'auto';
	maxTileSize?: number;
	memorySafePercentage?: number;
	gpuId?: string;
	threads?: number;
	tta?: boolean;
	keepBigHalftone?: OpenComicAIKeepBigHalftone;
}

export interface OpenComicAIUpscale extends Omit<OpenComicAIOptions, 'keepBigHalftone'> {
	model: ModelUpscale;
}

export interface OpenComicAIKeepBigHalftone extends Omit<OpenComicAIOptions, 'keepBigHalftone'> {
	model: ModelMask | 'auto';
	minSize?: number;
	minPixels?: number;
	artifactRemoval?: OpenComicAIArtifactRemoval;
}

export interface OpenComicAIArtifactRemoval extends Omit<OpenComicAIOptions, 'keepBigHalftone'> {
	model: ModelArtifactRemoval | 'auto';
}

export interface OpenComicAIPanels extends Omit<OpenComicAIOptions, 'keepBigHalftone'> {
	model: ModelPanels | 'auto';
	minPixels?: number;
	upscale?: OpenComicAIUpscale; // TODO: Train a model specifically for this?
}

export interface Downloading {
	start?: () => void;
	progress?: (progress: number) => void;
	end?: () => void;
}

interface Spawn {
	data: (data: any) => void;
	error: (error: any) => void;
	close: (close: any) => void;
}

interface DaemonQueue {
	args: string[];
	spawn: Spawn;
}

interface Daemon {
	key: string;
	proc: ReturnType<typeof spawn>;
	lastUsed: number;
	queue: DaemonQueue[],
	processing: boolean;
	close: () => void;
	push: (args: string[], spawn: Spawn) => void;
}

const DEFAULT_MODEL: Model = 'opencomic-ai-upscale-lite';
const DOWNLOADING_URL = 'https://raw.githubusercontent.com/ollm/opencomic-ai-models/f57820a3490e5c38984be02d73a2c208106efe3c/models/';

const DAEMON_UPSCALERS: Upscaler[] = ['upscayl'];

const modelsList: Model[] = [
	...Object.keys(models.upscale) as Model[],
	...Object.keys(models.descreen) as Model[],
	...Object.keys(models['artifact-removal']) as Model[],
	...Object.keys(models['descreen-mask']) as Model[],
	...Object.keys(models.panels) as Model[],
];

const modelsTypeList: Record<ModelType, Model[]> = {
	upscale: Object.keys(models.upscale) as Model[],
	descreen: Object.keys(models.descreen) as Model[],
	'artifact-removal': Object.keys(models['artifact-removal']) as Model[],
	'descreen-mask': Object.keys(models['descreen-mask']) as Model[],
	panels: Object.keys(models.panels) as Model[],
};

export default class OpenComicAI {

	public static models = models;
	public static modelsList = modelsList;
	public static modelsTypeList = modelsTypeList;
	public static modelsPath: string | undefined = undefined;
	public static __dirname = ___dirname;
	public static sharp: any = false;
	public static pipelineColourspace: string | false = false;

	private static daemons: Map<string, Daemon> = new Map();
	public static concurrentDaemons: number = 5;
	public static daemonIdleTimeout: number = 60000; // 60 seconds

	public static panels = panels;

	private static resolve = (path: string): string => {

		if(!p.isAbsolute(path))
		{
			if(typeof module !== 'undefined')
				path = p.resolve(module?.parent?.path ?? '', path);
			else
				path = p.resolve(import.meta?.dirname ?? '', path);
		}

		return p.normalize(path);

	}

	public static setModelsPath = (path: string): void => {

		path = OpenComicAI.resolve(path);

		if(!fs.existsSync(path))
			throw new Error(`Models path does not exist: ${path}`);

		OpenComicAI.modelsPath = path;

	}

	public static setDirname = (dirname: string): void => {

		OpenComicAI.__dirname = OpenComicAI.resolve(dirname);

	}

	public static setConcurrentDaemons = (count: number = 3): void => {

		OpenComicAI.concurrentDaemons = count;

	}

	public static setDaemonIdleTimeout = (timeout: number = 60000): void => {

		OpenComicAI.daemonIdleTimeout = timeout;

	}

	public static closeAllDaemons = (): void => {

		for(const daemon of OpenComicAI.daemons.values())
		{
			// daemon.proc.kill();
			daemon.close();
		}

		OpenComicAI.daemons.clear();

	}

	private static closeOldDaemons = (): void => {

		if(OpenComicAI.daemons.size <= OpenComicAI.concurrentDaemons)
			return;

		let daemons: Daemon[] = [...OpenComicAI.daemons.values()];
		daemons.sort((a, b) => a.lastUsed - b.lastUsed);

		const toClose = daemons.length - OpenComicAI.concurrentDaemons;
		let closed = 0;

		for(let i = 0, len = daemons.length; i < len; i++)
		{
			if(closed >= toClose)
				break;

			const daemon = daemons[i];

			if(!daemon.queue.length && !daemon.processing)
			{
				daemon.close();
				closed++;
			}
		}

	}

	public static setSharp = (sharp: any): void => {

		OpenComicAI.sharp = sharp;
		keepBigHalftone.setSharp(sharp);

	}

	public static keepIccProfile = (pipelineColourspace: string = 'rgb16'): void => {

		OpenComicAI.pipelineColourspace = pipelineColourspace;

	}

	public static model = (model: Model = DEFAULT_MODEL): ModelObject => {

		if(!modelsList.includes(model as Model))
			throw new Error(`Model not found: ${model}`);

		const _model = model as Model;
		const modelInfo = models.upscale[_model] || models.descreen[_model] || models['artifact-removal'][_model] || models['descreen-mask'][_model] || models.panels[_model];
		const modelType = modelInfo.type as string;

		return {
			...modelInfo,
			path: OpenComicAI.modelsPath ? p.join(OpenComicAI.modelsPath, modelType, modelInfo.folder) : p.join(modelType, modelInfo.folder),
		};
	}

	public static binary = (model: Model): string  =>  {

		if(!modelsList.includes(model as Model))
			throw new Error(`Model not found: ${model}`);

		const base = p.join(OpenComicAI.__dirname, '..');

		const upscaler = OpenComicAI.model(model as Model).upscaler;
		const result = upscalers[upscaler].platforms[process.platform]?.[process.arch] ?? upscalers[upscaler].platforms[process.platform]?.x64 ?? upscalers[upscaler].platforms.linux?.x64 ?? '';

		return p.join(base, result);

	}

	public static intermediateDest = (dest: string, key: string = ''): string => {

		const parsed = p.parse(dest);
		return p.join(parsed.dir, `${key ? `${key}-` : ''}${crypto.randomUUID()}${parsed.ext}`);

	}

	private static download = async (fileUrl: string, destPath: string, downloading?: Downloading | false): Promise<void> => {

		const response = await fetch(fileUrl);

		if(response.ok)
		{
			const contentLength = response.headers.get('content-length');
			const len = contentLength ? parseInt(contentLength, 10) : 0;

			if(!response.body)
			{
				console.error('Response body is null', fileUrl);
				return;
			}

			const reader = response.body.getReader();
			const fileStream = fs.createWriteStream(destPath);

			let downloaded = 0;

			while(true)
			{
				const {done, value} = await reader.read();

				if(done)
					break;

				fileStream.write(value);
				downloaded += value.byteLength;

				if(downloading && downloading?.progress)
					downloading?.progress(downloaded / len);
			}

			if(downloading && downloading?.progress)
				downloading?.progress(1);

			let resolve;

			const promise = new Promise((_resolve) => {

				resolve = _resolve;

			});

			fileStream.end(resolve);

			await promise;
		}
		else
		{
			throw new Error(`Failed to download file: ${fileUrl}, status: ${response.status}`);
		}

	}

	private static getModels = async (steps: OpenComicAIOptions[], downloading?: Downloading | false): Promise<void> => {

		const toGetModels: Map<string, string> = new Map();

		for(const step of steps)
		{
			const modelInfo = OpenComicAI.model(step.model as Model || DEFAULT_MODEL);

			for(const file of modelInfo.files)
			{
				const filePath = p.join(modelInfo.path as string, file);

				if(!fs.existsSync(filePath))
				{
					const base = new URL(`${modelInfo.type}/`, DOWNLOADING_URL);
					const folder = new URL(`${modelInfo.folder}/`, base);
					const fileUrl = new URL(file, folder).href;

					toGetModels.set(fileUrl, filePath);
				}
			}
		}

		if(toGetModels.size > 0)
		{
			if(downloading && downloading.start)
				downloading.start();

			const entries = toGetModels.entries();
			const binNum = [...toGetModels.values()].reduce((accumulator, destPath) => {

				return accumulator + (destPath.endsWith('.bin') ? 1 : 0);

			}, 0);

			let index = -1;

			for(const [fileUrl, destPath] of entries)
			{
				const folder = p.dirname(destPath);

				if(!fs.existsSync(folder))
					await fsp.mkdir(folder, {recursive: true});

				let _downloading = {};

				if(destPath.endsWith('.bin'))
				{
					index++;

					_downloading = {
						progress: (progress: number) => {

							if(downloading && downloading.progress)
								downloading.progress(((index + progress) / binNum));

						}
					};
				}

				await OpenComicAI.download(fileUrl, destPath, _downloading);
			}

			if(downloading && downloading.end)
				downloading.end();
		}

	}

	public static pipeline = async (source: string, dest: string, steps: OpenComicAIOptions[], progress?: ((progress: number) => void) | false, downloading?: Downloading | false): Promise<string> => {

		if(!OpenComicAI.modelsPath)
			throw new Error('Models path is not set, use OpenComicAI.setModelsPath to set it before calling pipe.');

		await OpenComicAI.getModels(steps, downloading);

		const _source: string = source;

		const parsed = p.parse(dest);
		let prevIntermediateDest: string = '';

		if(!parsed.ext)
			throw new Error(`Invalid destination file format. Expected an image file with an extension (e.g. .png, .jpg, .webp), but got: "${dest}"`);

		for(let i = 0, len = steps.length; i < len; i++)
		{
			const step = steps[i];
			const intermediateDest = i < len - 1 ? OpenComicAI.intermediateDest(dest) : dest;

			const _progress = (p: number | undefined) => {

				if(!progress)
					return;

				const overallProgress = (i + (p ?? 0)) / len;
				progress(overallProgress);

			}

			if(progress)
				progress(i / len);

			await OpenComicAI.image(source, intermediateDest, step, _progress);

			if(step.keepBigHalftone && step.model && modelsTypeList['descreen'].includes(step.model))
				await keepBigHalftone.keep(source, dest, step.keepBigHalftone);

			if(prevIntermediateDest && fs.existsSync(prevIntermediateDest))
				await fsp.unlink(prevIntermediateDest);

			source = intermediateDest;
			prevIntermediateDest = OpenComicAI.resolve(intermediateDest);
		}

		if(OpenComicAI.sharp && OpenComicAI.pipelineColourspace)
		{
			// Read metadata (including ICC profile) from source image
			const srcMetadata = await OpenComicAI.sharp(_source).metadata();

			if(srcMetadata.icc)
			{
				const iccPath = p.join(p.dirname(dest), `${crypto.randomUUID()}.icc`);
				const iccImagePath = OpenComicAI.intermediateDest(dest);

				await fsp.writeFile(iccPath, srcMetadata.icc);

				// Apply ICC profile
				let sharp = await OpenComicAI.sharp(dest).pipelineColourspace(OpenComicAI.pipelineColourspace).withIccProfile(iccPath);

				const ext = parsed.ext.toLowerCase();

				switch(ext)
				{
					case '.jpg':
					case '.jpeg':
					case '.jpe':

						sharp = sharp.jpeg({quality: 100, force: true});

						break;

					case 'webp':

						sharp = sharp.webp({quality: 100, force: true});

						break;

					default:

						sharp.png({compressionLevel: 0, force: true});

						break;
				}

				await sharp.toFile(iccImagePath);

				// Replace dest with iccImagePath
				await fsp.unlink(dest);
				fs.renameSync(iccImagePath, dest);

				await fsp.unlink(iccPath);
			}
		}

		return source;

	}

	public static preload = async (steps: OpenComicAIOptions[], downloading?: Downloading | false): Promise<void> => {

		await OpenComicAI.getModels(steps, downloading);

		const promises: Promise<void>[] = [];

		for(let i = 0, len = steps.length; i < len; i++)
		{
			const step = steps[i];

			if(!step.model)
				step.model = DEFAULT_MODEL;

			if(!modelsList.includes(step.model as Model))
				throw new Error(`Model not found: ${step.model}`);

			const binary = OpenComicAI.binary(step.model);
			const modelInfo = OpenComicAI.model(step.model);

			const args: string[] = OpenComicAI.args(step);
			args.unshift('-o', '');
			args.unshift('-i', '');

			if(DAEMON_UPSCALERS.includes(modelInfo.upscaler) && OpenComicAI.concurrentDaemons > 0)
				promises.push(OpenComicAI.spawnDaemon(binary, args));
		}

		await Promise.all(promises);

	}

	public static closest = (array: number[], target: number): number => {

		return array.reduce((prev, curr) => {
			return Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev;
		});

	}

	private static args = (options: OpenComicAIOptions): string[] => {

		options = {...options};

		if(!options.model)
			options.model = DEFAULT_MODEL;

		if(!modelsList.includes(options.model as Model))
			throw new Error(`Model not found: ${options.model}`);

		const binary = OpenComicAI.binary(options.model);
		const modelInfo = OpenComicAI.model(options.model);

		const model = options.model;
		// const format = options.format ?? p.extname(source).slice(1);
		const threads: number | false = options.threads ? +options.threads : false;
		let noise: number | false = options.noise ? +options.noise : false;
		let scale: number | false = options.scale ? +options.scale : false;
		let tileSize: string | false = options.tileSize?.toString() ?? false;
		let tileSizeFromMem128: number | false = false;
		const maxTileSize: string | false = options.maxTileSize?.toString() ?? false;
		const memorySafePercentage: string | false = options.memorySafePercentage?.toString() ?? false;
		const gpuId: string | false = options.gpuId ?? false;
		const tta: boolean = !!options.tta;

		if(noise !== false && !modelInfo?.noise?.includes(noise))
			noise = modelInfo?.noise ? OpenComicAI.closest(modelInfo.noise, noise) : false;

		if(scale && !modelInfo.scales.includes(scale))
			scale = OpenComicAI.closest(modelInfo.scales, scale);

		if(!tileSize || tileSize === 'auto')
		{
			if(modelInfo.tileSizeFromMem128)
			{
				tileSizeFromMem128 = modelInfo.tileSizeFromMem128;
				tileSize = false;
			}
			else if(modelInfo.tileSize)
			{
				tileSize = modelInfo.tileSize.toString();
			}
		}

		const args: string[] = [
			'-m', modelInfo?.path as string,
			// ...(format ? ['-f', format] : []),
			...(threads ? ['-j', `${threads}:${threads}:${threads}`] : []),
			...(noise !== false ? ['-n', noise.toString()] : []),
			...(scale ? ['-s', scale.toString()] : []),
			...(tileSize ? ['-t', tileSize] : []),
			...(tileSizeFromMem128 ? ['-y', tileSizeFromMem128.toString()] : []),
			...(maxTileSize ? ['-k', maxTileSize] : []),
			...(memorySafePercentage ? ['-u', memorySafePercentage] : []),
			...(gpuId ? ['-g', gpuId] : []),
			...(tta ? ['-x'] : []),
		];

		switch(modelInfo.upscaler)
		{
			case 'waifu2x':

				// No additional args for waifu2x

				break;

			case 'realcugan':

				// No additional args for realcugan

				break;

			case 'upscayl':

				let modelName: Model = model;
				let modelScale: string = Math.max(...modelInfo.scales).toString();

				if(modelInfo.scaleFiles)
				{
					if(!scale)
						scale = Math.max(...modelInfo.scales);

					modelName = modelInfo.scaleFiles[scale];
					modelScale = scale.toString();
				}

				args.push('-n', modelName);
				args.push('-z', modelScale); // Set model scale, upscayl doesn't detect it correctly on Windows

				break;
		}

		return args;

	}

	public static image = async (source: string, dest: string, options?: OpenComicAIOptions, progress?: ((progress: number) => void) | false): Promise<string> => {

		options = {...options};

		if(!options.model)
			options.model = DEFAULT_MODEL;

		if(!modelsList.includes(options.model as Model))
			throw new Error(`Model not found: ${options.model}`);

		const binary = OpenComicAI.binary(options.model);
		const modelInfo = OpenComicAI.model(options.model);

		source = OpenComicAI.resolve(source);
		dest = OpenComicAI.resolve(dest);

		const folder = p.dirname(dest);

		if(!fs.existsSync(folder))
			await fsp.mkdir(folder, {recursive: true});

		const args: string[] = OpenComicAI.args(options);
		args.unshift('-o', dest);
		args.unshift('-i', source);

		let result = '';

		console.log(`Running command: ${binary} ${args.join(' ')}`);

		return new Promise<string>((resolve, reject) => {

			const _spawn = DAEMON_UPSCALERS.includes(modelInfo.upscaler) && OpenComicAI.concurrentDaemons > 0 ? OpenComicAI.spawnDaemon : OpenComicAI.spawn;

			_spawn(binary, args, {
				data: (data) => {

					data = data.toString();
					result += data;

					if(!progress)
						return;

					const match = data.match(/([\d\.\,]+)%/);

					if(match)
					{
						const percent = +(match[1].replace(',', '.'));
						const _progress = Math.min(Math.max(percent / 100, 0), 1);
						progress(_progress);
					}

				},
				error: (error) => {

					reject(error);

				},
				close: (code) => {

					if(code === 0)
					{
						resolve(dest);
						return;
					}

					const lines = result.split('\n').filter(line => line.trim() !== '');
					const lastLine = lines[lines.length - 1] || '';
					const lastLines = lines.slice(-20).join('\n');

					console.error(lastLines);
					reject(new Error(`Process exited with code ${code}: ${lastLine}`));

				}
			});
		});
	}

	private static spawn = (binary: string, args: string[], {data, error, close}: Spawn): ReturnType<typeof spawn> => {

		const proc = spawn(binary, args);

		proc.stderr.on('data', data);
		proc.on('error', error);
		proc.on('close', close);

		return proc;

	}

	private static spawnDaemon = async (binary: string, args: string[], spawn?: Spawn): Promise<void> => {

		const initFlags = ['-m', '-n', '-g', '-z', '-t', '-y', '-u', '-k'];

		const initArgs: string[] = [];
		const daemonArgs: string[] = [];

		for(let i = 0, len = args.length; i < len; i += 2)
		{
			const target = initFlags.includes(args[i]) ? initArgs : daemonArgs;
			target.push(args[i], args[i + 1]);
		}

		const key: string = [binary, ...initArgs].join(' ');

		if(OpenComicAI.daemons.has(key))
		{
			const daemon = OpenComicAI.daemons.get(key) as Daemon;
			if(spawn) daemon.push(daemonArgs, spawn);
		}
		else
		{
			return new Promise<void>((resolve) => {

				const daemon: Daemon = OpenComicAI.daemon(key, binary, initArgs, resolve);
				if(spawn) daemon.push(daemonArgs, spawn);

			});
		}

		return;

	}

	private static daemon = (key: string, binary: string, args: string[], onReady?: () => void): Daemon => {

		let daemon: Daemon;

		args.push('-d');

		const queue: DaemonQueue[] = [];
		let modelLoaded = false;
		let idleTimer: NodeJS.Timeout;
		let currentSpawn: Spawn | null = null;

		const proc = OpenComicAI.spawn(binary, args, {
			data: (data) => {

				data = data.toString();
				const ready = /Ready\>/.test(data);
				
				if(/Error\:/.test(data))
				{
					const message = data.split('Error:')[1].trim().split('\n')[0];
					if(currentSpawn) currentSpawn.error(`Error: ${message}`);
				}

				if(ready && !modelLoaded && !currentSpawn) // First ready
				{
					modelLoaded = true;
					process();
					if(onReady) onReady();
				}
				else if(modelLoaded && currentSpawn)
				{
					currentSpawn.data(data);

					if(ready)
					{
						currentSpawn.close(0);
						currentSpawn = null;
						daemon.processing = false;
						process();
					}
				}

			},
			error: (error) => {

				if(currentSpawn)
					currentSpawn.error(error);

			},
			close: (code) => {

				if(currentSpawn)
					currentSpawn.close(code);

				OpenComicAI.daemons.delete(key);

			}
		});

		let closing = false;

		const close = () => {

			if(closing)
				return;

			OpenComicAI.daemons.delete(key);

			clearTimeout(idleTimer);
			proc.stdin!.write(`quit\n`);

			closing = true;

			// proc.stdin!.end();
			// proc.kill();

		}

		const process = () => {

			clearTimeout(idleTimer);

			if(currentSpawn || !modelLoaded)
				return;

			if(queue.length)
			{
				const item = queue.shift() as DaemonQueue;
				currentSpawn = item.spawn;
				daemon.processing = true;

				const args = item.args.map(function(arg) {

					if(arg.startsWith('-'))
						return arg;

					return `"${arg.replace(/"/g, '\\"')}"`;
				});

				proc.stdin!.write(`${args.join(' ')}\n`);
			}
			else
			{
				if(OpenComicAI.daemons.size > OpenComicAI.concurrentDaemons)
				{
					OpenComicAI.closeOldDaemons();
					return;
				}

				idleTimer = setTimeout(() => {

					close();

				}, OpenComicAI.daemonIdleTimeout);
			}

		}

		const push = (args: string[], spawn: Spawn) => {

			daemon.lastUsed = Date.now();
			daemon.queue.push({args, spawn});
			process();

		}

		daemon = {
			key,
			proc,
			lastUsed: Date.now(),
			close,
			processing: false,
			queue,
			push,
		};

		OpenComicAI.daemons.set(key, daemon);

		return daemon;

	}
}