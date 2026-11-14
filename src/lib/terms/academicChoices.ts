export type AcademicChoice = { id: string; label: string; yearBe: number };
export function filterAcademicChoices(choices: AcademicChoice[], year: string, query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return choices.filter(choice => (!year || String(choice.yearBe) === year) && words.every(word => choice.label.toLocaleLowerCase().includes(word)));
}
export function retainSelectedAcademicChoice(choices: AcademicChoice[], filtered: AcademicChoice[], selectedId: string) {
  return filtered.some(choice => choice.id === selectedId) ? null : choices.find(choice => choice.id === selectedId) ?? null;
}
