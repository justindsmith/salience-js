import * as http from "http";
import * as fs from "fs";
import * as url from "url";
import * as path from "path";

import * as salience from "./salience";

function readFileAsString(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

let source_text: string;
let sentence_ranges: [number, number][];
let adjacency: number[][];
async function init() {
  source_text = await readFileAsString(
    path.join(__dirname, "../transcript.txt")
  );
  const a = await salience.extract(source_text);
  sentence_ranges = a.sentence_ranges;
  adjacency = (await a.adjacency.array()) as number[][];
}

init().then(() => {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request");
      return;
    }

    const parsedUrl = url.parse(req.url, true);

    if (!parsedUrl || parsedUrl.pathname === null) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request");
      return;
    }

    const sanitizePath = path
      .normalize(parsedUrl.pathname)
      .replace(/^(\.\.[\/\\])+/, "");

    if (sanitizePath === "/salience") {
      res.writeHead(200, { "Content-Type": "application/json" });

      const data = {
        source: source_text,
        intervals: sentence_ranges,
        adjacency: adjacency,
      };

      res.end(JSON.stringify(data));
      return;
    }

    if (sanitizePath.startsWith("/static/")) {
      fs.readFile(path.join(__dirname, sanitizePath), (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }

        res.writeHead(200);
        res.end(data);
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(5001, () => {
    console.log("Server is listening on port 5001");
  });
});
