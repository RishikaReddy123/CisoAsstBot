import { MongoClient, type Collection } from "mongodb";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateRiskProfileAI(name: string, designation: string) {
  const prompt = `
  You are a cybersecurity risk assessor.

Return ONLY a strict JSON object (no extra text) with exact keys:
- knowledge: "high" | "medium" | "low"
- risk: "high" | "medium" | "low"
- vulnerability: "high" | "medium" | "low"
- attackVectors: array of strings

Rules:
1) If vulnerability = "high", attackVectors MUST contain MULTIPLE distinct entries (at least 3 recommended) chosen from common attack types such as "spear-phishing", "business email compromise", "credential theft", "OAuth consent phishing", "supply-chain phishing", "invoice fraud", "social engineering".
2) If vulnerability != "high", attackVectors should be an empty array [].
3) Do NOT output explanations, do NOT use markdown, only the JSON object.

Examples (do NOT output these examples; they show required format and when multiple vectors are used):

Example A input:
Name: Mia Thompson
Designation: Customer Support Lead
Example A output:
{"knowledge":"medium","risk":"medium","vulnerability":"high","attackVectors":["spear-phishing","credential theft","business email compromise"]}

Example B input:
Name: Michael Brown
Designation: Software Engineer
Example B output:
{"knowledge":"high","risk":"medium","vulnerability":"medium","attackVectors":[]}

Now produce the JSON for this employee:

  Employee:
  Name: ${name}
  Designation: ${designation}
  `.trim();
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  let content = response.choices[0]?.message.content || "{}";

  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error("Error parsing AI response:", error);
    console.error("Response content:", content);
    return {
      knowlwedge: "unknown",
      risk: "unknown",
      vulnerability: "unknown",
      attackVectors: [],
    };
  }
}

async function run() {
  try {
    await client.connect();
    const db = client.db("companyDB");
    const employees = db.collection("employees");
    const profiles = db.collection("EmployeeProfiles");

    await profiles.deleteMany({});

    const allEmployees = await employees.find().toArray();

    for (const emp of allEmployees) {
      const { _id, ...empWithoutId } = emp as any;
      const profile = await generateRiskProfileAI(emp.name, emp.designation);

      await profiles.updateOne(
        { employeeId: emp.employeeId },
        { $set: { ...empWithoutId, ...profile } },
        { upsert: true }
      );

      console.log(`Profile generated for ${emp.name}:`, profile);

      await new Promise((resolve) => setTimeout(resolve, 21000));
    }
    console.log("Risk profiles generated and stored successfully.");
  } catch (error) {
    console.error(error);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
