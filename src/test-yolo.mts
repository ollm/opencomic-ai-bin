import sharp from 'sharp';
import yolo, {Yolo} from './yolo.mjs';
import {getArg, resolve} from './test-utils.mjs';

const model = resolve(getArg('--model') || '');
const image = resolve(getArg('--image') || '');
const dest = resolve(getArg('--dest') || './debug');

console.log(model, image, dest);

if(!model || !image)
{
	console.error('Usage: npm run prepare && node ./dist/test-yolo.mjs --model <model.onnx> --image <image.jpg> [--dest <output_directory>]');
	process.exit(1);
}

(async function(){

	yolo.setSharp(sharp);

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

	yolo.setIdleTimeout(500);

	console.time('Detection 1');
	const _detection = await yolo.image(image, _yolo);
	console.timeEnd('Detection 1');

	console.time('Detection 2');
	const _detection2 = await yolo.image(image, _yolo);
	console.timeEnd('Detection 2');

	const detection = await yolo.path(_detection);

	await yolo.render(dest, detection, {
		yoloInput: true,
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

	// console.log(detection);

})();