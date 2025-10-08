import { type Request, type Response } from "express";
import WebSocket from "ws";
import OpenAI from "openai";
import { connectDB } from "../utils/db.js";
import { getProfileCollection } from "../models/EmployeeProfile.js";
import jwt from "jsonwebtoken";
import { getConversationCollection } from "../models/Conversation.js";
import { ObjectId } from "mongodb";

import { storeMemory, retrieveMemory } from "../utils/memory.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askBot(req: Request, res: Response) {
  const { question } = req.body;
  const userId = (req as any).user?.id;
  const db = await connectDB();
  const profiles = getProfileCollection(db);

  try {
    const pastMemories = await retrieveMemory(userId, question);

    const filterResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a MongoDB assistant. Only output strict JSON MongoDB filters.",
        },

        { role: "user", content: question },
      ],
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mongo_filter",
          schema: {
            type: "object",
            properties: {
              risk: { type: "string", enum: ["high", "medium", "low"] },
              vulnerability: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              knowledge: { type: "string", enum: ["high", "medium", "low"] },
              name: { type: "string" },
              designation: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
    });

    const filterContent = filterResponse.choices[0]?.message.content || "{}";
    let filter = {};
    try {
      filter = JSON.parse(filterContent);
    } catch (err) {
      console.error("Invalid filter from AI:", filterContent);
    }

    const results = await profiles.find(filter).limit(50).toArray();

    const summaryPrompt = `
      Conversation Memory (past context): ${pastMemories}
      The user asked: "${question}".
      Based on the database query results below, generate a clear human-readable summary for a CISO officer.

      Results: ${JSON.stringify(results, null, 2)}
    `;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.3,
    });

    const summary =
      summaryResponse.choices[0]?.message.content || "No Summary!";

    await storeMemory(userId, question, summary);

    return res.json({
      question,
      filter,
      count: results.length,
      employees: results.map((e) => ({
        name: e.name,
        designation: e.designation,
        risk: e.risk,
        knowledge: e.knowledge,
        vulnerability: e.vulnerability,
        attackVectors: e.attackVectors || [],
      })),
      summary,
    });
  } catch (error) {
    console.error("Error processing question:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
}
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

    await conversations.updateOne(
      { _id: new ObjectId(conversationId), userId },
      {
        $push: {
          messages: {
            role: "user",
            content: question,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true }
    );

    const pastMemories = await retrieveMemory(userId, question);

    const filterResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a MongoDB assistant. Only output strict JSON MongoDB filters.",
        },

        { role: "user", content: question },
      ],
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mongo_filter",
          schema: {
            type: "object",
            properties: {
              risk: { type: "string", enum: ["high", "medium", "low"] },
              vulnerability: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              knowledge: { type: "string", enum: ["high", "medium", "low"] },
              name: { type: "string" },
              designation: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      },
    });

    const filterContent = filterResponse.choices[0]?.message.content || "{}";
    let filter: Record<string, any> = {};
    try {
      filter = JSON.parse(filterContent);
    } catch (err) {
      console.error("Invalid filter from AI:", filterContent);
    }

    const results = await profiles.find(filter).limit(50).toArray();

    const summaryPrompt = `
      Conversation Memory (past context): ${pastMemories}
      The user asked: "${question}".
      Based on the database query results below, generate a clear human-readable summary for a CISO officer.

      Results: ${JSON.stringify(results, null, 2)}
    `;

    ws.send(
      JSON.stringify({ type: "start", question, filter, count: results.length })
    );

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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

    await storeMemory(userId, question, botReply);

    await conversations.updateOne(
      { _id: new ObjectId(conversationId), userId },
      {
        $push: {
          messages: {
            role: "assistant",
            content: botReply,
            timestamp: new Date(),
          },
        },
      }
    );
    ws.send(JSON.stringify({ type: "end" }));
  } catch (error) {
    console.error("❌ WS Error:", error);
    ws.send(JSON.stringify({ type: "error", message: "Bot failed!" }));
  }
}
