export type ConditionScoreMapping = {
  conditionCount: number;
  score: number;
};

export type ProposalQaRubricItem = {
  groupKey: string;
  groupLabelTh: string;
  itemKey: string;
  itemLabelTh: string;
  points: number;
  displayOrder: number;
  isCritical: boolean;
  evidenceHint: string;
};

export type ProposalQaCriterion = {
  code: string;
  title: string;
  maxScore: number;
  conditions: string[];
  scoreMappings: ConditionScoreMapping[];
  requiredSections?: string[];
};

export type ProposalQaRubricSection = {
  code: string;
  title: string;
  maxScore: number;
  criteria: ProposalQaCriterion[];
};

const proposalSectionTitleTh: Record<string, string> = {
  A: "การกำหนดปัญหาและวัตถุประสงค์",
  B: "วิธีดำเนินงานและแผนงาน",
  C: "ความครบถ้วนและความสอดคล้องของโครงร่าง",
  D: "การนำเสนอและการตอบคำถาม"
};

const proposalCriterionTitleTh: Record<string, string> = {
  A1: "บริบทของปัญหา",
  A2: "ความชัดเจนของวัตถุประสงค์",
  A3: "การกำหนดขอบเขต",
  B1: "โครงสร้างวิธีดำเนินงาน",
  B2: "ความเหมาะสมทางคณิตศาสตร์ สถิติ คอมพิวเตอร์ หรือเทคนิค",
  B3: "ความเป็นไปได้ของแผนเวลา",
  B4: "การศึกษาพื้นฐานหรือเอกสารอ้างอิง",
  C1: "ความครบถ้วนของหัวข้อที่จำเป็น",
  C2: "ความสอดคล้องภายใน",
  D1: "ความครอบคลุมของการนำเสนอ",
  D2: "การตอบคำถาม"
};

const proposalConditionTh: Record<string, string[]> = {
  A1: [
    "ระบุปัญหาหรือ pain point ของโครงงาน",
    "ระบุกลุ่มผู้ใช้หรือบริบทของปัญหา",
    "อธิบายว่าปัญหานี้สำคัญเพราะอะไร"
  ],
  A2: [
    "วัตถุประสงค์ระบุชัดว่าจะศึกษา พัฒนา พิสูจน์ วิเคราะห์ สร้าง หรือประเมินอะไร",
    "วัตถุประสงค์สอดคล้องกับหัวข้อโครงงาน",
    "วัตถุประสงค์สามารถตรวจสอบได้จากผลลัพธ์สุดท้ายของโครงงาน"
  ],
  A3: ["ระบุสิ่งที่โครงงานจะครอบคลุม", "ระบุข้อจำกัด สิ่งที่ไม่ทำ หรือขอบเขตของงาน"],
  B1: [
    "ส่วนวิธีดำเนินงานมีขั้นตอนตามลำดับ",
    "ขั้นตอนสอดคล้องกับวัตถุประสงค์",
    "ขั้นตอนสามารถทำได้จริงภายในช่วงเวลาโครงงาน"
  ],
  B2: [
    "ระบุเครื่องมือ แนวคิด ทฤษฎี วิธีทางคณิตศาสตร์ สถิติ คอมพิวเตอร์ หรือเทคนิคที่จะใช้",
    "อธิบายว่าเครื่องมือหรือวิธีเหล่านั้นเหมาะกับปัญหาอย่างไร",
    "เครื่องมือหรือวิธีที่เสนอไม่ขัดกับขอบเขตของโครงงาน"
  ],
  B3: ["แผนครอบคลุมช่วงเวลาโครงงานทั้งหมด", "งานในแผนมีลำดับและระยะเวลาที่สมเหตุสมผล"],
  B4: [
    "กล่าวถึงทฤษฎี งานเดิม เครื่องมือ ระบบ หรือวรรณกรรมที่เกี่ยวข้อง",
    "แหล่งข้อมูลพื้นฐานเกี่ยวข้องกับหัวข้อโครงงาน",
    "แสดงให้เห็นว่าพื้นฐานดังกล่าวสนับสนุนงานที่เสนออย่างไร"
  ],
  C2: ["วัตถุประสงค์สอดคล้องกับวิธีดำเนินงาน", "วิธีดำเนินงานสอดคล้องกับผลลัพธ์ที่คาดหวัง", "แผนเวลาสอดคล้องกับ workflow ที่เสนอ"],
  D1: ["ผู้นำเสนออธิบายปัญหา/บริบท", "ผู้นำเสนออธิบายวัตถุประสงค์", "ผู้นำเสนออธิบายวิธีดำเนินงาน", "ผู้นำเสนออธิบายผลลัพธ์ที่คาดหวัง"],
  D2: ["คำตอบตอบตรงคำถาม", "คำตอบสอดคล้องกับโครงร่างที่ส่ง", "คำตอบมีเหตุผล ตัวอย่าง หลักฐาน หรือคำอธิบายประกอบ"]
};

const proposalRequiredSectionsTh = ["บทคัดย่อ", "ความเป็นมา", "วัตถุประสงค์", "วิธีดำเนินงาน", "ผลลัพธ์ที่คาดหวัง", "แผนเวลา"];

function bilingual(th: string | undefined, en: string) {
  return th ? `${th} / ${en}` : en;
}

function bilingualList(thItems: string[] | undefined, enItems: string[]) {
  return enItems.map((item, index) => bilingual(thItems?.[index], item));
}

const proposalQaRubricBase: ProposalQaRubricSection[] = [
  {
    code: "A",
    title: "Problem and Objective Definition",
    maxScore: 20,
    criteria: [
      {
        code: "A1",
        title: "Problem Context",
        maxScore: 5,
        conditions: [
          "Proposal identifies the problem or pain point.",
          "Proposal identifies the user group or context.",
          "Proposal explains why the problem matters."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 5 },
          { conditionCount: 2, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "A2",
        title: "Objective Specificity",
        maxScore: 10,
        conditions: [
          "Objectives specify what will be studied, developed, proved, analyzed, constructed, or evaluated.",
          "Objectives correspond to the project topic.",
          "Objectives can be verified from the final project outcome."
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
        title: "Scope Definition",
        maxScore: 5,
        conditions: [
          "Proposal states what the project will cover.",
          "Proposal states limits, exclusions, or boundaries of the work."
        ],
        scoreMappings: [
          { conditionCount: 2, score: 5 },
          { conditionCount: 1, score: 2 },
          { conditionCount: 0, score: 0 }
        ]
      }
    ]
  },
  {
    code: "B",
    title: "Methodology and Planning",
    maxScore: 40,
    criteria: [
      {
        code: "B1",
        title: "Methodology Structure",
        maxScore: 15,
        conditions: [
          "Method section gives ordered steps.",
          "Steps correspond to the objectives.",
          "Steps can realistically be executed within the project period."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 15 },
          { conditionCount: 2, score: 10 },
          { conditionCount: 1, score: 5 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "B2",
        title: "Technical or Mathematical Appropriateness",
        maxScore: 10,
        conditions: [
          "Proposal identifies the mathematical, computational, statistical, or technical tools to be used.",
          "Proposal explains why those tools fit the problem.",
          "Proposed tools do not conflict with the project scope."
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
        title: "Timeline Feasibility",
        maxScore: 5,
        conditions: [
          "Timeline covers the full project period.",
          "Timeline tasks follow a reasonable order and duration."
        ],
        scoreMappings: [
          { conditionCount: 2, score: 5 },
          { conditionCount: 1, score: 2 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "B4",
        title: "Background Study / References",
        maxScore: 10,
        conditions: [
          "Proposal mentions related theories, prior work, tools, systems, or literature.",
          "Background sources are relevant to the project topic.",
          "Proposal shows how the background supports the proposed work."
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
    code: "C",
    title: "Proposal Completeness and Consistency",
    maxScore: 20,
    criteria: [
      {
        code: "C1",
        title: "Required Sections Completeness",
        maxScore: 10,
        requiredSections: ["Abstract", "Background", "Objectives", "Methods", "Expected outcomes", "Timeline"],
        conditions: [],
        scoreMappings: [
          { conditionCount: 6, score: 10 },
          { conditionCount: 5, score: 8 },
          { conditionCount: 4, score: 5 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "C2",
        title: "Internal Consistency",
        maxScore: 10,
        conditions: [
          "Objectives correspond to methods.",
          "Methods correspond to expected outcomes.",
          "Timeline corresponds to the proposed workflow."
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
        title: "Presentation Coverage",
        maxScore: 10,
        conditions: [
          "Presenter explains problem/context.",
          "Presenter explains objectives.",
          "Presenter explains methods.",
          "Presenter explains expected outcomes."
        ],
        scoreMappings: [
          { conditionCount: 4, score: 10 },
          { conditionCount: 3, score: 7 },
          { conditionCount: 2, score: 4 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "D2",
        title: "Question Response",
        maxScore: 10,
        conditions: [
          "Answer directly addresses the question.",
          "Answer is consistent with the submitted proposal.",
          "Answer provides a reason, example, evidence, or explanation."
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

export const proposalQaRubric: ProposalQaRubricSection[] = proposalQaRubricBase.map((section) => ({
  ...section,
  title: bilingual(proposalSectionTitleTh[section.code], section.title),
  criteria: section.criteria.map((criterion) => ({
    ...criterion,
    title: bilingual(proposalCriterionTitleTh[criterion.code], criterion.title),
    conditions: bilingualList(proposalConditionTh[criterion.code], criterion.conditions),
    requiredSections: criterion.requiredSections ? bilingualList(proposalRequiredSectionsTh, criterion.requiredSections) : undefined
  }))
}));

function sortedMappings(criterion: ProposalQaCriterion) {
  return [...criterion.scoreMappings].sort((a, b) => b.conditionCount - a.conditionCount);
}

export function calculateCriterionScore(criterion: ProposalQaCriterion, fulfilledConditionCount: number) {
  const normalizedCount = Math.max(0, Math.min(fulfilledConditionCount, criterion.conditions.length || criterion.requiredSections?.length || 0));
  const mapping = sortedMappings(criterion).find((item) => normalizedCount >= item.conditionCount);
  return mapping?.score ?? 0;
}

export function findProposalQaCriterion(code: string) {
  return proposalQaRubric.flatMap((section) => section.criteria).find((criterion) => criterion.code === code);
}

export function calculateRubricTotal(scoresByCriterion: Record<string, number>) {
  return proposalQaRubric.reduce(
    (total, section) => total + section.criteria.reduce((sectionTotal, criterion) => sectionTotal + (scoresByCriterion[criterion.code] ?? 0), 0),
    0
  );
}

export function validateRubricTotalIs100() {
  return proposalQaRubric.reduce((total, section) => total + section.maxScore, 0) === 100;
}

export function proposalQaRubricItems(): ProposalQaRubricItem[] {
  let displayOrder = 1;
  return proposalQaRubric.flatMap((section) =>
    section.criteria.map((criterion) => ({
      groupKey: section.code.toLowerCase(),
      groupLabelTh: `${section.code}. ${section.title}`,
      itemKey: criterion.code,
      itemLabelTh: `${criterion.code}. ${criterion.title}`,
      points: criterion.maxScore,
      displayOrder: displayOrder++,
      isCritical: ["A1", "A2", "B1", "B2", "C1"].includes(criterion.code),
      evidenceHint: [
        ...criterion.conditions,
        ...(criterion.requiredSections ? [`Required sections: ${criterion.requiredSections.join(", ")}`] : [])
      ].join(" | ")
    }))
  );
}
