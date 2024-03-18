/// <reference types="bun-types" />
Bun.serve({
  port: 3000,
  async fetch(request: Request) {
    let url = new URL(request.url)

    // Handle API Requests
    if (url.pathname.startsWith("/api/")) {
      const api = url.pathname.slice(5);
      const file = Bun.file(`api/${api}.ts`);
      return file.exists().then((exists) => {
        if (exists) {
          return import(file.name!).then((mod) => mod.default(request));
        } else {
          return new Response("Not Found", { status: 404 });
        }
      })
    }

    // Handle public file requests
    if (request.method === "GET") {
      if (!url.pathname.includes(".")) {
        url.pathname += "/index.html";
      }

      // For example "localhost:3000/index.html" will be "public/index.html"
      const file = Bun.file(`public/${url.pathname}`);
      const exists = await file.exists();
      if (exists) {
        return new Response(file);
      } else {
        return new Response("Not Found", { status: 404 });
      }
    }
  }
})

console.log('Server running on http://localhost:3000')
