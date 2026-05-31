// routes/referenceLibrary.ts – API endpoints for the Reference Image Library.

import express, { Router, Request, Response } from "express";
import {
  listReferenceLibrary,
  saveReferenceImageToLibrary,
  deleteReferenceLibraryItem,
  clearReferenceLibrary,
  useReferenceLibraryItem,
} from "../lib/referenceLibrary.js";

export const referenceLibraryRouter = Router();

const rawMultipart = express.raw({
  type: "multipart/form-data",
  limit: "15mb",
});

function parseMultipartFile(body: Buffer, contentTypeHeader: string): { filename: string; mimeType: string; data: Buffer } | null {
  const boundaryMatch = contentTypeHeader.match(/boundary=(.+)$/i);
  if (!boundaryMatch) return null;
  const boundary = "--" + boundaryMatch[1];
  const boundaryBuffer = Buffer.from(boundary);

  const parts: Buffer[] = [];
  let index = body.indexOf(boundaryBuffer);
  while (index !== -1) {
    const nextIndex = body.indexOf(boundaryBuffer, index + boundaryBuffer.length);
    if (nextIndex !== -1) {
      parts.push(body.subarray(index + boundaryBuffer.length, nextIndex));
      index = nextIndex;
    } else {
      break;
    }
  }

  for (const part of parts) {
    const headersEndIndex = part.indexOf("\r\n\r\n");
    if (headersEndIndex === -1) continue;

    const headersStr = part.subarray(0, headersEndIndex).toString("utf-8");
    const contentDispositionMatch = headersStr.match(/Content-Disposition:\s*form-data;\s*name="[^"]+";\s*filename="([^"]+)"/i);
    if (!contentDispositionMatch) continue;

    const filename = contentDispositionMatch[1];
    const contentTypeMatch = headersStr.match(/Content-Type:\s*([^\r\n]+)/i);
    const mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : "image/jpeg";

    const dataStart = headersEndIndex + 4;
    let dataEnd = part.length - 2;
    if (part.subarray(part.length - 4, part.length).toString() === "--\r\n") {
      dataEnd = part.length - 4;
    }
    if (dataStart >= dataEnd) continue;

    const data = part.subarray(dataStart, dataEnd);
    return { filename, mimeType, data };
  }

  return null;
}

// GET /api/reference-library
referenceLibraryRouter.get("/", (_req: Request, res: Response) => {
  try {
    const list = listReferenceLibrary();
    res.json({ success: true, items: list });
  } catch (err) {
    console.error("[route:refLibrary] Failed to list reference library:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// POST /api/reference-library
referenceLibraryRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
       res.status(400).json({ success: false, error: "Missing filename or base64 data" });
       return;
    }
    const item = await saveReferenceImageToLibrary(filename, base64);
    res.json({ success: true, item });
  } catch (err) {
    console.error("[route:refLibrary] Failed to save reference image:", err);
    res.status(500).json({ success: false, error: "Failed to process and save reference image" });
  }
});

// POST /api/reference-library/upload
referenceLibraryRouter.post("/upload", rawMultipart, async (req: Request, res: Response) => {
  try {
    const contentType = req.headers["content-type"];
    if (!contentType || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ success: false, error: "Missing multipart content-type or empty body" });
      return;
    }

    const parsed = parseMultipartFile(req.body, contentType);
    if (!parsed) {
      res.status(400).json({ success: false, error: "Failed to parse uploaded file from multipart form" });
      return;
    }

    const base64 = parsed.data.toString("base64");
    const item = await saveReferenceImageToLibrary(parsed.filename, base64);
    res.json({ success: true, item });
  } catch (err) {
    console.error("[route:refLibrary] Upload failed:", err);
    res.status(500).json({
      success: false,
      error: "이미지를 보관함에 저장하지 못했습니다. JPG로 변환하거나 해상도를 낮춰 다시 시도해 주세요.",
    });
  }
});

// POST /api/reference-library/:id/use
referenceLibraryRouter.post("/:id/use", (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
       res.status(400).json({ success: false, error: "Missing item ID" });
       return;
    }
    const item = useReferenceLibraryItem(id as string);
    if (item) {
      res.json({ success: true, item });
    } else {
      res.status(404).json({ success: false, error: "Item not found" });
    }
  } catch (err) {
    console.error("[route:refLibrary] Failed to use reference image:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// DELETE /api/reference-library/:id
referenceLibraryRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
       res.status(400).json({ success: false, error: "Missing item ID" });
       return;
    }
    const success = deleteReferenceLibraryItem(id as string);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: "Item not found" });
    }
  } catch (err) {
    console.error("[route:refLibrary] Failed to delete reference image:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// DELETE /api/reference-library
referenceLibraryRouter.delete("/", (_req: Request, res: Response) => {
  try {
    const success = clearReferenceLibrary();
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: "Failed to clear reference library" });
    }
  } catch (err) {
    console.error("[route:refLibrary] Failed to clear reference library:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});
