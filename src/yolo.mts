import detect from './yolo/detect.mjs';
import render from './yolo/render.mjs';
import potrace, {PotraceOptions} from './yolo/potrace.mjs';

export interface Box {
	label: string;
	width: number;
	height: number;
	originalWidth: number;
	originalHeight: number;
	probability: number;
	box: [number, number, number, number];
	mask: Uint8Array,
	path?: string;
}

export interface Detection {
	image: string;
	width: number;
	height: number;
	originalWidth?: number;
	originalHeight?: number;
	matchInputSize?: boolean;
	boxes: Box[];
}

async function path(detection: Detection, options: PotraceOptions = {}): Promise<Detection> {

	detection.boxes = await potrace(detection.boxes, options);
	detection.matchInputSize = options.matchInputSize;
	return detection;

}

export default {
	path,
	render,
}