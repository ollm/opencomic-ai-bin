import p from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import OpenComicAI from './index.mjs';
import {getArg, resolve} from './test-utils.mjs';

async function deleteFiles(directory: string): Promise<void>
{
	const entries = await fsp.readdir(directory, {withFileTypes: true});

	for(const entry of entries)
	{
		if(entry.isFile())
			await fsp.unlink(p.join(directory, entry.name));
	}
}

const modelsPath = resolve(getArg('--models-path') || './assets/models');
const model = getArg('--model') || '';
const image = resolve(getArg('--image') || '');
const dest = resolve(getArg('--dest') || './debug');

(async function(){

	await fsp.mkdir(dest, {recursive: true});
	await deleteFiles(dest);

	// Models path, if the model is not found in this folder, it will be downloaded
	OpenComicAI.setModelsPath(modelsPath);

	// Set sharp instance
	OpenComicAI.setSharp(sharp); 

	// Keep ICC profile from input image, requires sharp instance
	OpenComicAI.keepIccProfile('rgb16');

	await OpenComicAI.pipeline(image, p.join(dest, '/test.jpg'), [
		{
			model: 'opencomic-ai-descreen-hard-lite',
			// tileSize: 512,
			keepBigHalftone: {
				model: 'opencomic-ai-descreen-mask-balanced-v3-test2-100000',
				minSize: 2.5,
				// tileSize: 5120,
				tileSize: 512,
				artifactRemoval: {
					model: 'opencomic-ai-artifact-removal-compact',
				},
			},
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


	/*
	await OpenComicAI.pipeline(image, p.join(debugFolder, '/test-2.jpg'), [
		{
			model: 'opencomic-ai-descreen-hard-lite',
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
	*/
	

	console.log('END');

})();