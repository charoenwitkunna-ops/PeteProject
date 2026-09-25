import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const dbName = "found-ans";
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "2mb" }));

const blockedStaticPaths = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/README.md",
  "/.env",
  "/.env.example"
]);

app.use((request, response, next) => {
  if (blockedStaticPaths.has(request.path)) {
    return response.status(404).send("Not found");
  }
  return next();
});

app.use(express.static(__dirname));

// Simple in-memory sliding-window rate limiter (no external deps)
const rateLimits = new Map();
function rateLimiter({ windowMs = 60 * 1000, max = 30, message = "Too many requests, please try again later." } = {}) {
  return (req, res, next) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimits.get(key) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    rateLimits.set(key, record);

    if (record.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now > record.resetTime) rateLimits.delete(key);
  }
}, 5 * 60 * 1000).unref();

let firestoreInstance = null;
let firebaseAuthInstance = null;

function getServices() {
  if (!firestoreInstance) {
    const firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      credential: process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
        ? cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        })
        : applicationDefault()
    };
    const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);
    firestoreInstance = getFirestore(firebaseApp);
    firebaseAuthInstance = getAuth(firebaseApp);
  }
  return { firestore: firestoreInstance, firebaseAuth: firebaseAuthInstance };
}

const cache = new Map();
const CACHE_TTL = {
  catalog: 5 * 60 * 1000,
  item: 60 * 1000,
  categories: 30 * 60 * 1000
};

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCache(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

function invalidateItem(itemId) {
  for (const key of cache.keys()) {
    if (key.startsWith("items:") || (itemId && key.startsWith(`item:${itemId}:`))) {
      cache.delete(key);
    }
  }
}

function serializeDocument(document, { includePrivate = false } = {}) {
  const data = document.data();

  if (includePrivate) {
    return { id: document.id, ...data };
  }

  // privateNotes remain hidden from students; ownerName is visible to all
  const { privateNotes, ...publicData } = data;
  return {
    id: document.id,
    ...publicData
  };
}

function bearerToken(request) {
  const header = request.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function requireAuth(request, response, next) {
  const token = bearerToken(request);

  if (!token) {
    return response.status(401).json({ error: "Authentication required." });
  }

  try {
    const { firebaseAuth } = getServices();
    request.user = await firebaseAuth.verifyIdToken(token);
    return next();
  } catch {
    return response.status(401).json({ error: "Invalid or expired session." });
  }
}

function requireAuthority(request, response, next) {
  const role = request.user?.role || request.user?.authority;
  if (role !== "AUTHORITY" && request.user?.authority !== true) {
    return response.status(403).json({ error: "Authority access required." });
  }
  return next();
}

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined)
  );
}

const MAX_ITEM_IMAGE_BYTES = 450 * 1024;
const MAX_ITEM_IMAGE_DATA_CHARS = 600 * 1024;

function normalizeImage(image) {
  const data = image?.data;
  const contentType = image?.contentType;
  const isDataUrl = typeof data === "string"
    && /^data:image\/(webp|jpeg|jpg|png);base64,[a-z0-9+/=]+$/i.test(data);

  if (!isDataUrl) {
    const error = new Error("Item photo must be a valid image data URL (WebP or JPEG).");
    error.statusCode = 400;
    throw error;
  }

  const base64 = data.slice(data.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor(base64.length * 3 / 4) - padding;

  if (data.length > MAX_ITEM_IMAGE_DATA_CHARS || byteLength > MAX_ITEM_IMAGE_BYTES) {
    const error = new Error("Item photo is too large. Maximum compressed size is 450 KB.");
    error.statusCode = 400;
    throw error;
  }

  const detectedMime = data.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";

  return {
    kind: "embedded",
    data,
    contentType: contentType || detectedMime,
    byteLength
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ service: dbName, status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/me", requireAuth, (request, response) => {
  response.json({
    uid: request.user.uid,
    email: request.user.email || null,
    name: request.user.name || null,
    role: request.user.role === "AUTHORITY" || request.user.authority === true
      ? "AUTHORITY"
      : "STUDENT"
  });
});

app.get("/api/items", requireAuth, async (request, response) => {
  const requestedStatus = request.query.status;
  const isAuthority = request.user.role === "AUTHORITY" || request.user.authority === true;
  const status = isAuthority && ["ACTIVE", "CLAIMED", "ALL"].includes(requestedStatus)
    ? requestedStatus
    : "ACTIVE";
  const cacheKey = `items:${status}:${isAuthority ? "authority" : "student"}`;

  try {
    const cached = readCache(cacheKey);
    if (cached) return response.json(cached);

    const { firestore } = getServices();
    let query = firestore.collection("items");
    if (status !== "ALL") query = query.where("status", "==", status);
    
    // Fetch documents matching status filter, then sort in memory to avoid Firestore composite index requirement
    const snapshot = await query.get();
    const docs = snapshot.docs.map(document => serializeDocument(document, { includePrivate: isAuthority }));
    docs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const items = writeCache(
      cacheKey,
      docs,
      CACHE_TTL.catalog
    );
    return response.json(items);
  } catch (error) {
    console.error("Could not read items:", error);
    return response.status(500).json({ error: "Could not load items." });
  }
});

app.get("/api/items/:itemId", requireAuth, async (request, response) => {
  const isAuthority = request.user.role === "AUTHORITY" || request.user.authority === true;
  const cacheKey = `item:${request.params.itemId}:${isAuthority ? "authority" : "student"}`;

  try {
    const cached = readCache(cacheKey);
    if (cached) return response.json(cached);

    const { firestore } = getServices();
    const document = await firestore.collection("items").doc(request.params.itemId).get();
    if (!document.exists) return response.status(404).json({ error: "Item not found." });

    const item = writeCache(
      cacheKey,
      serializeDocument(document, { includePrivate: isAuthority }),
      CACHE_TTL.item
    );
    return response.json(item);
  } catch (error) {
    console.error("Could not read item:", error);
    return response.status(500).json({ error: "Could not load the item." });
  }
});

app.post("/api/items", rateLimiter({ max: 20 }), requireAuth, requireAuthority, async (request, response) => {
  const payload = cleanPayload(request.body);
  const itemCode = payload.itemCode || `LF-${new Date().getFullYear()}-${crypto.randomInt(100, 999)}`;

  try {
    const image = normalizeImage(payload.image);
    const item = {
      itemCode,
      title: String(payload.title || "").trim(),
      category: String(payload.category || "").trim(),
      foundDate: String(payload.foundDate || "").trim(),
      claimDeadline: String(payload.claimDeadline || "").trim(),
      foundLocation: String(payload.foundLocation || "").trim(),
      ownerName: String(payload.ownerName || "").trim() || null,
      publicDescription: String(payload.publicDescription || "").trim(),
      privateNotes: String(payload.privateNotes || "").trim(),
      isHighValue: Boolean(payload.isHighValue),
      image,
      status: "ACTIVE",
      registeredByUid: request.user.uid,
      registeredByEmail: request.user.email || null,
      registeredByName: request.user.name || (request.user.email ? request.user.email.split("@")[0] : "Staff"),
      createdAt: new Date().toISOString()
    };

    if (!item.title || !item.category || !item.foundDate || !item.publicDescription) {
      return response.status(400).json({ error: "Title, category, found date, and public description are required." });
    }

    const { firestore } = getServices();
    const document = await firestore.collection("items").add(item);
    invalidateItem(document.id);
    return response.status(201).json({ id: document.id, ...item });
  } catch (error) {
    if (error.statusCode === 400) {
      return response.status(400).json({ error: error.message });
    }
    console.error("Could not create item:", error);
    return response.status(500).json({ error: "Could not save the item." });
  }
});

app.delete("/api/items/:itemId", rateLimiter({ max: 30 }), requireAuth, requireAuthority, async (request, response) => {
  const { itemId } = request.params;
  try {
    const { firestore } = getServices();
    const itemReference = firestore.collection("items").doc(itemId);
    const itemDocument = await itemReference.get();

    if (!itemDocument.exists) {
      return response.status(404).json({ error: "Item not found." });
    }

    await itemReference.delete();
    invalidateItem(itemId);
    return response.json({ ok: true, id: itemId });
  } catch (error) {
    console.error("Could not delete item:", error);
    return response.status(500).json({ error: "Could not delete the item." });
  }
});

app.post("/api/lost-reports", rateLimiter({ max: 15 }), requireAuth, async (request, response) => {
  const payload = cleanPayload(request.body);
  const report = {
    ...payload,
    studentEmail: request.user.email || payload.studentEmail || null,
    studentName: request.user.name || payload.studentName || "Student",
    status: "OPEN",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const { firestore } = getServices();
    const document = await firestore.collection("lostReports").add(report);
    return response.status(201).json({ id: document.id, ...report });
  } catch (error) {
    console.error("Could not create lost report:", error);
    return response.status(500).json({ error: "Could not save the report." });
  }
});

app.get("/api/lost-reports", requireAuth, requireAuthority, async (_request, response) => {
  try {
    const { firestore } = getServices();
    const snapshot = await firestore.collection("lostReports")
      .orderBy("createdAt", "desc")
      .get();
    return response.json(snapshot.docs.map(document => serializeDocument(document, { includePrivate: true })));
  } catch (error) {
    console.error("Could not read lost reports:", error);
    return response.status(500).json({ error: "Could not load lost reports." });
  }
});

app.patch("/api/lost-reports/:reportId", requireAuth, requireAuthority, async (request, response) => {
  try {
    const { firestore } = getServices();
    const reference = firestore.collection("lostReports").doc(request.params.reportId);
    await reference.update({
      status: request.body.status,
      updatedAt: new Date().toISOString(),
      reviewedBy: request.user.name || request.user.email
    });
    return response.json({ ok: true });
  } catch (error) {
    console.error("Could not update lost report:", error);
    return response.status(500).json({ error: "Could not update the report." });
  }
});

app.post("/api/handovers", rateLimiter({ max: 30 }), requireAuth, requireAuthority, async (request, response) => {
  const { itemId, studentName, studentId, verificationMethod, verificationNotes } = request.body;

  if (!itemId || !studentName || !studentId) {
    return response.status(400).json({ error: "Item, student name, and student ID are required." });
  }

  try {
    const { firestore } = getServices();
    const result = await firestore.runTransaction(async transaction => {
      const itemReference = firestore.collection("items").doc(itemId);
      const itemDocument = await transaction.get(itemReference);

      if (!itemDocument.exists) {
        throw new Error("ITEM_NOT_FOUND");
      }

      const handover = {
        itemId,
        itemCode: itemDocument.data().itemCode,
        studentName,
        studentId,
        verificationMethod,
        verificationNotes,
        releasedBy: request.user.name || request.user.email,
        createdAt: new Date().toISOString()
      };

      transaction.update(itemReference, {
        status: "CLAIMED",
        claimedAt: handover.createdAt,
        claimedBy: studentName,
        claimedStudentId: studentId,
        verificationMethod,
        verificationNotes
      });
      transaction.set(firestore.collection("handovers").doc(), handover);

      return handover;
    });

    invalidateItem(itemId);
    return response.status(201).json(result);
  } catch (error) {
    if (error.message === "ITEM_NOT_FOUND") {
      return response.status(404).json({ error: "Item not found." });
    }
    console.error("Could not complete handover:", error);
    return response.status(500).json({ error: "Could not complete the handover." });
  }
});

app.get("/api/stats", async (_request, response) => {
  const cacheKey = "stats:summary";
  try {
    const cached = readCache(cacheKey);
    if (cached) return response.json(cached);

    const { firestore } = getServices();
    const [itemsSnap, handoversSnap] = await Promise.all([
      firestore.collection("items").get(),
      firestore.collection("handovers").get()
    ]);

    let activeCount = 0;
    let claimedCount = 0;
    let totalReturnDurationMs = 0;
    let validDurationCount = 0;

    itemsSnap.forEach(doc => {
      const data = doc.data();
      if (data.status === "CLAIMED") {
        claimedCount++;
      } else if (data.status === "ACTIVE") {
        activeCount++;
      }

      if (data.status === "CLAIMED" && data.createdAt && data.claimedAt) {
        const createdTime = new Date(data.createdAt).getTime();
        const claimedTime = new Date(data.claimedAt).getTime();
        const diffMs = claimedTime - createdTime;
        if (diffMs > 0 && !isNaN(diffMs)) {
          totalReturnDurationMs += diffMs;
          validDurationCount++;
        }
      }
    });

    // Fall back to handovers collection size if items doesn't reflect historical claims
    const totalReunited = Math.max(claimedCount, handoversSnap.size);

    let avgReturnTimeLabel = "0 days";
    if (validDurationCount > 0) {
      const avgDays = (totalReturnDurationMs / validDurationCount) / (1000 * 60 * 60 * 24);
      if (avgDays < 1) {
        const avgHours = Math.max(1, Math.round((totalReturnDurationMs / validDurationCount) / (1000 * 60 * 60)));
        avgReturnTimeLabel = `${avgHours} hr${avgHours > 1 ? "s" : ""}`;
      } else {
        const roundedDays = Math.round(avgDays);
        avgReturnTimeLabel = `${roundedDays} day${roundedDays > 1 ? "s" : ""}`;
      }
    }

    const stats = {
      reunited: totalReunited,
      waiting: activeCount,
      avgReturnTime: avgReturnTimeLabel
    };

    writeCache(cacheKey, stats, 60 * 1000); // Cache for 1 min
    return response.json(stats);
  } catch (error) {
    console.error("Could not compute stats:", error);
    return response.status(500).json({ error: "Could not compute live stats." });
  }
});

app.listen(port, () => {
  console.log(`FOUND@ANS server listening on http://localhost:${port}`);
});
