import { type Request, type Response } from "express";
import { connectDB } from "../utils/db.js";
import { getProfileCollection } from "../models/EmployeeProfile.js";

export async function getProfiles(req: Request, res: Response) {
  const { risk, vulnerability, knowledge } = req.query;

  const db = await connectDB();
  const profiles = getProfileCollection(db);

  const query: any = {};
  if (risk) query.risk = String(risk).toLowerCase();
  if (vulnerability) query.vulnerability = String(vulnerability).toLowerCase();
  if (knowledge) query.knowledge = String(knowledge).toLowerCase();

  const data = await profiles.find(query).toArray();
  res.json(data);
}

export async function getProfileById(req: Request, res: Response) {
  const db = await connectDB();
  const profiles = getProfileCollection(db);
  const employeeId = req.params.id as string;
  const profile = await profiles.findOne({ employeeId });
  if (profile) {
    res.json(profile);
  } else {
    res.status(404).json({ error: "Profile not found" });
  }
}
