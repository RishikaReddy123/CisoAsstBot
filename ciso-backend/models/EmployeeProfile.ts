import { Db, Collection } from "mongodb";

export interface EmployeeProfile {
  employeeId: string;
  name: string;
  designation: string;
  knowledge: string;
  risk: string;
  vulnerability: string;
  attackVectors: string[];
}

export function getProfileCollection(db: Db): Collection<EmployeeProfile> {
  return db.collection<EmployeeProfile>("EmployeeProfiles");
}
