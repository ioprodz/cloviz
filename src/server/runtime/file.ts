import { IS_BUN } from "./detect";
import { existsSync, readFileSync, createReadStream } from "fs";

export async function fileExistsAsync(path: string): Promise<boolean> {
  if (IS_BUN) {
    return Bun.file(path).exists();
  }
  return existsSync(path);
}

export function fileResponse(path: string, contentType?: string): Response {
  if (IS_BUN) {
    const file = Bun.file(path);
    if (contentType) {
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    }
    return new Response(file);
  }

  const content = readFileSync(path);
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  } else {
    // Infer content type from extension
    const ext = path.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      webp: "image/webp",
      gif: "image/gif",
      txt: "text/plain",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
    };
    if (ext && mimeMap[ext]) {
      headers["Content-Type"] = mimeMap[ext];
    }
  }
  return new Response(content, { headers });
}

export function fileStreamResponse(path: string, contentType?: string): Response {
  if (IS_BUN) {
    const file = Bun.file(path);
    return new Response(file.stream(), {
      headers: contentType ? { "Content-Type": contentType } : {},
    });
  }

  const stream = createReadStream(path);
  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new Response(readable, {
    headers: contentType ? { "Content-Type": contentType } : {},
  });
}
