import fs from 'fs';
import fsp from 'fs/promises';
import p from 'path';
import crypto from 'crypto';
import {spawn} from 'child_process';

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

export type ModelType = 'upscale' | 'descreen' | 'artifact-removal';
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
			},
			linux: {
				x64: 'linux/x64/upscayl/upscayl-bin',
			},
		},
	},
}

export interface ModelObject {
	key?: Model,
	name: string;
	upscaler: Upscaler;
	type?: ModelType;
	scales: number[];
	noise: number[] | undefined;
	latency: number;
	speed?: Speed;
	folder: string;
	path?: string;
	files: string[];
	supportCurrentPlatform?: boolean;
}

let models: Record<ModelType, Record<string, ModelObject>> = {
	upscale: {
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
			latency: 1.32,
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
			latency: 1.53,
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
			latency: 7.5,
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
			latency: 3.26,
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
			latency: 7.17,
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
			latency: 2.92,
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
			latency: 0.8,
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
			latency: 7.62,
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
			latency: 7.82,
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
			latency: 7.46,
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
			latency: 7.26,
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
			latency: 7.77,
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
			latency: 7.29,
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
			latency: 7.39,
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
			latency: 1.37,
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
			latency: 8.3,
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
			latency: 7.24,
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
			latency: 7.11,
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
			latency: 1.47,
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
			latency: 1.45,
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
			latency: 7.01,
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
			latency: 7.33,
			folder: './models',
			files: [
				'unknown-2.0.1.bin',
				'unknown-2.0.1.param',
			],
		},
	},
	descreen: {
		'1x_halftone_patch_060000_G': {
			name: 'Halftone Patch 060000 G',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 6.71,
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
			latency: 0.5,
			folder: './models',
			files: [
				'1x_wtp_descreenton_compact.bin',
				'1x_wtp_descreenton_compact.param',
			],
		},
	},
	'artifact-removal': {
		'1x_NMKD-Jaywreck3-Lite_320k': {
			name: 'NMKD Jaywreck3 Lite',
			upscaler: 'upscayl',
			scales: [1],
			noise: undefined,
			latency: 3.66,
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
			latency: 3.66,
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
			latency: 8.55,
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
			latency: 6.37,
			folder: './models',
			files: [
				'1x_JPEGDestroyerV2_96000G.bin',
				'1x_JPEGDestroyerV2_96000G.param',
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
	}

	return parsedModels;
}

models = {
	upscale: parseModels(models.upscale, 'upscale'),
	descreen: parseModels(models.descreen, 'descreen'),
	'artifact-removal': parseModels(models['artifact-removal'], 'artifact-removal'),
};

export type Model = keyof typeof models.upscale & keyof typeof models.descreen & keyof typeof models['artifact-removal'];

export interface OpenComicAIOptions {
	model?: Model;
	noise?: 0 | 1 | 2 | 3;
	scale?: number;
	// format?: 'jpg' | 'png' | 'webp';
	tileSize?: number;
	gpuId?: string;
	threads?: number;
	tta?: boolean;
}

export interface Downloading {
	start?: () => void;
	progress?: (progress: number) => void;
	end?: () => void;
}

const DEFAULT_MODEL: Model = 'realcugan';
const DOWNLOADING_URL = 'https://raw.githubusercontent.com/ollm/opencomic-ai-models/476007f6e316c7471173af573d0e1ec7e6a941e1/models/';

const modelsList: Model[] = [...Object.keys(models.upscale) as Model[], ...Object.keys(models.descreen) as Model[], ...Object.keys(models['artifact-removal']) as Model[]];
const modelsTypeList: Record<ModelType, Model[]> = {
	upscale: Object.keys(models.upscale) as Model[],
	descreen: Object.keys(models.descreen) as Model[],
	'artifact-removal': Object.keys(models['artifact-removal']) as Model[],
};

export default class OpenComicAI {

	public static models = models;
	public static modelsList = modelsList;
	public static modelsTypeList = modelsTypeList;
	public static modelsPath: string | undefined = undefined;
	public static __dirname = ___dirname;

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

	public static model = (model: Model = DEFAULT_MODEL): ModelObject => {

		if(!modelsList.includes(model as Model))
			throw new Error(`Model not found: ${model}`);

		const _model = model as Model;
		const modelInfo = models.upscale[_model] || models.descreen[_model] || models['artifact-removal'][_model];
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

	public static pipeline = async (source: string, dest: string, steps: OpenComicAIOptions[], progress?: ((progress?: number) => void) | false, downloading?: Downloading | false): Promise<string> => {

		if(!OpenComicAI.modelsPath)
			throw new Error('Models path is not set, use OpenComicAI.setModelsPath to set it before calling pipe.');

		await OpenComicAI.getModels(steps, downloading);

		const parsed = p.parse(dest);
		let prevIntermediateDest: string = '';

		for(let i = 0, len = steps.length; i < len; i++)
		{
			const step = steps[i];
			const intermediateDest = i < len - 1 ? p.join(p.dirname(dest), `${crypto.randomUUID()}${parsed.ext}`) : dest;

			const _progress = (p: number | undefined) => {

				if(!progress)
					return;

				const overallProgress = (i + (p ?? 0)) / len;
				progress(overallProgress);

			}

			if(progress)
				progress(i / len);

			await OpenComicAI.image(source, intermediateDest, step, _progress);

			if(prevIntermediateDest && fs.existsSync(prevIntermediateDest))
				await fsp.unlink(prevIntermediateDest);

			source = intermediateDest;
			prevIntermediateDest = OpenComicAI.resolve(intermediateDest);
		}

		return source;

	}

	public static closest = (array: number[], target: number): number => {

		return array.reduce((prev, curr) => {
			return Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev;
		});

	}

	private static image = async (source: string, dest: string, options?: OpenComicAIOptions, progress?: ((progress?: number) => void) | false): Promise<string> => {

		options = {...options};

		source = OpenComicAI.resolve(source);
		dest = OpenComicAI.resolve(dest);

		const {dir, name} = p.parse(dest);

		if(!options.model)
			options.model = DEFAULT_MODEL;

		if(!modelsList.includes(options.model as Model))
			throw new Error(`Model not found: ${options.model}`);

		const folder = p.dirname(dest);

		if(!fs.existsSync(folder))
			await fsp.mkdir(folder, {recursive: true});

		const binary = OpenComicAI.binary(options.model);
		const modelInfo = OpenComicAI.model(options.model);

		const model = options.model;
		// const format = options.format ?? p.extname(source).slice(1);
		const threads: number | boolean = options.threads ? +options.threads : false;
		let noise: number | boolean = options.noise ? +options.noise : false;
		let scale: number | boolean = options.scale ? +options.scale : false;
		const tileSize: string | boolean = options.tileSize?.toString() ?? false;
		const gpuId: string | boolean = options.gpuId ?? false;
		const tta: boolean = !!options.tta;

		if(noise !== false && !modelInfo?.noise?.includes(noise))
			noise = modelInfo?.noise ? OpenComicAI.closest(modelInfo.noise, noise) : false;

		if(scale && !modelInfo.scales.includes(scale))
			scale = OpenComicAI.closest(modelInfo.scales, scale);

		const args: string[] = [
			'-i', source,
			'-o', dest,
			'-m', modelInfo?.path as string,
			// ...(format ? ['-f', format] : []),
			...(threads ? ['-j', `${threads}:${threads}:${threads}`] : []),
			...(noise !== false ? ['-n', noise.toString()] : []),
			...(scale ? ['-s', scale.toString()] : []),
			...(tileSize ? ['-t', tileSize] : []),
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

				args.push('-n', model);
				args.push('-z', Math.max(...modelInfo.scales).toString()); // Set model scale, upscayl is not detected correctly in Windows

				break;
		}

		let result = '';

		// console.log(`Executing: ${binary} ${args.join(' ')}`);

		return new Promise<string>((resolve, reject) => {

			const proc = spawn(binary, args);

			proc.stderr.on('data', (data) => {

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

			});

			proc.on('error', (error) => {

				reject(error);

			});

			proc.on('close', (code) => {

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

			});
		});

	}
}