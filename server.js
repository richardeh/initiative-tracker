const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const COLLECTIONS_DIR = path.join(__dirname, 'collections');

// Ensure collections directory exists
if (!fs.existsSync(COLLECTIONS_DIR)) {
    fs.mkdirSync(COLLECTIONS_DIR);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle API routes for collections
    if (pathname.startsWith('/api/collections')) {
        if (req.method === 'GET' && pathname === '/api/collections') {
            // List all collections
            fs.readdir(COLLECTIONS_DIR, (err, files) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to read collections' }));
                    return;
                }
                const collections = files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(collections));
            });
        } else if (req.method === 'POST' && pathname === '/api/collections') {
            // Save a collection
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { name, tiles } = JSON.parse(body);
                    if (!name || !Array.isArray(tiles)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid data' }));
                        return;
                    }
                    const filePath = path.join(COLLECTIONS_DIR, `${name}.json`);
                    fs.writeFile(filePath, JSON.stringify(tiles, null, 2), err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save collection' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'GET' && pathname.startsWith('/api/collections/')) {
            // Load a collection
            const encodedName = pathname.split('/api/collections/')[1];
            const name = decodeURIComponent(encodedName);
            const filePath = path.join(COLLECTIONS_DIR, `${name}.json`);
            fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Collection not found' }));
                    return;
                }
                try {
                    const tiles = JSON.parse(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(tiles));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid collection data' }));
                }
            });
        } else if (req.method === 'PUT' && pathname.startsWith('/api/collections/')) {
            // Rename a collection
            const encodedOldName = pathname.split('/api/collections/')[1];
            const oldName = decodeURIComponent(encodedOldName);
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { newName } = JSON.parse(body);
                    if (!newName) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'New name required' }));
                        return;
                    }
                    const oldPath = path.join(COLLECTIONS_DIR, `${oldName}.json`);
                    const newPath = path.join(COLLECTIONS_DIR, `${newName}.json`);
                    fs.rename(oldPath, newPath, err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to rename collection' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'DELETE' && pathname.startsWith('/api/collections/')) {
            // Delete a collection
            const encodedName = pathname.split('/api/collections/')[1];
            const name = decodeURIComponent(encodedName);
            const filePath = path.join(COLLECTIONS_DIR, `${name}.json`);
            fs.unlink(filePath, err => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to delete collection' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
        }
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/initiative-tracker.html' : req.url;
    filePath = path.join(__dirname, filePath);

    fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found\n');
            return;
        }

        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        if (ext === '.html') contentType = 'text/html';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.json') contentType = 'application/json';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(80, () => {
    console.log('Server listening on port 80');
});