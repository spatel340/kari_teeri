import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerSocketHandlers } from "./socketHandlers.js";

type BasicRequest = {
  path: string;
};

type BasicResponse = {
  json: (body: unknown) => void;
  sendFile: (path: string) => void;
};

type BasicNextFunction = () => void;

const app = express();
const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDistPath = join(currentDir, "..", "..", "client", "dist");
const isProduction = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

app.get("/health", (_request: BasicRequest, response: BasicResponse) => {
  response.json({
    ok: true,
    service: "kari-teeri-server",
    timestamp: Date.now(),
  });
});

if (isProduction) {
  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get("*", (request: BasicRequest, response: BasicResponse, next: BasicNextFunction) => {
      if (request.path.startsWith("/socket.io")) {
        next();
        return;
      }

      response.sendFile(join(clientDistPath, "index.html"));
    });
  } else {
    console.warn(`Client build not found at ${clientDistPath}. Skipping static hosting.`);
  }
}

const httpServer = createServer(app);
registerSocketHandlers(httpServer);

const PORT = Number(process.env.PORT ?? 3001);

httpServer.listen(PORT, () => {
  console.log(`Kari Teeri server listening on http://localhost:${PORT}`);
});
