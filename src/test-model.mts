import p from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import OpenComicAI from './index.mjs';
import {getArg, resolve} from './test-utils.mjs';

const modelsPath = resolve(getArg('--models-path') || './assets/models');
const model = getArg('--model') || '';
const scale = getArg('--scale') || 2;
const noise = getArg('--noise') || undefined;
const image = resolve(getArg('--image') || '');
const dest = resolve(getArg('--dest') || './debug');

if(!model || !image)
{
	console.error(`Usage: npm run prepare && node ./dist/test-model.mjs --model <modelName> --image <image.jpg>`);
	process.exit(1);
}

(async function(){

	await fsp.mkdir(dest, {recursive: true});

	// Models path, if the model is not found in this folder, it will be downloaded
	OpenComicAI.setModelsPath(modelsPath);

	// Keep ICC profile from input image, requires sharp instance
	OpenComicAI.keepIccProfile('rgb16');

	await OpenComicAI.pipeline(image, p.join(dest, `/test-${model}-${scale}x-${noise ?? 'none'}.png`), [
		{
			model: model,
			scale: Number(scale),
			noise: noise === undefined ? noise : Number(noise) as -1 | 0 | 1 | 2 | 3,
			// tileSize: 512,
		},
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

	console.log('END');

})();