# opencomic-ai-bin

This package provides pre-built binaries (`realcugan`, `waifu2x`, and `upscayl`) through a simple Node.js API.

Model files are not included, they are downloaded automatically when needed.

If you prefer to install all models upfront, use the [`opencomic-ai-models`](https://github.com/ollm/opencomic-ai-models) package.

## Installation

```
npm install opencomic-ai-bin
```

## Methods

This package can be used using CommonJS or ES Module.

```js
// CommonJS
const OpenComicAI = require('opencomic-ai-bin');

// ES Module
import OpenComicAI from 'opencomic-ai-bin';
```

### Simple example of package usage

```ts
import OpenComicAI from 'opencomic-ai-bin';

(async () => {

	// Models path, if the model is not found in this folder, it will be downloaded
	OpenComicAI.setModelsPath('./models');

	await OpenComicAI.pipeline('./input.jpg', './output.jpg', [
		{
			model: '1x_halftone_patch_060000_G',
		},
		{
			model: 'realcugan',
			scale: 4,
			noise: 0,
		}
	], (progress) => {

		console.log(`Processing: ${Math.round(progress * 100)}%`);

	}, {
		start: () => {

			console.log(`Start download`);

		},
		progress: (progress) => {

			console.log(`Downloading: ${Math.round(progress * 100)}%`);

		},
		end: () => {

			console.log(`End download`);

		},
	});

})();
```

### OpenComicAI.setModelsPath

Set the directory where models will be downloaded and stored.

```ts
OpenComicAI.setModelsPath(path: string): void
```

### OpenComicAI.models

Object containing all available models organized by type (upscale, descreen, artifact-removal).

```ts
OpenComicAI.models: Record<ModelType, Record<string, ModelObject>>
```

### OpenComicAI.modelsList

Array of all available model keys.

```ts
OpenComicAI.modelsList: Model[]
```

### OpenComicAI.modelsTypeList

Models organized by type.

```ts
OpenComicAI.modelsTypeList: Record<ModelType, Model[]>
```

### OpenComicAI.modelsPath

Current path where models are stored.

```ts
OpenComicAI.modelsPath: string | undefined
```

### OpenComicAI.binary

Get the path to the binary executable for a model.

```ts
OpenComicAI.binary(model: Model): string
```

### OpenComicAI.model

Get detailed information about a specific model.

```ts
OpenComicAI.model(model: Model): ModelObject
```

### OpenComicAI.pipeline
Process an image through one or more AI models.

```ts
OpenComicAI.pipeline(
	source: string,
	dest: string,
	steps: OpenComicAIOptions[],
	progress?: (progress: number) => void,
	downloading?: Downloading
): Promise<string>
```

## Types

### `Model`

```typescript
type Model =
	| 'realcugan'
	| 'realesr-animevideov3'
	| 'realesrgan-x4plus'
	...
```
### `ModelType`

```typescript
type ModelType = 'upscale' | 'descreen' | 'artifact-removal';
```

### `Upscaler`

```typescript
type Upscaler = 'realcugan' | 'upscayl' | 'waifu2x';
```

### `Speed`

```typescript
type Speed = 'Very Fast' | 'Fast' | 'Moderate' | 'Slow' | 'Very Slow';
```

### `OpenComicAIOptions`

```typescript
interface OpenComicAIOptions {
	model?: Model | string;
	noise?: 0 | 1 | 2 | 3;
	scale?: number;
	tileSize?: number;
	gpuId?: string;
	threads?: number;
	tta?: boolean;
}
```

### `ModelObject`

```typescript
interface ModelObject {
	key?: Model;
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
```

### `Downloading`

```typescript
interface Downloading {
	start?: () => void;
	progress?: (progress: number) => void;
	end?: () => void;
}
```

## Models Info

### Artifact removal

Model | Name | Upscaler | Source
------|------|----------|-------
`1x_NMKD-Jaywreck3-Lite_320k` | NMKD Jaywreck3 Lite | `upscayl` | [NMKD.de](https://nmkd.de/?esrgan)
`1x_NMKD-Jaywreck3-Soft-Lite_320k` | NMKD Jaywreck3 Soft Lite | `upscayl` | [NMKD.de](https://nmkd.de/?esrgan)
`1x-SaiyaJin-DeJpeg` | SaiyaJin DeJpeg | `upscayl` | [OpenModelDB](https://openmodeldb.info/models/1x-SaiyaJin-DeJpeg)

### Descreen

Model | Name | Upscaler | Source
------|------|----------|-------
`1x_halftone_patch_060000_G` | Halftone Patch 060000 G | `upscayl` | [NMKD.de](https://nmkd.de/shared/?dir=ESRGAN/Models/Compression/Halftone)
`1x_wtp_descreenton_compact` | WTP DescreenTon Compact | `upscayl` | [OpenModelDB](https://openmodeldb.info/models/1x-wtp-descreentone-compact)

### Upscale

Model | Name | Upscaler | Source
------|------|----------|-------
`realcugan` | RealCUGAN | `realcugan` | [Moebytes/waifu2x](https://github.com/Moebytes/waifu2x/tree/eaadd13cf54ba3bcb3cbd3e4a1cb2cd922420c9b/real-cugan/models-se)
`realesr-animevideov3` | RealESR AnimeVideo v3 | `upscayl` | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
`realesrgan-x4plus` | RealESRGAN x4 Plus | `upscayl` | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
`realesrgan-x4plus-anime` | RealESRGAN x4 Plus Anime | `upscayl` | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
`realesrnet-x4plus` | RealESRNet x4 Plus | `upscayl` | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
`waifu2x-models-cunet` | Waifu2x CUnet | `waifu2x` | [Moebytes/waifu2x](https://github.com/Moebytes/waifu2x/tree/eaadd13cf54ba3bcb3cbd3e4a1cb2cd922420c9b/waifu2x/models-cunet)
`waifu2x-models-upconv` | Waifu2x UpConv | `waifu2x` | [Moebytes/waifu2x](https://github.com/Moebytes/waifu2x/tree/eaadd13cf54ba3bcb3cbd3e4a1cb2cd922420c9b/waifu2x/models-upconv_7_anime_style_art_rgb)
`4x-WTP-ColorDS` | WTP ColorDS | `upscayl` | [OpenModelDB](https://openmodeldb.info/models/4x-WTP-ColorDS)
`remacri-4x` | Remacri | `upscayl` | [upscayl/upscayl](https://github.com/upscayl/upscayl/tree/d6e9a36b894d302e6268dc239e8a51ff29c49ded/resources/models)
`ultramix-balanced-4x` | Ultramix Balanced | `upscayl` | [upscayl/upscayl](https://github.com/upscayl/upscayl/tree/d6e9a36b894d302e6268dc239e8a51ff29c49ded/resources/models)
`ultrasharp-4x` | Ultrasharp | `upscayl` | [upscayl/upscayl](https://github.com/upscayl/upscayl/tree/d6e9a36b894d302e6268dc239e8a51ff29c49ded/resources/models)
`4xHFA2k` | HFA2k | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4xLSDIRCompactC3` | LSDIR Compact C3 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4xLSDIRplusC` | LSDIR Plus C | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4x_NMKD-Siax_200k` | NMKD Siax | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4xNomos8kSC` | Nomos 8k SC | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`RealESRGAN_General_WDN_x4_v3` | RealESRGAN General WDN v3 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`RealESRGAN_General_x4_v3` | RealESRGAN General v3 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`uniscale_restore_x4` | Uniscale Restore x4 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`unknown-2.0.1` | Unknown 2.0.1 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)

## Credits

This project uses the following AI models and upscalers:
- [Real-CUGAN](https://github.com/bilibili/ailab/tree/main/Real-CUGAN)
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
- [Waifu2x](https://github.com/nagadomi/waifu2x)
- [Upscayl](https://github.com/upscayl/upscayl)