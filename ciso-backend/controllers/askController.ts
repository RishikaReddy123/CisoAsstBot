import { type Request, type Response } from "express";
import WebSocket from "ws";
import OpenAI from "openai";
import { connectDB } from "../utils/db.js";
import { getProfileCollection } from "../models/EmployeeProfile.js";
import jwt from "jsonwebtoken";
import { getConversationCollection } from "../models/Conversation.js";
import { ObjectId } from "mongodb";
import axios from "axios";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";

import pdfPoppler from "pdf-poppler";
import fs from "fs";
import os from "os";
import path from "path";

import { queryPolicyContext } from "../utils/qdrant.js";
import {
  storeMemory,
  retrieveMemory,
  storeDocumentText,
  retrieveDocumentText,
} from "../utils/memory.js";

console.log("🔑 GROQ_API_KEY:", process.env.GROQ_API_KEY?.slice(0, 10));

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ========================= HELPERS =========================

function hasReadableContent(text: string): boolean {
  return /[A-Za-z0-9\u00C0-\u024F]/.test(text);
}

// ===========================================================
// ==================== ASK BOT (HTTP) =======================
// ===========================================================

export async function askBot(req: Request, res: Response) {
  const { question, uploadedText } = req.body;
  const userId = (req as any).user?.id;

  const db = await connectDB();
  const profiles = getProfileCollection(db);

  try {
    let finalQuestion = question;

    // ================= DOCUMENT MEMORY RECALL ==================
    // Attach previous document ONLY if question indicates document context
    const docQuestionPattern =
      /\b(document|pdf|image|policy|extract|explain this|summarize|read this)\b/i;

    if (!uploadedText && docQuestionPattern.test(question)) {
      const storedDoc = await retrieveDocumentText(userId);
      if (storedDoc) {
        finalQuestion += `\n\n📎 Previously uploaded document text:\n${storedDoc}`;
      }
    }

    // ================= STORE NEW DOCUMENT TEXT =================
    if (uploadedText && uploadedText.trim().length > 0) {
      finalQuestion += `\n\n📎 Extracted text from uploaded document:\n${uploadedText}`;
      await storeDocumentText(userId, uploadedText, { replace: true });
    }

    // Reject if text is not readable
    if (
      uploadedText &&
      (uploadedText.trim().length < 3 || !hasReadableContent(uploadedText))
    ) {
      const reply = `The document does not contain readable text, so it cannot be analyzed.
This means we cannot determine if it complies with the policy.`;

      await storeMemory(userId, finalQuestion, reply);

      return res.json({ summary: reply });
    }

    // Retrieve conversation memories
    const pastMemories = await retrieveMemory(userId, finalQuestion);

    // Ask AI to create Mongo filter
    const filterResponse = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
You are a MongoDB assistant. 
Return ONLY valid JSON usable in db.collection.find().

If the user asks about employees, names, designations, risk, knowledge, vulnerabilities, attack vectors, or anything related to the employee database:

❗ DO NOT USE policy text or document text.
❗ DO NOT answer general questions.
❗ ONLY return a MongoDB filter like:
  {"risk": "high"}
  {"knowledge": "low"}
  {"designation": "Manager"}
  {"name": "Alice"}

Never write explanations.
Never output code.
Return ONLY a valid JSON object.
`,
        },

        { role: "user", content: finalQuestion },
      ],
    });

    let filter = {};
    try {
      filter = JSON.parse(filterResponse.choices[0]?.message.content || "{}");
    } catch {}

    const results = await profiles.find(filter).limit(50).toArray();
    const policyContext = await queryPolicyContext(finalQuestion);

    const isPolicyQuestion =
      /\b(policy|policies|guideline|procedure|rule|standard|compliance|password|data retention|access control)\b/i.test(
        finalQuestion
      );

    // POLICY MODE
    if (isPolicyQuestion && policyContext.length > 0) {
      const formatted = `Here are the exact sections from the company policy document that match your question:\n\n${policyContext.join(
        "\n\n---\n\n"
      )}`;

      await storeMemory(userId, finalQuestion, formatted);
      return res.json({ summary: formatted.trim() });
    }

    // NORMAL SUMMARY MODE
    const summaryPrompt = `
Conversation Memory (past context): ${pastMemories}
Relevant Policy Context: ${policyContext.join("\n\n")}
User asked: "${finalQuestion}"

Generate a concise security summary based on:
${JSON.stringify(results, null, 2)}
`;

    const summaryResponse = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.3,
    });

    const summary =
      summaryResponse.choices[0]?.message.content?.trim() || "No Summary!";

    await storeMemory(userId, finalQuestion, summary);

    return res.json({
      summary,
      ...(results.length > 0 && {
        employees: results.map((e) => ({
          name: e.name,
          designation: e.designation,
          risk: e.risk,
          knowledge: e.knowledge,
          vulnerability: e.vulnerability,
          attackVectors: e.attackVectors || [],
        })),
      }),
    });
  } catch (error) {
    console.error("❌ Error processing question:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
}

// ===========================================================
// ================== STREAM MODE (WS) ========================
// ===========================================================

export async function handleBotStream(
  ws: WebSocket,
  question: string,
  token: string,
  conversationId: string
) {
  try {
    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "No token provided" }));
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.id;

    const db = await connectDB();
    const profiles = getProfileCollection(db);
    const conversations = getConversationCollection(db);

    const parsed = JSON.parse(question);
    let finalQuestion = parsed.text || "";
    let extractedText = "";

    // ===================== FILE PROCESSING =====================
    if (parsed.fileUrl) {
      try {
        const resFile = await axios.get(parsed.fileUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(resFile.data);

        // PDF extraction
        if (parsed.fileUrl.endsWith(".pdf")) {
          try {
            const pdfData = await pdfParse(buffer);

            if (pdfData.text.trim().length > 0) {
              extractedText = pdfData.text;
            } else {
              // OCR fallback
              const tempDir = fs.mkdtempSync(
                path.join(os.tmpdir(), "pdf-ocr-")
              );
              const pdfPath = path.join(tempDir, "input.pdf");
              fs.writeFileSync(pdfPath, buffer);

              await pdfPoppler.convert(pdfPath, {
                out_dir: tempDir,
                out_prefix: "page",
                format: "png",
                dpi: 200,
              });

              const images = fs
                .readdirSync(tempDir)
                .filter((f) => f.endsWith(".png"))
                .map((f) => path.join(tempDir, f));

              let ocr = "";
              for (const img of images) {
                const r = await Tesseract.recognize(img, "eng");
                ocr += r.data.text + "\n";
              }
              extractedText = ocr;
            }
          } catch {
            extractedText = "";
          }
        }

        // Image (png/jpg/jpeg)
        if (
          parsed.fileUrl.endsWith(".png") ||
          parsed.fileUrl.endsWith(".jpg") ||
          parsed.fileUrl.endsWith(".jpeg")
        ) {
          const ocrRes = await Tesseract.recognize(buffer, "eng");
          extractedText = ocrRes.data.text;
        }

        finalQuestion += `\n\n📎 Extracted text from uploaded document:\n${extractedText}`;

        // Store in document memory
        await storeDocumentText(userId, extractedText, { replace: true });
      } catch (err) {
        console.error("❌ File extraction failed:", err);
      }
    }

    // ===================== DOCUMENT RECALL ======================
    // Attach previous document ONLY if question refers to document content
    // Only attach stored document when the user explicitly mentions the uploaded file/document
    const docQuestionPattern =
      /\b(document|pdf|uploaded|attached|uploaded file|attached file|summarize( this| the)?|what does (this|the) (pdf|document|file) say|explain( this| the)?|read( this| the)?|extract( text)?|show me the document)\b/i;

    if (!parsed.fileUrl && docQuestionPattern.test(parsed.text || "")) {
      const storedDoc = await retrieveDocumentText(userId);
      if (storedDoc) {
        finalQuestion += `\n\n📎 Previously uploaded document text:\n${storedDoc}`;
      }
    }

    // Skip unreadable PDF/image
    if (
      parsed.fileUrl &&
      (extractedText.trim().length < 3 || !hasReadableContent(extractedText))
    ) {
      const reply = `The document does not contain readable text, so it cannot be analyzed.
This means we cannot determine if it complies with the policy.`;

      ws.send(JSON.stringify({ type: "start" }));
      ws.send(JSON.stringify({ type: "chunk", data: reply }));
      ws.send(JSON.stringify({ type: "end" }));

      await storeMemory(userId, parsed.text || finalQuestion, reply);
      return;
    }

    // Store user question in DB conversation
    await conversations.updateOne(
      { _id: new ObjectId(conversationId), userId },
      {
        $push: {
          messages: {
            role: "user",
            content: parsed.text,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );

    const pastMemories = await retrieveMemory(userId, finalQuestion);

    // MongoDB filter creation
    const filterResponse = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a MongoDB assistant. Return ONLY valid JSON filters.`,
        },
        {
          role: "system",
          content: `
If the user asks about employees, risk, knowledge, designation, vulnerabilities, or attack vectors,
DO NOT USE document text.
ONLY generate pure MongoDB filters like {"risk":"high"}.
`,
        },
        { role: "user", content: parsed.text },
      ],
    });

    let filter = {};
    try {
      filter = JSON.parse(filterResponse.choices[0]?.message.content || "{}");
    } catch {}

    const results = await profiles.find(filter).limit(50).toArray();
    const policyContext = await queryPolicyContext(finalQuestion);

    const isPolicyQuestion =
      /\b(policy|policies|guideline|procedure|rule|standard|compliance|password|data retention|access control)\b/i.test(
        finalQuestion
      );

    // ====================== POLICY MODE =========================
    if (isPolicyQuestion && policyContext.length > 0) {
      ws.send(JSON.stringify({ type: "start", mode: "policy" }));

      const header =
        "Here are the exact sections from the company policy document that match your question:\n\n";
      let botReply = header;

      const streamPrompt = `
User asked: "${finalQuestion}"
Below are relevant policy excerpts:

${policyContext.join("\n\n---\n\n")}
`;

      const stream = await openai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: streamPrompt }],
        temperature: 0.3,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          botReply += content;
          ws.send(JSON.stringify({ type: "chunk", data: content }));
        }
      }

      await storeMemory(userId, finalQuestion, botReply);

      ws.send(JSON.stringify({ type: "end" }));
      return;
    }

    // ===================== NORMAL SUMMARY MODE ===================
    const summaryPrompt = `
Conversation Memory: ${pastMemories}
Relevant Policy Context: ${policyContext.join("\n\n")}
User asked: "${finalQuestion}"
Database results:
${JSON.stringify(results, null, 2)}
`;

    ws.send(
      JSON.stringify({ type: "start", question, filter, count: results.length })
    );

    const stream = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.3,
      stream: true,
    });

    let botReply = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        botReply += content;
        ws.send(JSON.stringify({ type: "chunk", data: content }));
      }
    }

    await storeMemory(userId, finalQuestion, botReply);

    ws.send(JSON.stringify({ type: "end" }));
  } catch (error) {
    console.error("❌ WS Error:", error);
    ws.send(JSON.stringify({ type: "error", message: "Bot failed!" }));
  }
}
