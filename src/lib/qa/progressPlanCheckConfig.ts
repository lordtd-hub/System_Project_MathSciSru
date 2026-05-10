import type { AssessmentRoundType } from "@prisma/client";

type EnvLike = Record<string, string | undefined>;

export type ProgressPlanTask = {
  activity: string;
  startWeek: number;
  endWeek: number;
  deliverable?: string;
};

export type WeekWindow = {
  startWeek: number;
  endWeek: number;
};

export type PlanTaskClassification = "due_in_this_round" | "ongoing_in_this_round" | "previous_task" | "future_task";

export const progressPlanWeekWindows = {
  PROGRESS_1: { startWeek: 1, endWeek: 8 },
  PROGRESS_2: { startWeek: 9, endWeek: 16 }
} as const satisfies Record<"PROGRESS_1" | "PROGRESS_2", WeekWindow>;

export function isQaProgressPlanCheckEnabled(env: EnvLike = process.env) {
  if (env.ENABLE_QA_PROGRESS_PLAN_CHECK !== "1") return false;
  if (env.NODE_ENV === "production" && env.VERCEL_ENV === "production") return false;
  return env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development";
}

export function getProgressRoundWeekWindow(roundType: AssessmentRoundType | "PROGRESS_1" | "PROGRESS_2") {
  if (roundType !== "PROGRESS_1" && roundType !== "PROGRESS_2") return null;
  return progressPlanWeekWindows[roundType];
}

export function doesTaskOverlapWeekWindow(task: ProgressPlanTask, weekWindow: WeekWindow) {
  return task.startWeek <= weekWindow.endWeek && task.endWeek >= weekWindow.startWeek;
}

export function classifyPlanTaskForRound(task: ProgressPlanTask, weekWindow: WeekWindow): PlanTaskClassification {
  if (task.endWeek < weekWindow.startWeek) return "previous_task";
  if (task.startWeek > weekWindow.endWeek) return "future_task";
  if (task.endWeek <= weekWindow.endWeek) return "due_in_this_round";
  return "ongoing_in_this_round";
}

function normalizeWeek(value: unknown, fallback: number) {
  const week = Number(value);
  if (!Number.isInteger(week)) return fallback;
  return Math.min(16, Math.max(1, week));
}

export function normalizeProgressPlanTasks(value: unknown): ProgressPlanTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ProgressPlanTask | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const activity = String(record.activity ?? "").trim();
      const deliverable = String(record.deliverable ?? "").trim();
      const startWeek = normalizeWeek(record.startWeek, 1);
      const endWeek = Math.max(startWeek, normalizeWeek(record.endWeek, startWeek));
      if (!activity && !deliverable) return null;
      return { activity, startWeek, endWeek, deliverable };
    })
    .filter((item): item is ProgressPlanTask => Boolean(item));
}
