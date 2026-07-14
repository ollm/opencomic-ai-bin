import type {InferenceSession} from 'onnxruntime-node';

import detect from './yolo/detect.mjs';
import render from './yolo/render.mjs';
import potrace, {PotraceOptions} from './yolo/potrace.mjs';

type Provider = 'webgl' | 'cpu' | 'cuda';

export interface Yolo {
	model: string;
	labels: string[];
	providers: Provider[];
	inputShape: number[];
	topk?: number;
	scoreThreshold?: number;
	mask?: {
		threshold?: number;
		minArea?: number;
		scale?: number;
		baseScale?: 'model' | 'image';
		cropToBox?: boolean | number;
		fillHoles?: boolean;
		maxComponents?: number;
	};
}

export interface Box {
	label: string;
	width: number;
	height: number;
	probability: number;
	box: [number, number, number, number];
	mask: Uint8Array,
	path?: string;
}

export interface Detection {
	image: string;
	yolo: Yolo;
	width: number;
	height: number;
	boxes: Box[];
}

export interface ModelSession {
	net: InferenceSession;
	timeout?: NodeJS.Timeout;
}

let sharp: any = false;
let idleTimeout = 60000;
let onnxRuntimeNodePromise: Promise<typeof import('onnxruntime-node')> | undefined;

let models = new Map<string, ModelSession>();

async function getOnnxRuntimeNode(): Promise<typeof import('onnxruntime-node')> {

	if(!onnxRuntimeNodePromise)
	{
		onnxRuntimeNodePromise = import('onnxruntime-node').catch(function(error) {

			onnxRuntimeNodePromise = undefined;

			throw new Error(
				`The optional dependency "onnxruntime-node" is required for YOLO detection. Install it with "npm install onnxruntime-node". Original error: ${error instanceof Error ? error.message : String(error)}`
			);

		});
	}

	return onnxRuntimeNodePromise;
}

async function loadModel({model, providers = ['webgl', 'cpu']}: Yolo): Promise<ModelSession> {

	const key = `${model}-${providers.join(',')}`;

	if(models.has(key))
	{
		const session = models.get(key)!;

		if(session.timeout)
		{
			clearTimeout(session.timeout);
			session.timeout = undefined;
		}

		return session;
	}

	const {InferenceSession} = await getOnnxRuntimeNode();

	const net = await InferenceSession.create(model, {
		executionProviders: providers,
	});

	models.set(key, {net});

	return {
		net,
	};
}

function closeIdleSession(session: ModelSession, {model, providers}: Yolo): void {

	const key = `${model}-${providers.join(',')}`;

	session.timeout = setTimeout(function() {

		const _session = models.get(key);

		if(_session)
		{
			_session.net.release();
			models.delete(key);
		}

	}, idleTimeout);

}

async function image(source: string, yolo: Yolo): Promise<Detection> {

	const session = await loadModel(yolo);
	const detected = await detect(source, session, yolo);

	closeIdleSession(session, yolo);

	return {
		image: source,
		yolo,
		width: detected.width,
		height: detected.height,
		boxes: detected.boxes,
	};
}

async function path(detection: Detection, options: PotraceOptions = {}): Promise<Detection> {

	detection.boxes = await potrace(detection.boxes, options);
	return detection;

}

function setIdleTimeout(timeout: number = 60000): void {

	idleTimeout = timeout;

}

function setSharp(_sharp: any): void {

	sharp = _sharp;

}

export default {
	image,
	path,
	setIdleTimeout,
	setSharp,
	render,
	get sharp() {return sharp},
}