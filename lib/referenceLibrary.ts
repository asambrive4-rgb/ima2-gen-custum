// lib/referenceLibrary.ts – Reference image library business logic.

import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import crypto from "crypto";
import { ulid } from "ulid";
import sharp from "sharp";
import { getDb } from "./db.js";
import { config } from "../config.js";

const MAX_REFERENCE_LIBRARY_ITEMS = 100;

export interface ReferenceLibraryItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  hash: string;
  url: string;
  createdAt: number;
  lastUsedAt: number;
}

function ensureLibraryDirectory() {
  const dir = config.storage.referenceLibraryDir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function calculateHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getExtensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  return ".jpg";
}

/**
 * Lists all items in the reference library, ordered by last used time descending.
 */
export function listReferenceLibrary(): ReferenceLibraryItem[] {
  const db = getDb();
  try {
    const rows = db.prepare("SELECT * FROM reference_library ORDER BY COALESCE(last_used_at, created_at) DESC, created_at DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      originalName: r.original_name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      width: r.width,
      height: r.height,
      hash: r.hash,
      url: r.url,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    }));
  } catch (err) {
    console.error("[referenceLibrary] Failed to list reference library:", err);
    return [];
  }
}

/**
 * Saves a compressed reference base64 image to the server file system and registers it in SQLite.
 * Handles deduplication (matching SHA256 hashes) and caps the library at 100 items.
 */
export async function saveReferenceImageToLibrary(
  originalName: string,
  base64DataString: string
): Promise<ReferenceLibraryItem> {
  const dir = ensureLibraryDirectory();
  const db = getDb();

  // Strip prefix if any
  const base64Data = base64DataString.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const sizeBytes = buffer.length;

  const hash = calculateHash(buffer);

  // 1. Deduplication check: check if an identical file hash already exists
  try {
    const existing = db.prepare("SELECT * FROM reference_library WHERE hash = ?").get(hash) as any;
    if (existing) {
      const now = Date.now();
      db.prepare("UPDATE reference_library SET last_used_at = ? WHERE id = ?").run(now, existing.id);
      return {
        id: existing.id,
        filename: existing.filename,
        originalName: existing.original_name,
        mimeType: existing.mime_type,
        sizeBytes: existing.size_bytes,
        width: existing.width,
        height: existing.height,
        hash: existing.hash,
        url: existing.url,
        createdAt: existing.created_at,
        lastUsedAt: now,
      };
    }
  } catch (err) {
    console.error("[referenceLibrary] Dedupe check failed:", err);
  }

  // 2. Extract image metadata (dimensions and mime-type format) using sharp
  let width: number | null = null;
  let height: number | null = null;
  let mimeType = "image/jpeg";
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width || null;
    height = meta.height || null;
    mimeType = meta.format ? `image/${meta.format}` : "image/jpeg";
  } catch (err) {
    console.warn("[referenceLibrary] Sharp metadata extraction fallback:", err);
  }

  const id = ulid();
  const extension = getExtensionForMime(mimeType);
  const filename = `${id}${extension}`;
  const filePath = join(dir, filename);

  // 3. Write file to safety-isolated system storage
  writeFileSync(filePath, buffer);

  const url = `/reference-library/${filename}`;
  const now = Date.now();

  // 4. Save metadata to DB
  try {
    db.prepare(`
      INSERT INTO reference_library (
        id, filename, original_name, mime_type, size_bytes, width, height, hash, url, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, filename, originalName, mimeType, sizeBytes, width, height, hash, url, now, now);
  } catch (err) {
    console.error("[referenceLibrary] DB insertion failed:", err);
    try { unlinkSync(filePath); } catch {}
    throw err;
  }

  // 5. Cap limit check: enforce 100 items by evicting oldest/least used items based on lastUsedAt
  try {
    const totalCount = (db.prepare("SELECT count(*) as count FROM reference_library").get() as any).count;
    if (totalCount > MAX_REFERENCE_LIBRARY_ITEMS) {
      const excess = totalCount - MAX_REFERENCE_LIBRARY_ITEMS;
      const toEvict = db.prepare("SELECT id, filename FROM reference_library ORDER BY COALESCE(last_used_at, created_at) ASC, created_at ASC LIMIT ?").all(excess) as any[];
      
      for (const item of toEvict) {
        // Safe delete files
        const evictPath = join(dir, item.filename);
        try {
          if (existsSync(evictPath)) {
            unlinkSync(evictPath);
          }
        } catch (fileErr) {
          console.warn("[referenceLibrary] Failed to delete evicted file:", fileErr);
        }
        // Delete records
        db.prepare("DELETE FROM reference_library WHERE id = ?").run(item.id);
      }
    }
  } catch (err) {
    console.error("[referenceLibrary] Capping eviction failed:", err);
  }

  return {
    id,
    filename,
    originalName,
    mimeType,
    sizeBytes,
    width,
    height,
    hash,
    url,
    createdAt: now,
    lastUsedAt: now,
  };
}

/**
 * Updates the lastUsedAt time of a reference library item to the current timestamp.
 * Returns the updated ReferenceLibraryItem or null if not found.
 */
export function useReferenceLibraryItem(id: string): ReferenceLibraryItem | null {
  const db = getDb();
  const now = Date.now();
  try {
    db.prepare("UPDATE reference_library SET last_used_at = ? WHERE id = ?").run(now, id);
    const r = db.prepare("SELECT * FROM reference_library WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      filename: r.filename,
      originalName: r.original_name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      width: r.width,
      height: r.height,
      hash: r.hash,
      url: r.url,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    };
  } catch (err) {
    console.error("[referenceLibrary] Failed to update lastUsedAt on item use:", err);
    return null;
  }
}

/**
 * Deletes a reference library item by its unique ID.
 */
export function deleteReferenceLibraryItem(id: string): boolean {
  const dir = ensureLibraryDirectory();
  const db = getDb();

  try {
    const item = db.prepare("SELECT filename FROM reference_library WHERE id = ?").get(id) as any;
    if (!item) return false;

    // Remove from file system
    const filePath = join(dir, item.filename);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (fileErr) {
      console.warn("[referenceLibrary] Failed to delete file on item removal:", fileErr);
    }

    // Remove from DB
    db.prepare("DELETE FROM reference_library WHERE id = ?").run(id);
    return true;
  } catch (err) {
    console.error("[referenceLibrary] Item deletion failed:", err);
    return false;
  }
}

/**
 * Clears all items in the reference library.
 */
export function clearReferenceLibrary(): boolean {
  const dir = ensureLibraryDirectory();
  const db = getDb();

  try {
    const items = db.prepare("SELECT filename FROM reference_library").all() as any[];
    for (const item of items) {
      const filePath = join(dir, item.filename);
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.warn("[referenceLibrary] Failed to clear file:", fileErr);
      }
    }

    db.prepare("DELETE FROM reference_library").run();
    return true;
  } catch (err) {
    console.error("[referenceLibrary] Library clear failed:", err);
    return false;
  }
}
