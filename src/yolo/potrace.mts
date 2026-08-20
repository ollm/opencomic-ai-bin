import Potrace from 'oslllo-potrace';

import OpenComicAI from '../index.mjs';
import {Box} from '../yolo.mjs';

export type Turnpolicy = 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';

export interface PotraceOptions {
	turnpolicy?: Turnpolicy;
	turdsize?: number;
	optcurve?: boolean;
	opttolerance?: number;
	matchInputSize?: boolean;
}

interface OriginalSize {
	top: number;
	left: number;
	width: number;
	height: number;
	originalWidth: number;
	originalHeight: number;
}

function resizePath(_string: string, {top = 0, left = 0, width = 0, height = 0, originalWidth = 0, originalHeight = 0}: OriginalSize = {}): {path: string; width: number; height: number} {

	const diffY = originalHeight / height;
	const diffX = originalWidth / width;

	const split = _string.split(/(-?[0-9]+(?:\.[0-9]+)?\s+-?[0-9]+(?:\.[0-9]+)?)/).map(v => v.trim()).filter(v => v.length > 0);

	let _width = 0;
	let _height = 0;

	for(let i = 0; i < split.length; i++)
	{
		const v = split[i];

		if(/(-?[0-9]+(?:\.[0-9]+)?\s+-?[0-9]+(?:\.[0-9]+)?)/.test(v))
		{
			let [x, y] = v.split(/\s+/).map(v => parseFloat(v));

			x = x * diffX + left;
			y = y * diffY + top;

			if(x > _width) _width = x;
			if(y > _height) _height = y;

			split[i] = `${x} ${y}`;
		}
	}

	return {path: split.join(' '), width: _width, height: _height};

};

export default async function potrace(boxes: Box[], options: PotraceOptions = {}): Promise<Box[]> {

	for(const box of boxes)
	{
		const buffer: Buffer = await OpenComicAI.sharp(Buffer.from(box.mask), {raw: {width: box.width, height: box.height, channels: 1}}).negate().flatten({background: '#ffffff'}).toFormat('png').toBuffer();
		const traced = await Potrace(buffer, options).trace();

		const path = traced.match(/d="([^"]*)"/)?.[1] || '';
		box.path = path.trim() as string;

		if(options.matchInputSize)
		{
			box.path = resizePath(box.path, {
				top: 0,
				left: 0,
				width: box.width,
				height: box.height,
				originalWidth: box.originalWidth,
				originalHeight: box.originalHeight,
			}).path;

			box.box = [
				box.box[0] * (box.originalWidth / box.width),
				box.box[1] * (box.originalHeight / box.height),
				box.box[2] * (box.originalWidth / box.width),
				box.box[3] * (box.originalHeight / box.height),
			];
		}
	}

	return boxes;

}

export {Potrace};