import { type Request, type Response } from "express";
import { connectDB } from "../utils/db.js";
import { getConversationCollection } from "../models/Conversation.js";
import { type AuthRequest } from "../types/AuthRequest.js";
import { ObjectId } from "mongodb";

interface CreateConversationBody {
  firstMessage: string;
}

export async function getAllConversations(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }
    const db = await connectDB();
    const conversations = getConversationCollection(db);
    const convos = await conversations
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(convos);
  } catch (error) {
    console.error("Error fetching conversations", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
}

export async function getConversation(req: Request, res: Response) {
  try {
    const db = await connectDB();
    const conversations = getConversationCollection(db);
    const convo = await conversations.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!convo)
      return res.status(404).json({ error: "Conversation not found!" });
    res.json(convo);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
}

export async function createConversation(
  req: AuthRequest & { body: CreateConversationBody },
  res: Response
) {
  try {
    const userId = req.user?.id;
    const { firstMessage } = req.body;

    const db = await connectDB();
    const conversations = getConversationCollection(db);

    const convo = {
      userId,
      title: firstMessage.slice(0, 30) || "New chat",
      messages: [
        {
          role: "user" as "user",
          content: firstMessage,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
    };

    const result = await conversations.insertOne(convo as any);
    res.status(201).json({ ...convo, _id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
}

export async function appendMessage(
  req: AuthRequest & { body: { role: "user" | "assistant"; content: string } },
  res: Response
) {
  try {
    const { id } = req.params;
    const { role, content } = req.body;

    const db = await connectDB();
    const conversations = getConversationCollection(db);

    await conversations.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: {
          messages: { role, content, timestamp: new Date() },
        },
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to append message!" });
  }
}
