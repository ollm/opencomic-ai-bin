import p from 'node:path';

export function getArg(arg: string): string | null
{
	const index = process.argv.indexOf(arg);
	if(index === -1) return null;

	const value = process.argv[index + 1];
	if(!value || value.startsWith('--')) return null;

	return value;
}

export function resolve(path: string): string
{
	if(!p.isAbsolute(path))
	{
		if(typeof module !== 'undefined')
			path = p.resolve(module?.parent?.path ?? '', '../', path);
		else
			path = p.resolve(import.meta?.dirname ?? '', '../', path);
	}

	return p.normalize(path);
}
