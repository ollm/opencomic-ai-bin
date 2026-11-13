import fs from 'fs';

const files = [
	// Linux binaries
	'./linux/x64/upscayl/upscayl-bin',
	'./linux/arm64/upscayl/upscayl-bin',

	// Mac binaries
	'./mac/x64/upscayl/upscayl-bin.app',
	'./mac/arm64/upscayl/upscayl-bin.app',
];

for(const file of files)
{
	try
	{
		fs.chmodSync(file, 0o755);
		console.log(`Permissions for ${file} set to 755`);
	}
	catch(err)
	{
		console.error(`Failed to set permissions for ${file}:`, err);
	}
}