// routes/upload.js
import express, { type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";

const router = express.Router();

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ✅ Multer configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// ✅ File upload + OCR/PDF text extraction
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = path.join(uploadDir, req.file.filename);
    const ext = path.extname(req.file.originalname).toLowerCase();
    let extractedText = "";

    if (ext === ".pdf") {
      // 🧩 Extract text from PDF
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
      // 🧩 Extract text from image using OCR
      const { data } = await Tesseract.recognize(filePath, "eng", {
        logger: (m) => console.log("🧠 OCR Progress:", m),
      });
      extractedText = data.text;
    } else {
      extractedText = "Unsupported file type for content analysis.";
    }

    return res.json({
      message: "File uploaded & text extracted successfully",
      extractedText,
      url: `${process.env.SERVER_URL || "http://localhost:3000"}/uploads/${
        req.file.filename
      }`,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ error: "Failed to process uploaded file" });
  }
});

export default router;
