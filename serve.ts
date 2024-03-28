/// <reference types="bun-types" />
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';

Bun.serve({
  port: 3000,
  async fetch(request: Request) {
    let url = new URL(request.url);

    // Common headers for caching
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=31536000'); // Example: Cache static content for 1 year

    // Handle API Requests
    if (url.pathname.startsWith("/api/")) {
      const api = url.pathname.slice(5);
      const file = Bun.file(`api/${api}.ts`);
      return file.exists().then((exists) => {
        if (exists) {
          headers.set('Cache-Control', 'no-cache'); // API responses should not be cached
          return import(file.name!).then((mod) => mod.default(request));
        } else {
          return new Response("Not Found", { status: 404, headers });
        }
      });
    }

    // Determine if the client accepts gzip encoding
    const acceptEncoding = request.headers.get('Accept-Encoding') ?? '';
    const canGzip = acceptEncoding.includes('gzip');

    // Handle public file requests
    if (request.method === "GET") {
      if (!url.pathname.includes(".")) {
        url.pathname += "/index.html";
      }

      const path = `public/${url.pathname}`;
      const file = Bun.file(path);
      const exists = await file.exists();

      if (exists) {
        const fileBuffer = await file.arrayBuffer();
        const fileHash = createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

        // ETag and conditional GET support
        const ifNoneMatch = request.headers.get('If-None-Match');
        if (ifNoneMatch === fileHash) {
          return new Response(null, { status: 304, headers }); // Not Modified
        }
        headers.set('ETag', fileHash);

        if (canGzip) {
          // Compress the content using zlib if the client accepts gzip encoding
          return new Promise((resolve, reject) => {
            zlib.gzip(Buffer.from(fileBuffer), (err, buffer) => {
              if (err) {
                reject(new Response("Internal Server Error", { status: 500 }));
              } else {
                headers.set('Content-Encoding', 'gzip');
                headers.set('Content-Type', determineContentType(path));
                resolve(new Response(buffer, { headers }));
              }
            });
          });
        } else {
          // Serve non-compressed file if gzip is not supported
          headers.set('Content-Type', determineContentType(path));
          return new Response(fileBuffer, { headers });
        }
      } else {
        return new Response("Not Found", { status: 404, headers });
      }
    }
  }
});

console.log('Server running on http://localhost:3000');

function determineContentType(path: string): string {
  const extension = path.split('.').pop();
  switch (extension) {
    case 'html':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
      return 'text/javascript';
    case 'ico':
      return 'image/x-icon';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
