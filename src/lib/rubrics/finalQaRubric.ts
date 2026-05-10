import type { ConditionScoreMapping } from "./proposalQaRubric";

export type FinalQaCriterion = {
  code: string;
  title: string;
  maxScore: number;
  conditions: string[];
  scoreMappings: ConditionScoreMapping[];
  note?: string;
};

export type FinalQaRubricSection = {
  code: string;
  title: string;
  maxScore: number;
  criteria: FinalQaCriterion[];
};

export type FinalQaRubricItem = {
  groupKey: string;
  groupLabelTh: string;
  itemKey: string;
  itemLabelTh: string;
  points: number;
  displayOrder: number;
  isCritical: boolean;
  evidenceHint: string;
};

export const finalQaRubric: FinalQaRubricSection[] = [
  {
    code: "A",
    title: "Achievement of Approved Objectives",
    maxScore: 25,
    criteria: [
      {
        code: "A1",
        title: "Final work addresses approved objectives",
        maxScore: 15,
        conditions: [
          "Final result addresses approved objectives.",
          "Each objective has supporting evidence/artifact/result.",
          "No major uncontrolled scope drift exists."
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
        title: "Final outputs are complete and verifiable",
        maxScore: 10,
        conditions: [
          "Final artifact/output exists.",
          "Output can be verified or inspected.",
          "Output matches proposal/progress history."
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
    code: "B",
    title: "Quality of Methods and Results",
    maxScore: 30,
    criteria: [
      {
        code: "B1",
        title: "Methods are applied consistently and correctly",
        maxScore: 10,
        conditions: [
          "Methods follow approved proposal or approved revision.",
          "Methods are demonstrated through evidence/artifact.",
          "Methods align with the presented results."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 10 },
          { conditionCount: 2, score: 6 },
          { conditionCount: 1, score: 3 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "B2",
        title: "Results are supported by evidence, proof, analysis, or implementation",
        maxScore: 10,
        conditions: [
          "Claims are supported by evidence.",
          "Evidence supports the conclusions/results.",
          "Analysis/proof/implementation is demonstrated."
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
        title: "Results demonstrate meaningful completion",
        maxScore: 10,
        conditions: [
          "Work progressed beyond Proposal/Progress stage.",
          "Final result is usable/checkable/verifiable.",
          "Final state demonstrates meaningful completion."
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
    title: "Project Execution and Adaptation",
    maxScore: 15,
    criteria: [
      {
        code: "C1",
        title: "Project execution follows approved timeline or justified revision",
        maxScore: 10,
        conditions: [
          "Major tasks were completed according to timeline.",
          "Delays/revisions are documented.",
          "Final state aligns with progress history."
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
        title: "Problems and adaptations are documented",
        maxScore: 5,
        conditions: [
          "Student identifies project problems/challenges.",
          "Student explains adaptation or resolution.",
          "Adaptation preserves project objectives or explains revision."
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
    code: "D",
    title: "Report and Article Quality",
    maxScore: 20,
    criteria: [
      {
        code: "D1",
        title: "Report structure completeness",
        maxScore: 10,
        conditions: ["abstract", "background", "objectives", "methods", "results", "conclusion", "references"],
        scoreMappings: [
          { conditionCount: 7, score: 10 },
          { conditionCount: 6, score: 8 },
          { conditionCount: 5, score: 5 },
          { conditionCount: 0, score: 0 }
        ],
        note: "Use the number of required report sections present. Missing more than two sections earns 0."
      },
      {
        code: "D2",
        title: "Report/article consistency and formatting",
        maxScore: 10,
        conditions: [
          "Objectives/methods/results are internally consistent.",
          "References formatting is consistent.",
          "Equations/figures/tables are labeled appropriately."
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
    code: "E",
    title: "Presentation and Defense",
    maxScore: 10,
    criteria: [
      {
        code: "E1",
        title: "Presentation covers required project status",
        maxScore: 5,
        conditions: ["objectives", "methods", "results", "conclusions", "limitations/future work"],
        scoreMappings: [
          { conditionCount: 5, score: 5 },
          { conditionCount: 4, score: 4 },
          { conditionCount: 3, score: 3 },
          { conditionCount: 2, score: 1 },
          { conditionCount: 0, score: 0 }
        ]
      },
      {
        code: "E2",
        title: "Responses to committee questions are evidence-supported",
        maxScore: 5,
        conditions: [
          "Answer addresses the question directly.",
          "Answer references project evidence/work/results.",
          "Answer provides reasoning or explanation."
        ],
        scoreMappings: [
          { conditionCount: 3, score: 5 },
          { conditionCount: 2, score: 3 },
          { conditionCount: 1, score: 1 },
          { conditionCount: 0, score: 0 }
        ]
      }
    ]
  }
];

function sortedMappings(criterion: FinalQaCriterion) {
  return [...criterion.scoreMappings].sort((a, b) => b.conditionCount - a.conditionCount);
}

export function calculateFinalQaCriterionScore(criterion: FinalQaCriterion, fulfilledConditionCount: number) {
  const normalizedCount = Math.max(0, Math.min(fulfilledConditionCount, criterion.conditions.length));
  const mapping = sortedMappings(criterion).find((item) => normalizedCount >= item.conditionCount);
  return mapping?.score ?? 0;
}

export function findFinalQaCriterion(code: string) {
  return finalQaRubric.flatMap((section) => section.criteria).find((criterion) => criterion.code === code);
}

export function calculateFinalQaSectionSubtotals(scoresByCriterion: Record<string, number>) {
  return finalQaRubric.map((section) => ({
    code: section.code,
    title: section.title,
    maxScore: section.maxScore,
    score: section.criteria.reduce((sum, criterion) => sum + (scoresByCriterion[criterion.code] ?? 0), 0)
  }));
}

export function validateFinalQaRubricTotalIs100() {
  return finalQaRubric.reduce((sum, section) => sum + section.maxScore, 0) === 100;
}

export function finalQaRubricItems(): FinalQaRubricItem[] {
  let displayOrder = 1;
  return finalQaRubric.flatMap((section) =>
    section.criteria.map((criterion) => ({
      groupKey: section.code.toLowerCase(),
      groupLabelTh: `${section.code}. ${section.title}`,
      itemKey: criterion.code,
      itemLabelTh: `${criterion.code}. ${criterion.title}`,
      points: criterion.maxScore,
      displayOrder: displayOrder++,
      isCritical: ["A1", "A2", "B2", "C1", "D1"].includes(criterion.code),
      evidenceHint: [...criterion.conditions, ...(criterion.note ? [criterion.note] : [])].join(" | ")
    }))
  );
}
