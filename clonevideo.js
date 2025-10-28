// Simple wrapper to allow: node clonevideo <youtube_url>
// Reuses existing create-mh370-32s-video.js which already supports positional URL or --url

const args = process.argv.slice(2);
if (!args.length) {
	console.log('Usage: node clonevideo <YouTube URL>');
}

// If first arg looks like a URL and no --url provided, set env var to help downstream
if (args.length && !args.join(' ').includes('--url')) {
	process.env.YOUTUBE_URL = args[0];
}

// This script executes the workflow immediately on require
require('./create-mh370-32s-video.js');


