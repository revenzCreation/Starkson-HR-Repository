/* Temporary local static server for verification. Delete when finished. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/svg+xml"
};

const PORT = 5500;

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const filePath = path.join(process.cwd(), urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found: " + urlPath);
      return;
    }
    const csp = "default-src 'self'; base-uri 'self'; object-src 'self' https://drive.google.com; frame-src 'self' https://drive.google.com https://docs.google.com https://*.googleusercontent.com; child-src 'self' https://drive.google.com https://docs.google.com https://*.googleusercontent.com; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com https://drive.google.com https://*.drive.google.com https://images.unsplash.com https://fonts.gstatic.com; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; connect-src 'self' https://script.google.com https://*.googleapis.com https://*.googleusercontent.com; form-action 'self' https://script.google.com; upgrade-insecure-requests";

    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Security-Policy": csp,
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    res.end(data);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log("serving on http://127.0.0.1:" + PORT);
});
