// Generated from source/demoQueries.ts; preserved domain/auth logic.
import { demoProjectDto, demoProjects } from "./demoFixtures.js";
export const listSyntheticProjects = ()=>demoProjects.map(demoProjectDto);
export function findSyntheticProject(id) {
    if (!/^nia-demo-[0-9]{3}$/.test(id)) return undefined;
    const project = demoProjects.find((item)=>item.id === id);
    return project ? demoProjectDto(project) : undefined;
}
