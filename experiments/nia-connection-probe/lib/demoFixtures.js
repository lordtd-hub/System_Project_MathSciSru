// Generated from source/demoFixtures.ts; preserved domain/auth logic.
export const DEMO_FIXTURE_SET = "nia-demo-v1";
export const DEMO_SCHEMA_VERSION = "1.0";
export const DEMO_READ_SCOPE = "demo:projects:read";
export const DEMO_PRINCIPAL_ID = "nia-demo-reader";
export const DEMO_ROOT = "/api/assistant/v1/demo/projects";
export const demoProjects = Object.freeze([
    Object.freeze({
        id: "nia-demo-001",
        titleTh: "โครงงานจำลอง A: ลำดับเลขคณิต",
        status: "DRAFT",
        updatedAt: "2026-10-30T00:00:00Z"
    }),
    Object.freeze({
        id: "nia-demo-002",
        titleTh: "โครงงานจำลอง B: แบบจำลองกราฟ",
        status: "PROPOSAL_PENDING",
        updatedAt: "2026-10-30T00:00:00Z"
    }),
    Object.freeze({
        id: "nia-demo-003",
        titleTh: "โครงงานจำลอง C: การจำลองความน่าจะเป็น",
        status: "COMPLETED",
        updatedAt: "2026-10-30T00:00:00Z"
    })
]);
export function demoProjectDto(project) {
    return {
        id: project.id,
        titleTh: project.titleTh,
        status: project.status,
        updatedAt: project.updatedAt
    };
}
