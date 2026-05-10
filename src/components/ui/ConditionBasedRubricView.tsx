type RubricCriterion = {
  code: string;
  title: string;
  maxScore: number;
  conditions: string[];
  scoreMappings: { conditionCount: number; score: number }[];
  note?: string;
};

type RubricSection = {
  code: string;
  title: string;
  maxScore: number;
  criteria: RubricCriterion[];
};

export function ConditionBasedRubricView({
  title,
  description,
  sections
}: {
  title: string;
  description?: string;
  sections: RubricSection[];
}) {
  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">
          {sections.reduce((sum, section) => sum + section.maxScore, 0)} คะแนน
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {sections.map((section) => (
          <details key={section.code} className="rounded-md border border-line bg-surface p-3" open={section.code === "A"}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="font-semibold">
                {section.code}. {section.title}
              </span>
              <span className="text-xs text-muted">{section.maxScore} คะแนน</span>
            </summary>
            <div className="mt-3 space-y-3">
              {section.criteria.map((criterion) => (
                <div key={criterion.code} className="rounded-md border border-line bg-paper p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-medium">
                      {criterion.code}. {criterion.title}
                    </div>
                    <span className="text-xs text-muted">{criterion.maxScore} คะแนน</span>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {criterion.conditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {criterion.scoreMappings.map((mapping) => (
                      <span key={`${criterion.code}-${mapping.conditionCount}`} className="rounded-full border border-line bg-surface px-2 py-1">
                        {mapping.conditionCount} เงื่อนไข = {mapping.score}
                      </span>
                    ))}
                  </div>
                  {criterion.note ? <p className="mt-2 text-xs text-muted">{criterion.note}</p> : null}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
