type VercelSandboxAuth =
  | { token: string; teamId: string; projectId: string }
  | { oidcToken: string };

function isJwt(token: string): boolean {
  return token.split('.').length === 3;
}

const SETUP_HINT =
  'For local development run: npx vercel login && npx vercel link && npx vercel env pull. ' +
  'Alternatively set VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID.';

export function getVercelSandboxAuth(): VercelSandboxAuth {
  const patToken = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;

  if (patToken && teamId && projectId) {
    return { token: patToken, teamId, projectId };
  }

  if (oidcToken) {
    if (!isJwt(oidcToken)) {
      throw new Error(
        'VERCEL_OIDC_TOKEN is not a valid OIDC JWT. ' +
          'A CLI or access token (for example vck_...) cannot be used as OIDC. ' +
          SETUP_HINT
      );
    }
    return { oidcToken };
  }

  throw new Error(`Missing Vercel sandbox credentials. ${SETUP_HINT}`);
}

export function hasValidVercelSandboxAuth(): boolean {
  try {
    getVercelSandboxAuth();
    return true;
  } catch {
    return false;
  }
}
