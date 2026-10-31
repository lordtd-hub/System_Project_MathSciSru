// Generated from source/oauthLiveVerifier.ts; preserved domain/auth logic.
export function createLiveOAuthVerifier({ config, verifyJwt, readLiveAuthorization, now = Date.now }) {
    return async (request)=>{
        const raw = request.headers.get("authorization");
        if (!raw || raw.length > 16_384 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw)) return null;
        let p;
        try {
            p = await verifyJwt(raw.slice(7));
        } catch  {
            return null;
        }
        const t = now();
        if (!Number.isFinite(t) || t < config.startsAt || t >= config.endsAt || p.iss !== config.issuer || p.aud !== config.resource || p.sub !== config.ownerId || p.azp !== config.clientId || !p.sid || typeof p.scope !== "string" || !p.scope.split(" ").includes("demo:projects:read") || p.scope.split(" ").some((s)=>![
                "demo:projects:read"
            ].includes(s)) || !Number.isFinite(p.iat) || !Number.isFinite(p.exp) || p.iat * 1000 > t || p.exp <= p.iat || p.exp - p.iat > 300 || t >= p.exp * 1000 || p.nbf !== undefined && (!Number.isFinite(p.nbf) || t < p.nbf * 1000)) return null;
        const live = await readLiveAuthorization(p.sid);
        const at = now();
        if (!live || !Number.isFinite(at) || at < config.startsAt || at >= config.endsAt || at >= p.exp * 1000 || !live.enabled || live.ownerId !== config.ownerId || live.googleSub !== config.googleSub || live.clientId !== config.clientId || live.resource !== config.resource || !Number.isFinite(live.startsAt) || !Number.isFinite(live.endsAt) || live.startsAt !== config.startsAt || live.endsAt !== config.endsAt || live.sessionId !== p.sid || live.sessionUserId !== config.ownerId || !Number.isFinite(live.sessionExpiresAt) || at >= live.sessionExpiresAt || !live.clientEnabled || !live.clientRequiresPkce || !live.clientRequiresConsent || !live.clientRedirectMatches || !live.clientResourceLinked || !live.resourceEnabled || live.ownerEmail !== config.ownerEmail || !live.ownerEmailVerified || !live.googleAccountLinked || !live.consentGranted) return null;
        return Object.freeze({
            issuer: config.issuer,
            resource: config.resource,
            subject: config.ownerId,
            scopes: p.scope.split(" "),
            notBeforeEpochMs: Math.max(config.startsAt, (p.nbf ?? p.iat) * 1000),
            expiresAtEpochMs: Math.min(config.endsAt, p.exp * 1000)
        });
    };
}
