import Potrace from 'oslllo-potrace';

import yolo, {Box} from '../yolo.mjs';

export type Turnpolicy = 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';

export interface PotraceOptions {
	turnpolicy?: Turnpolicy;
	turdsize?: number;
	optcurve?: boolean;
	opttolerance?: number;
}

export default async function potrace(boxes: Box[], options: PotraceOptions = {}): Promise<Box[]> {

	for(const box of boxes)
	{
		const buffer: Buffer = await yolo.sharp(Buffer.from(box.mask), {raw: {width: box.width, height: box.height, channels: 1}}).negate().flatten({background: '#ffffff'}).toFormat('png').toBuffer();
		const traced = await Potrace(buffer, options).trace();

		const path = traced.match(/d="([^"]*)"/)?.[1] || '';
		box.path = path.trim();
	}

	return boxes;

}

export {Potrace};