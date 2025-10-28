const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');

let serverProcess = null;

async function createWindow() {
	const win = new BrowserWindow({
		width: 1280,
		height: 800,
		webPreferences: { nodeIntegration: false, contextIsolation: true }
	});

	// Start Node server if not already
	if (!serverProcess) {
		serverProcess = spawn('node', ['server.js'], {
			cwd: path.join(__dirname, '..'),
			stdio: 'inherit',
			shell: process.platform === 'win32'
		});
	}

	// Wait for server port
	await waitOn({ resources: ['tcp:localhost:8888'], timeout: 30000 });

	// Load existing HTML without changes
	await win.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
	if (serverProcess) {
		try { serverProcess.kill(); } catch (_) {}
	}
});


