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
import sharp from 'sharp'; // This is optional, only needed if you want to keep ICC profile or use a YOLO26 model

(async () => {

	// Set the base directory for binary paths, for example change to app.asar.unpacked path in Electron apps
	OpenComicAI.setDirname(OpenComicAI.__dirname.replace(/app(-(?:arm64|x64))?\.asar/, 'app$1.asar.unpacked'));

	// Models path, if the model is not found in this folder, it will be downloaded
	OpenComicAI.setModelsPath('./models');

	// Set sharp instance
	OpenComicAI.setSharp(sharp); 

	// Keep ICC profile from input image, requires sharp instance
	OpenComicAI.keepIccProfile('rgb16');

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

### OpenComicAI.setDirname

Set the base directory for binary paths.

```ts
OpenComicAI.setDirname(dirname: string): void
```

### OpenComicAI.setModelsPath

Set the directory where models will be downloaded and stored.

```ts
OpenComicAI.setModelsPath(path: string): void
```

### OpenComicAI.setConcurrentDaemons

Set the maximum number of concurrent daemons (`upscayl` models only), 0 disables daemons.

Daemons help speed up processing loading model only once and not for each image. [See comparative performance.](#daemon-comparative-performance)

```ts
OpenComicAI.setConcurrentDaemons(count: number = 3): void
```

### OpenComicAI.setDaemonIdleTimeout

Set the idle timeout for daemons in milliseconds (`upscayl` models only).

```ts
OpenComicAI.setDaemonIdleTimeout(timeout: number = 60000): void
```

### OpenComicAI.closeAllDaemons

Close all running daemons (`upscayl` models only).

```ts
OpenComicAI.closeAllDaemons(): void
```

### OpenComicAI.setSharp

Set a sharp instance.

```ts
OpenComicAI.keepIccProfile(sharp: any): void
```

### OpenComicAI.keepIccProfile

Keep the ICC profile from the input image, requires a sharp instance to copy the profile from source to dest.

```ts
OpenComicAI.keepIccProfile(pipelineColourspace: string = 'rgb16'): void
```

### OpenComicAI.\_\_dirname

Get the base directory for binary paths.

```ts
OpenComicAI.__dirname: string
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

### OpenComicAI.preload

Preload the model to daemon (`upscayl` models only) or download the model if not available locally.

```ts
OpenComicAI.preload(steps: OpenComicAIOptions[], downloading?: Downloading): Promise<void>
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

### OpenComicAI.closest

Returns the value in the array closest to the target value.

```ts
OpenComicAI.closest(array: number[], target: number): number
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
type Speed = 'Very Fast' | 'Fast' | 'Medium' | 'Slow' | 'Very Slow';
```

### `OpenComicAIOptions`

```typescript
interface OpenComicAIOptions {
	model?: Model;
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
	latency: number; // From 0.5 (Fatest model) to 10 (Slowest model)
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
`opencomic-ai-artifact-removal-compact` | OpenComic AI Artifact Removal Compact | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`opencomic-ai-artifact-removal-lite` | OpenComic AI Artifact Removal Lite | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`opencomic-ai-artifact-removal` | OpenComic AI Artifact Removal | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`1x_NMKD-Jaywreck3-Lite_320k` | NMKD Jaywreck3 Lite | `upscayl` | [NMKD.de](https://nmkd.de/?esrgan)
`1x_NMKD-Jaywreck3-Soft-Lite_320k` | NMKD Jaywreck3 Soft Lite | `upscayl` | [NMKD.de](https://nmkd.de/?esrgan)
`1x-SaiyaJin-DeJpeg` | SaiyaJin DeJpeg | `upscayl` | [OpenModelDB](https://openmodeldb.info/models/1x-SaiyaJin-DeJpeg)
`1x_JPEGDestroyerV2_96000G` | JPEG Destroyer V2 | `upscayl` | [Hugging Face](https://huggingface.co/utnah/esrgan)

### Descreen

Model | Name | Upscaler | Source
------|------|----------|-------
`opencomic-ai-descreen-hard-compact` | OpenComic AI Descreen Hard Compact | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`opencomic-ai-descreen-hard-lite` | OpenComic AI Descreen Hard Lite | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`opencomic-ai-descreen-hard` | OpenComic AI Descreen Hard | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`1x_halftone_patch_060000_G` | Halftone Patch 060000 G | `upscayl` | [NMKD.de](https://nmkd.de/shared/?dir=ESRGAN/Models/Compression/Halftone)
`1x_wtp_descreenton_compact` | WTP DescreenTon Compact | `upscayl` | [OpenModelDB](https://openmodeldb.info/models/1x-wtp-descreentone-compact)

### Upscale

Model | Name | Upscaler | Source
------|------|----------|-------
`opencomic-ai-upscale-compact` | OpenComic AI Upscale Compact | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
`opencomic-ai-upscale-lite` | OpenComic AI Upscale Lite | `upscayl` | [ollm/opencomic-ai-training](https://github.com/ollm/opencomic-ai-training)
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
`4xInt-RemAnime` | Int-RemAnime | `upscayl` | [Phhofm/models](https://github.com/Phhofm/models)
`AI-Forever_x4plus` | AI-Forever x4plus | `upscayl` | [Hugging Face](https://huggingface.co/leonelhs/realesrgan)
`4xNomosWebPhoto_esrgan` | Nomos Web Photo ESRGAN | `upscayl` | [OpenModelDB](https://openmodeldb.info/models/4x-NomosWebPhoto-esrgan)
`4xHFA2k` | HFA2k | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4xLSDIRCompactC3` | LSDIR Compact C3 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4xLSDIRplusC` | LSDIR Plus C | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4x_NMKD-Siax_200k` | NMKD Siax | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`4xNomos8kSC` | Nomos 8k SC | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`RealESRGAN_General_WDN_x4_v3` | RealESRGAN General WDN v3 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`RealESRGAN_General_x4_v3` | RealESRGAN General v3 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`uniscale_restore_x4` | Uniscale Restore x4 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)
`unknown-2.0.1` | Unknown 2.0.1 | `upscayl` | [upscayl/custom-models](https://github.com/upscayl/custom-models/tree/4b6d2cfa59c7442af115dfc6e50fd8d7d40b96ef/models)

## Daemon comparative performance

### Table (10 images 512x512px)

Model                          | Disabled              | Enabled              | Disabled vs Enabled
-------------------------------|-----------------------|----------------------|--------
OpenComic AI Upscale Lite      | 52.087s               | 7.646s               | 6.81x
RealESRGAN x4 Plus             | 73.273s               | 23.199s              | 3.16x

### OpenComic AI Upscale Lite

#### Disabled

``` bash
Processing image 1/10 for model: OpenComic AI Upscale Lite: 2.931s
Processing image 2/10 for model: OpenComic AI Upscale Lite: 4.464s
Processing image 3/10 for model: OpenComic AI Upscale Lite: 5.594s
Processing image 4/10 for model: OpenComic AI Upscale Lite: 5.561s
Processing image 5/10 for model: OpenComic AI Upscale Lite: 5.521s
Processing image 6/10 for model: OpenComic AI Upscale Lite: 5.531s
Processing image 7/10 for model: OpenComic AI Upscale Lite: 5.534s
Processing image 8/10 for model: OpenComic AI Upscale Lite: 5.555s
Processing image 9/10 for model: OpenComic AI Upscale Lite: 5.496s
Processing image 10/10 for model: OpenComic AI Upscale Lite: 5.898s
Model: OpenComic AI Upscale Lite, Latency: 52.087s
```

#### Enabled

``` bash
Preloading model... OpenComic AI Upscale Lite
Preload model: OpenComic AI Upscale Lite: 473.897ms
Processing image 1/10 for model: OpenComic AI Upscale Lite: 725.474ms
Processing image 2/10 for model: OpenComic AI Upscale Lite: 716.566ms
Processing image 3/10 for model: OpenComic AI Upscale Lite: 716.221ms
Processing image 4/10 for model: OpenComic AI Upscale Lite: 715.214ms
Processing image 5/10 for model: OpenComic AI Upscale Lite: 717.894ms
Processing image 6/10 for model: OpenComic AI Upscale Lite: 715.236ms
Processing image 7/10 for model: OpenComic AI Upscale Lite: 716.296ms
Processing image 8/10 for model: OpenComic AI Upscale Lite: 714.025ms
Processing image 9/10 for model: OpenComic AI Upscale Lite: 718.653ms
Processing image 10/10 for model: OpenComic AI Upscale Lite: 714.792ms
Model: OpenComic AI Upscale Lite, Latency: 7.646s
```

### RealESRGAN x4 Plus

#### Disabled

``` bash
Processing image 1/10 for model: RealESRGAN x4 Plus: 6.473s
Processing image 2/10 for model: RealESRGAN x4 Plus: 7.809s
Processing image 3/10 for model: RealESRGAN x4 Plus: 7.690s
Processing image 4/10 for model: RealESRGAN x4 Plus: 7.470s
Processing image 5/10 for model: RealESRGAN x4 Plus: 6.620s
Processing image 6/10 for model: RealESRGAN x4 Plus: 7.390s
Processing image 7/10 for model: RealESRGAN x4 Plus: 7.423s
Processing image 8/10 for model: RealESRGAN x4 Plus: 7.541s
Processing image 9/10 for model: RealESRGAN x4 Plus: 7.536s
Processing image 10/10 for model: RealESRGAN x4 Plus: 7.321s
Model: RealESRGAN x4 Plus, Latency: 73.273s
```

#### Enabled
``` bash
Preloading model... RealESRGAN x4 Plus
Preload model: RealESRGAN x4 Plus: 1.165s
Processing image 1/10 for model: RealESRGAN x4 Plus: 2.217s
Processing image 2/10 for model: RealESRGAN x4 Plus: 2.196s
Processing image 3/10 for model: RealESRGAN x4 Plus: 2.203s
Processing image 4/10 for model: RealESRGAN x4 Plus: 2.191s
Processing image 5/10 for model: RealESRGAN x4 Plus: 2.200s
Processing image 6/10 for model: RealESRGAN x4 Plus: 2.203s
Processing image 7/10 for model: RealESRGAN x4 Plus: 2.216s
Processing image 8/10 for model: RealESRGAN x4 Plus: 2.222s
Processing image 9/10 for model: RealESRGAN x4 Plus: 2.188s
Processing image 10/10 for model: RealESRGAN x4 Plus: 2.194s
Model: RealESRGAN x4 Plus, Latency: 23.199s
```

## Credits

This project uses the following AI models and upscalers:
- [Real-CUGAN](https://github.com/bilibili/ailab/tree/main/Real-CUGAN)
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
- [Waifu2x](https://github.com/nagadomi/waifu2x)
- [Upscayl](https://github.com/upscayl/upscayl)

## Related Projects

- [OpenComic](https://github.com/ollm/OpenComic)
- [`ollm/opencomic-ai-training`](https://github.com/ollm/opencomic-ai-training)
- [`ollm/opencomic-ai-models`](https://github.com/ollm/opencomic-ai-models)

## Citation (opencomic-ai-training)

If you use this project, please cite it as follows.

``` bibtex
@software{opencomic_ai,
    author = {Oleguer Llopart Mora},
    title = {{OpenComic AI}},
    year = {2026},
	version = {2.0},
    publisher = {GitHub},
    url = {https://github.com/ollm/opencomic-ai-training}
}
```

Release models citation. To see the differences between versions, you can check the [`CHANGELOG.md`](https://github.com/ollm/opencomic-ai-training/blob/master/CHANGELOG.md) file.

#### OpenComic AI v1.0

``` bibtex
@software{opencomic_ai_models_v1_0,
    author = {Oleguer Llopart Mora},
    title = {{OpenComic AI v1.0 Models}},
    year = {2026},
	version = {1.0},
    publisher = {GitHub},
    url = {https://github.com/ollm/opencomic-ai-training/releases/tag/v1.0}
}
```

#### OpenComic AI v2.0 (Still training)

``` bibtex
@software{opencomic_ai_models_v2_0,
    author = {Oleguer Llopart Mora},
    title = {{OpenComic AI v2.0 Models}},
    year = {2026},
	version = {2.0},
    publisher = {GitHub},
    url = {https://github.com/ollm/opencomic-ai-training/releases/tag/v2.0}
}
```

## License

| Component | License |
|---|---|
| Source code | MIT |
| OpenComic AI model weights | CC BY 4.0 |

The source code of this repository is licensed under the MIT License.

OpenComic AI model weights are licensed under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

See [LICENSE](LICENSE) and [LICENSE_MODELS](LICENSE_MODELS) for details.