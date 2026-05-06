import type { TermType } from "@prisma/client";

export function termDisplayName(termType: TermType, yearBe: number): string {
  switch (termType) {
    case "SEMESTER_1":
      return `ภาคเรียนที่ 1 ปีการศึกษา ${yearBe}`;
    case "SEMESTER_2":
      return `ภาคเรียนที่ 2 ปีการศึกษา ${yearBe}`;
    case "SUMMER":
      return `ภาคฤดูร้อน ปีการศึกษา ${yearBe}`;
  }
}
