import type { ConditionScoreMapping } from "./proposalQaRubric";

export type ProgressQaCriterion = {
  code: string;
  title: string;
  maxScore: number;
  conditions: string[];
  scoreMappings: ConditionScoreMapping[];
  note?: string;
};

export type ProgressQaRubricSection = {
  code: string;
  title: string;
  maxScore: number;
  criteria: ProgressQaCriterion[];
};

export type ProgressQaRubricItem = {
  groupKey: string;
  groupLabelTh: string;
  itemKey: string;
  itemLabelTh: string;
  points: number;
  displayOrder: number;
  isCritical: boolean;
  evidenceHint: string;
};

const progressSectionTitleTh: Record<string, string> = {
  A: "ความก้าวหน้าเทียบกับแผนที่อนุมัติ",
  B: "การแก้ปัญหาและการปรับตัว",
  C: "คุณภาพของหลักฐานหรือชิ้นงาน",
  D: "การนำเสนอและการตอบคำถาม"
};

const progressCriterionTitleTh: Record<string, string> = {
  A1: "งานตามแผนที่เกี่ยวข้องมีหลักฐาน",
  A2: "ความก้าวหน้าสอดคล้องกับช่วงสัปดาห์ในแผน",
  A3: "ความก้าวหน้าที่รายงานสะท้อนงานที่ทำจริง",
  B1: "ระบุปัญหาหรืออุปสรรคได้",
  B2: "อธิบายการตอบสนองต่อปัญหา",
  B3: "บันทึกการปรับแผนเมื่อจำเป็น",
  C1: "หลักฐานหรือชิ้นงานแสดงความก้าวหน้าที่มีนัยสำคัญ",
  C2: "ผลปัจจุบันสอดคล้องกับวัตถุประสงค์ที่อนุมัติ",
  C3: "ใช้วิธีดำเนินงานอย่างสอดคล้อง",
  D1: "การนำเสนอครอบคลุมสถานะความก้าวหน้า",
  D2: "การตอบคำถามอ้างอิงหลักฐานของโครงงาน"
};

const progressConditionTh: Record<string, string[]> = {
  A1: [
    "นักศึกษาระบุว่างานตามแผนข้อใดกำลังถูกรายงาน",
    "มีการลิงก์หรืออธิบายหลักฐาน/ชิ้นงานสำหรับงานที่รายงาน",
    "หลักฐานสอดคล้องกับงานตามแผนที่เลือก"
  ],
  A2: [
    "งานที่ควรเสร็จในรอบนี้เสร็จแล้วหรือระบุชัดว่าเลื่อน",
    "งานที่กำลังดำเนินการมีผลลัพธ์บางส่วนหรือหลักฐานสถานะ",
    "งานที่ล่าช้ามีเหตุผลหรือแผนปรับปรุง"
  ],
  A3: [
    "รายงาน/การนำเสนอแยกงานที่เสร็จแล้วออกจากงานที่กำลังทำ",
    "การอ้างว่างานเสร็จมีชิ้นงาน ร่างพิสูจน์ โค้ด ชุดข้อมูล ผลลัพธ์ หรือเอกสารรองรับ",
    "หลีกเลี่ยงคำอธิบายกว้าง ๆ เช่น ทำต่อไป โดยไม่มีหลักฐาน"
  ],
  B1: ["ระบุอุปสรรค ความยาก หรือความเสี่ยงจริงอย่างน้อยหนึ่งอย่าง", "อุปสรรคเชื่อมโยงกับงานตามแผนหรือวัตถุประสงค์ของโครงงาน"],
  B2: [
    "อธิบายวิธีแก้หรือแนวทางตอบสนองที่ทำแล้วหรือจะทำ",
    "วิธีแก้เชื่อมโยงกับปัญหาที่ระบุ",
    "วิธีแก้ทำให้โครงงานเดินต่อได้โดยไม่ขัดกับวัตถุประสงค์ที่อนุมัติ"
  ],
  B3: [
    "ถ้ามีความล่าช้าหรือเบี่ยงเบน นักศึกษาระบุการปรับการดำเนินงาน",
    "การปรับยังคงรักษาวัตถุประสงค์ของโครงงานหรืออธิบายเหตุผลของการปรับขอบเขต"
  ],
  C1: ["มีชิ้นงานหรือหลักฐานที่เป็นรูปธรรมอย่างน้อยหนึ่งรายการ", "ชิ้นงานเชื่อมโยงกับงานตามแผน", "ชิ้นงานแสดงพัฒนาการหลังจากขั้น Proposal"],
  C2: [
    "ผลปัจจุบันตอบวัตถุประสงค์ที่อนุมัติอย่างน้อยหนึ่งข้อ",
    "ผลลัพธ์ไม่แสดงการเบี่ยงขอบเขตใหญ่โดยควบคุมไม่ได้",
    "นักศึกษาบอกได้ว่าผลนั้นสนับสนุนโครงงานสุดท้ายอย่างไร"
  ],
  C3: [
    "ใช้วิธีที่ระบุใน Proposal หรือฉบับแก้ไขที่อนุมัติ",
    "การใช้วิธีแสดงผ่านชิ้นงานหรือหลักฐาน",
    "การใช้วิธีสอดคล้องกับงานที่กำลังรายงาน"
  ],
  D1: ["งานที่เสร็จแล้ว", "งานที่กำลังดำเนินการ", "ขั้นตอนถัดไป", "ปัญหาหรือความเสี่ยงปัจจุบัน"],
  D2: [
    "คำตอบตอบตรงคำถาม",
    "คำตอบอ้างอิงงานที่ส่ง แผน ชิ้นงาน ผลลัพธ์ หรือวัตถุประสงค์ที่อนุมัติ",
    "คำตอบมีเหตุผล หลักฐาน ตัวอย่าง หรือคำอธิบาย"
  ]
};

const progressNoteTh: Record<string, string> = {
  B3: "ถ้าไม่มีความล่าช้าหรือการเบี่ยงเบน ผู้ประเมินอาจถือว่าครบทั้งสองเงื่อนไขได้เมื่อนักศึกษาระบุชัดว่าแผนเดิมยังใช้ได้"
};

function bilingual(th: string | undefined, en: string) {
  return th ? `${th} / ${en}` : en;
}

function bilingualList(thItems: string[] | undefined, enItems: string[]) {
  return enItems.map((item, index) => bilingual(thItems?.[index], item));
}

const progressQaRubricBase: ProgressQaRubricSection[] = [
  {
    code: "A",
    title: "Progress Against Approved Plan",
    maxScore: 30,
    criteria: [
      {
        code: "A1",
        title: "Relevant planned tasks have evidence",
        maxScore: 15,
        conditions: [
          "The student identifies which proposal work plan tasks are being reported.",
          "Evidence/artifacts are linked or described for the reported tasks.",
          "Evidence corresponds to the selected planned tasks."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 15 },
          { conditionCount: 2, score: 10 },
          { conditionCount: 1, score: 5 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "A2",
        title: "Progress matches the planned week range",
        maxScore: 10,
        conditions: [
          "Tasks due in this progress round are completed or explicitly marked as delayed.",
          "Ongoing tasks have partial outputs or status evidence.",
          "Delayed tasks include a reason or revised plan."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "A3",
        title: "Reported progress reflects actual completed work",
        maxScore: 5,
        conditions: [
          "The presentation/report distinguishes completed work from ongoing work.",
          "Claims of completion are supported by an artifact, proof draft, code, dataset, result, or document.",
          "The update avoids vague progress claims such as continued working without evidence."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 5 },
          { conditionCount: 2, score: 3 },
          { conditionCount: 1, score: 1 },
          { conditionCount: 0, score: 0 }
        ]
      }
    ]
  },
  {
    code: "B",
    title: "Problem Solving and Adaptation",
    maxScore: 20,
    criteria: [
      {
        code: "B1",
        title: "Challenges are identified",
        maxScore: 5,
        conditions: [
          "The student identifies at least one actual obstacle, difficulty, or risk.",
          "The obstacle is connected to a planned task or project objective."
        ],
        scoreMappings: [
          { conditionCount: 2, score: 5 },
          { conditionCount: 1, score: 2 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "B2",
        title: "Response to challenges is explained",
        maxScore: 10,
        conditions: [
          "The student explains an attempted or proposed solution.",
          "The solution is connected to the identified challenge.",
          "The solution allows the project to continue without contradicting the approved objective."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "B3",
        title: "Plan adjustment is documented when needed",
        maxScore: 5,
        conditions: [
          "If delay/deviation exists, the student states the adjusted action.",
          "The adjusted action preserves the project objective or explains why scope revision is needed."
        ],
        scoreMappings: [
          { conditionCount: 2, score: 5 },
          { conditionCount: 1, score: 2 },
          { conditionCount: 0, score: 0 }
        ],
        note: "If no delay/deviation exists, evaluators may mark both conditions satisfied when the student explicitly states that the original plan remains valid."
      }
    ]
  },
  {
    code: "C",
    title: "Quality of Work Artifacts",
    maxScore: 30,
    criteria: [
      {
        code: "C1",
        title: "Work artifacts show meaningful progress",
        maxScore: 10,
        conditions: [
          "At least one concrete artifact is presented.",
          "The artifact is connected to a planned task.",
          "The artifact shows development beyond the Proposal stage."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "C2",
        title: "Current results align with approved objectives",
        maxScore: 10,
        conditions: [
          "Current results address at least one approved objective.",
          "Results do not show major uncontrolled scope drift.",
          "The student can state how the result contributes to the final project."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "C3",
        title: "Methods are being applied consistently",
        maxScore: 10,
        conditions: [
          "The student uses methods stated in the Proposal or approved revision.",
          "The method application is shown through artifact/evidence.",
          "The method use is consistent with the task being reported."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      }
    ]
  },
  {
    code: "D",
    title: "Presentation and Defense",
    maxScore: 20,
    criteria: [
      {
        code: "D1",
        title: "Presentation covers progress status",
        maxScore: 10,
        conditions: ["completed work", "ongoing work", "next steps", "current problems or risks"],
        scoreMappings: [
          { conditionCount: 4, score: 10 },
          { conditionCount: 3, score: 7 },
          { conditionCount: 2, score: 4 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "D2",
        title: "Responses to questions are supported by project evidence",
        maxScore: 10,
        conditions: [
          "Answer directly addresses the question.",
          "Answer refers to submitted work, plan, artifact, result, or approved objective.",
          "Answer provides reason, evidence, example, or explanation."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      }
    ]
  }
];

export const progressQaRubric: ProgressQaRubricSection[] = progressQaRubricBase.map((section) => ({
  ...section,
  title: bilingual(progressSectionTitleTh[section.code], section.title),
  criteria: section.criteria.map((criterion) => ({
    ...criterion,
    title: bilingual(progressCriterionTitleTh[criterion.code], criterion.title),
    conditions: bilingualList(progressConditionTh[criterion.code], criterion.conditions),
    note: criterion.note ? bilingual(progressNoteTh[criterion.code], criterion.note) : undefined
  }))
}));

function sortedMappings(criterion: ProgressQaCriterion) {
  return [...criterion.scoreMappings].sort((a, b) => b.conditionCount - a.conditionCount);
}

export function calculateProgressQaCriterionScore(criterion: ProgressQaCriterion, fulfilledConditionCount: number) {
  const normalizedCount = Math.max(0, Math.min(fulfilledConditionCount, criterion.conditions.length));
  const mapping = sortedMappings(criterion).find((item) => normalizedCount >= item.conditionCount);
  return mapping?.score ?? 0;
}

export function findProgressQaCriterion(code: string) {
  return progressQaRubric.flatMap((section) => section.criteria).find((criterion) => criterion.code === code);
}

export function validateProgressQaRubricTotalIs100() {
  return progressQaRubric.reduce((sum, section) => sum + section.maxScore, 0) === 100;
}

export function progressQaRubricItems(): ProgressQaRubricItem[] {
  let displayOrder = 1;
  return progressQaRubric.flatMap((section) =>
    section.criteria.map((criterion) => ({
      groupKey: section.code.toLowerCase(),
      groupLabelTh: `${section.code}. ${section.title}`,
      itemKey: criterion.code,
      itemLabelTh: `${criterion.code}. ${criterion.title}`,
      points: criterion.maxScore,
      displayOrder: displayOrder++,
      isCritical: ["A1", "A2", "C1", "C2"].includes(criterion.code),
      evidenceHint: [...criterion.conditions, ...(criterion.note ? [criterion.note] : [])].join(" | ")
    }))
  );
}
