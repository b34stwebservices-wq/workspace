import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Query,
  type Timestamp,
} from "firebase/firestore";
import { cached } from "./cache";
import type { Department, Priority, Role, TaskStatus } from "./enums";
import { db } from "./firebase";
import { ROLE_DEPT } from "./roles";

export type Profile = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  workEmail: string;
  status: "active" | "inactive";
};
export type Task = {
  id: string;
  title: string;
  description: string;
  department: Department;
  assigneeId: string;
  status: TaskStatus;
  priority?: Priority;
  dueDate?: Timestamp | null;
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt?: Timestamp;
  createdBy: string;
};
export type OnboardingItem = {
  id: string;
  subjectId: string;
  title: string;
  status: "not_started" | "in_progress" | "complete";
  department: Department;
};

const mapDocs = <T>(snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);

export const loadUsers = (force = false) =>
  cached(
    "users",
    5 * 60_000,
    async () =>
      mapDocs<Profile>(
        await getDocs(query(collection(db, "users"), limit(200))),
      ),
    force,
  );

/** Queries are scoped to what each role may read, so Firestore rules accept them. */
export const loadTasks = (who: { uid: string; role: Role }, force = false) =>
  cached(
    `tasks:${who.uid}`,
    60_000,
    async () => {
      const col = collection(db, "tasks");
      const queries: Query[] = [];
      if (who.role === "admin")
        queries.push(query(col, orderBy("updatedAt", "desc"), limit(300)));
      else {
        queries.push(
          query(col, where("assigneeId", "==", who.uid), limit(100)),
        );
        const dept = ROLE_DEPT[who.role];
        if (dept)
          queries.push(query(col, where("department", "==", dept), limit(200)));
      }
      const snaps = await Promise.all(queries.map((q) => getDocs(q)));
      const merged = new Map<string, Task>();
      for (const snap of snaps)
        for (const task of mapDocs<Task>(snap)) merged.set(task.id, task);
      return [...merged.values()];
    },
    force,
  );

export const loadAnnouncements = (count = 20, force = false) =>
  cached(
    `announcements:${count}`,
    60_000,
    async () =>
      mapDocs<Announcement>(
        await getDocs(
          query(
            collection(db, "announcements"),
            orderBy("createdAt", "desc"),
            limit(count),
          ),
        ),
      ),
    force,
  );

export const loadOnboarding = (
  who: { uid: string; role: Role },
  force = false,
) =>
  cached(
    `onboarding:${who.uid}`,
    60_000,
    async () => {
      const col = collection(db, "onboarding");
      const q =
        who.role === "admin" || who.role === "bizops"
          ? query(col, limit(300))
          : query(col, where("subjectId", "==", who.uid), limit(50));
      return mapDocs<OnboardingItem>(await getDocs(q));
    },
    force,
  );
