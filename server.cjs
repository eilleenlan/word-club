const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['index.html', 'styles.css', 'words.js', 'app.js', 'speech.js', 'audio/this.ogg', 'audio-credits.html']);
allowed.add('practice.js');
require('./words.js');
for (const unit of globalThis.WORD_UNITS) {
  if (unit.grade === 1) for (const word of unit.words) allowed.add(`audio/unit${Number(unit.number)}/${word[0].toLowerCase().replace(/ /g, '-')}.mp3`);
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!allowed.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, name), (error, data) => {
    if (error) { res.writeHead(500); res.end('Unable to load file'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store' }); res.end(data);
  });
}).listen(4173, '127.0.0.1', () => console.log('Word Club preview: http://127.0.0.1:4173'));
