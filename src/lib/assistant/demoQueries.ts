import { demoProjectDto, demoProjects } from "./demoFixtures";

/** The same fixed, projected read model is used by REST and MCP. No persistence. */
export const listSyntheticProjects = () => demoProjects.map(demoProjectDto);
export function findSyntheticProject(id: string) {
  if (!/^nia-demo-[0-9]{3}$/.test(id)) return undefined;
  const project = demoProjects.find((item) => item.id === id);
  return project ? demoProjectDto(project) : undefined;
}
