import sharp from 'sharp';
import OpenComicAI from './index.mjs';
import {getArg, resolve} from './test-utils.mjs';

const modelsPath = resolve(getArg('--models-path') || './assets/models');
const model = getArg('--model') || '';
const image = resolve(getArg('--image') || '');
const dest = resolve(getArg('--dest') || './debug');

console.log(model, image);


if(!model || !image)
{
	console.error('Usage: npm run prepare && node ./dist/test-panels.mjs --model <modelName> --image <image.jpg>');
	process.exit(1);
}

(async function(){

	// Models path, if the model is not found in this folder, it will be downloaded
	OpenComicAI.setModelsPath(modelsPath);

	// Set sharp instance
	OpenComicAI.setSharp(sharp); 

	/*
	const _yolo: Yolo = {
		model,
		labels: ['panel'],
		providers: ['cpu'],
		inputShape: [1, 3, 640, 640],
		topk: 1000,
		scoreThreshold: 0.7,
		mask: {
			threshold: 0.5,
			minArea: 0,
			scale: 1,
			baseScale: 'model',
			cropToBox: 4,
			maxComponents: 1,
		},
	};
	*/

	const options = {
		model,
		/*upscale: {
			model: 'opencomic-ai-upscale-compact', // TODO: Train a model specifically for this?
			scale: 4,
		},*/
	};

	console.time('Detection 1');
	const _detection = await OpenComicAI.panels.image(image, options);
	console.timeEnd('Detection 1');

	console.log(_detection);

	const detection = await OpenComicAI.panels.path(_detection, {matchInputSize: true});
	console.log(detection);

	await OpenComicAI.panels.render(dest, detection, {
		// input: true,
		mask: {
			transparent: false,
		},
		overlay: {
			opacity: 0.5,
		},
		overlayMask: {
			opacity: 0.5,
		},
		path: {
			opacity: 0.5,
		},
		result: true,
	});

	process.exit(0);

})();