type VercelSandboxAuth =
  | { token: string; teamId: string; projectId: string }
  | { oidcToken: string };

function isJwt(token: string): boolean {
  return token.split('.').length === 3;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function getVercelOidcExpiryError(oidcToken: string): string | null {
  const payload = decodeJwtPayload(oidcToken);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (exp == null) return null;
  if (Date.now() / 1000 < exp) return null;
  return (
    'VERCEL_OIDC_TOKEN ha caducado. En local ejecuta: npx vercel env pull .env.local --yes ' +
    'y reinicia el servidor. Alternativa: configura VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID, ' +
    'o cambia SANDBOX_PROVIDER=e2b con E2B_API_KEY.'
  );
}

const SETUP_HINT =
  'Para desarrollo local: npx vercel login && npx vercel link && npx vercel env pull .env.local --yes. ' +
  'También puedes usar VERCEL_TOKEN, VERCEL_TEAM_ID y VERCEL_PROJECT_ID, o SANDBOX_PROVIDER=e2b con E2B_API_KEY.';

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
        'VERCEL_OIDC_TOKEN no es un JWT OIDC válido. ' +
          'Un token de CLI o acceso (por ejemplo vck_...) no sirve como OIDC. ' +
          SETUP_HINT
      );
    }
    const expired = getVercelOidcExpiryError(oidcToken);
    if (expired) {
      throw new Error(expired);
    }
    return { oidcToken };
  }

  throw new Error(`Faltan credenciales de Vercel Sandbox. ${SETUP_HINT}`);
}

export function hasValidVercelSandboxAuth(): boolean {
  try {
    getVercelSandboxAuth();
    return true;
  } catch {
    return false;
  }
}

export function formatSandboxCreateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Status code 403/i.test(message) || /403/.test(message)) {
    const oidc = process.env.VERCEL_OIDC_TOKEN;
    if (oidc) {
      const expired = getVercelOidcExpiryError(oidc);
      if (expired) return expired;
    }
    return (
      'Vercel rechazó la autenticación (403). El VERCEL_OIDC_TOKEN suele caducar en pocas horas. ' +
      SETUP_HINT
    );
  }
  return message || 'No se pudo crear el sandbox';
}
