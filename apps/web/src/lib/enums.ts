export const ROLES = [
  "admin",
  "bizops",
  "digitalops",
  "designer",
  "employee",
] as const;
export type Role = (typeof ROLES)[number];

export const DEPARTMENTS = [
  "technical",
  "business",
  "digital",
  "creative",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
