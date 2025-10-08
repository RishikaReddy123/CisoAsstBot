import { Db, Collection } from "mongodb";

export interface User {
  email: string;
  password: string;
}

export function getUserCollection(db: Db): Collection<User> {
  return db.collection<User>("users");
}
