import "dotenv/config";
import express from "express";
import multer from "multer";
import { UTApi, UTFile } from "uploadthing/server";

const PORT = process.env.PORT || 4000;

if (!process.env.UPLOADTHING_TOKEN) {
  console.error(
    "Missing UPLOADTHING_TOKEN. Copy .env.example to .env and paste your token from the UploadThing dashboard."
  );
  process.exit(1);
}

const app = express();
const upload = multer(); // keep files in memory, we just forward them to UploadThing
const utapi = new UTApi(); // reads UPLOADTHING_TOKEN from env automatically

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Upload sidecar is running." });
});

// POST /upload  (multipart/form-data, field name "file")
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file received." });
    }

    const utFile = new UTFile([req.file.buffer], req.file.originalname, {
      type: req.file.mimetype,
    });

    const response = await utapi.uploadFiles(utFile);

    if (response.error) {
      console.error("UploadThing error:", response.error);
      return res.status(500).json(response.error);
    }

    // response.data => { key, url, name, size }
    res.json(response.data);
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ message: "Upload failed", error: String(err) });
  }
});

// POST /delete  { "key": "fileKey" }
app.post("/delete", express.json(), async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ message: "Missing file key." });

    await utapi.deleteFiles(key);
    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete failed:", err);
    res.status(500).json({ message: "Delete failed", error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Upload sidecar running at http://localhost:${PORT}`);
});
