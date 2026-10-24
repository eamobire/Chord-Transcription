// Desktop shell for ChordMagic: serves the static Next.js export from web/
// through a private app:// scheme, so absolute paths like /_next/... and the
// Essentia WASM files resolve exactly as they do on a web server.

const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WEB_ROOT = path.join(__dirname, 'web');

protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function serveFile(request) {
    let relative = decodeURIComponent(new URL(request.url).pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const filePath = path.normalize(path.join(WEB_ROOT, relative));
    // Never serve anything outside the bundled web folder
    if (!filePath.startsWith(WEB_ROOT + path.sep)) {
        return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        minWidth: 480,
        minHeight: 600,
        title: 'ChordMagic',
        backgroundColor: '#121212',
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    // Links to websites open in the user's browser, not inside the app
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
        return { action: 'deny' };
    });

    win.loadURL('app://chordmagic/');
}

app.whenReady().then(() => {
    protocol.handle('app', serveFile);
    createWindow();

    // macOS: re-open a window when the dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
