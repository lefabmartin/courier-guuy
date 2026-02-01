// Script client pour les vérifications Anti-Bot
// Génère les cookies, fingerprints, challenges, etc.

/**
 * Génère un hash simple à partir d'une chaîne
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Génère un fingerprint basique du navigateur
 */
function generateFingerprint(): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx?.fillText("fingerprint", 2, 2);
  const canvasFingerprint = canvas.toDataURL();

  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.platform,
    canvasFingerprint.substring(0, 50),
  ].join("|");

  return simpleHash(data);
}

/**
 * Résout un challenge JavaScript simple
 */
function solveJSChallenge(): string {
  // Challenge simple : calculer une somme
  const a = Math.floor(Math.random() * 100) + 1;
  const b = Math.floor(Math.random() * 100) + 1;
  const result = a + b;
  
  // Stocker le résultat dans un cookie
  const challengeToken = simpleHash(`${a}+${b}=${result}-${Date.now()}`);
  return challengeToken;
}

/**
 * Calcule un score de comportement basique
 */
function calculateBehaviorScore(): number {
  let score = 50; // Score de base

  // Vérifier si le navigateur supporte les fonctionnalités modernes
  if (window.localStorage) score += 10;
  if (window.sessionStorage) score += 10;
  if (window.indexedDB) score += 10;
  if (navigator.cookieEnabled) score += 10;
  if (navigator.onLine !== undefined) score += 10;

  return Math.min(score, 100);
}

/**
 * Initialise toutes les vérifications Anti-Bot côté client
 */
export function initAntiBotChecks(): void {
  // 1. Cookie JavaScript
  document.cookie = `js_enabled=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

  // 2. Fingerprint
  const fingerprint = generateFingerprint();
  document.cookie = `fingerprint=${fingerprint}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

  // 3. JS Challenge
  const challengeToken = solveJSChallenge();
  document.cookie = `js_challenge=${challengeToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

  // 4. Behavior Score
  const behaviorScore = calculateBehaviorScore();
  document.cookie = `behavior_score=${behaviorScore}; path=/; max-age=${60 * 60}; SameSite=Lax`;

  // 5. Ajouter les headers personnalisés pour les requêtes fetch
  // On va intercepter fetch et XMLHttpRequest pour ajouter ces headers
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options = {}] = args;
    const headers = new Headers(options.headers || {});
    
    headers.set("X-JS-Enabled", "1");
    headers.set("X-Fingerprint", fingerprint);
    headers.set("X-JS-Challenge", challengeToken);
    headers.set("X-Behavior-Score", behaviorScore.toString());

    return originalFetch(url, {
      ...options,
      headers,
    });
  };

  // Intercepter XMLHttpRequest aussi (WeakMap pour stocker l'URL par instance)
  const xhrUrlStore = new WeakMap<XMLHttpRequest, string | URL>();
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    xhrUrlStore.set(this, url);
    if (username !== undefined && username !== null && password !== undefined && password !== null) {
      originalXHROpen.call(this, method, url, async, username, password);
    } else if (username !== undefined && username !== null) {
      originalXHROpen.call(this, method, url, async, username);
    } else {
      originalXHROpen.call(this, method, url, async);
    }
  };

  XMLHttpRequest.prototype.send = function (...args: unknown[]): void {
    const url = xhrUrlStore.get(this);
    const urlStr = typeof url === "string" ? url : url?.href ?? "";
    if (urlStr && !urlStr.startsWith("blob:")) {
      this.setRequestHeader("X-JS-Enabled", "1");
      this.setRequestHeader("X-Fingerprint", fingerprint);
      this.setRequestHeader("X-JS-Challenge", challengeToken);
      this.setRequestHeader("X-Behavior-Score", behaviorScore.toString());
    }
    originalXHRSend.apply(this, args as [Document | XMLHttpRequestBodyInit | null | undefined]);
  };

  console.log("[Anti-Bot Client] Initialized checks:", {
    jsEnabled: true,
    fingerprint,
    challengeToken,
    behaviorScore,
  });
}

/**
 * Met à jour le score de comportement en fonction des interactions
 */
let behaviorData = {
  clicks: 0,
  mouseMovements: 0,
  scrollEvents: 0,
  timeOnPage: Date.now(),
};

export function trackBehavior(): void {
  // Track clicks
  document.addEventListener("click", () => {
    behaviorData.clicks++;
    updateBehaviorScore();
  });

  // Track mouse movements
  let mouseMoveCount = 0;
  document.addEventListener("mousemove", () => {
    mouseMoveCount++;
    if (mouseMoveCount % 10 === 0) {
      behaviorData.mouseMovements++;
      updateBehaviorScore();
    }
  });

  // Track scroll
  document.addEventListener("scroll", () => {
    behaviorData.scrollEvents++;
    updateBehaviorScore();
  });
}

function updateBehaviorScore(): void {
  const timeOnPage = Math.floor((Date.now() - behaviorData.timeOnPage) / 1000);
  let score = calculateBehaviorScore();

  // Ajouter des points pour les interactions
  if (behaviorData.clicks > 0) score += Math.min(behaviorData.clicks * 2, 20);
  if (behaviorData.mouseMovements > 5) score += 10;
  if (behaviorData.scrollEvents > 0) score += 10;
  if (timeOnPage > 5) score += 10;

  score = Math.min(score, 100);

  // Mettre à jour le cookie
  document.cookie = `behavior_score=${score}; path=/; max-age=${60 * 60}; SameSite=Lax`;

  // Mettre à jour le header pour les prochaines requêtes
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options = {}] = args;
    const headers = new Headers(options.headers || {});
    headers.set("X-Behavior-Score", score.toString());
    return originalFetch(url, { ...options, headers });
  };
}
