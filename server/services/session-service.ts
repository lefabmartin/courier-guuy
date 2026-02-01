// Service de session simple pour OzyAdmin
// En production, utiliser express-session avec un store persistant

const sessions = new Map<string, { ozyadmin: boolean; expiresAt: number }>();

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Génère un ID de session
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Nettoie les sessions expirées
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of Array.from(sessions.entries())) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
    }
  }
}

// Nettoyer toutes les 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

/**
 * Crée une nouvelle session
 */
export function createSession(): string {
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    ozyadmin: true,
    expiresAt: Date.now() + SESSION_DURATION,
  });
  return sessionId;
}

/**
 * Vérifie si une session est valide
 */
export function isValidSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return false;
  }
  
  return session.ozyadmin === true;
}

/**
 * Supprime une session
 */
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Parse les cookies depuis le header Cookie
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * Extrait le session ID depuis les cookies ou headers
 */
export function extractSessionId(req: any): string | null {
  // Vérifier les cookies
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.ozyadmin_session) {
    return cookies.ozyadmin_session;
  }
  
  // Vérifier le header
  const headerSession = req.headers["x-session-id"];
  if (headerSession) {
    return headerSession as string;
  }
  
  return null;
}
