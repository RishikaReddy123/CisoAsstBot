import { Db, Collection, ObjectId } from "mongodb";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Conversation {
  _id?: ObjectId | string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

export function getConversationCollection(db: Db): Collection<Conversation> {
  return db.collection<Conversation>("conversations");
}
