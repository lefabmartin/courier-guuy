/**
 * Analyse de l'empreinte WebGL pour détection de bots / VMs
 */

export interface WebGLFingerprintData {
  renderer?: string;
  vendor?: string;
  extensions?: string[];
  canvasHash?: string;
}

export interface WebGLFingerprintResult {
  score: number;
  isHuman: boolean;
  isSuspect: boolean;
  details?: string;
}

const SUSPECT_RENDERERS = [
  "swiftshader",
  "llvmpipe",
  "mesa",
  "software",
  "softpipe",
  "virgl",
  "gallium",
];

/**
 * Analyse l'empreinte WebGL et retourne un score de confiance (0-100)
 */
export function analyzeWebGLFingerprint(data: WebGLFingerprintData): WebGLFingerprintResult {
  let score = 50;
  let isSuspect = false;
  const details: string[] = [];

  const renderer = (data.renderer || "").toLowerCase();
  const vendor = (data.vendor || "").toLowerCase();

  for (const suspect of SUSPECT_RENDERERS) {
    if (renderer.includes(suspect) || vendor.includes(suspect)) {
      score -= 30;
      isSuspect = true;
      details.push(`Suspect renderer: ${renderer || vendor}`);
      break;
    }
  }

  if (data.extensions && data.extensions.length > 5) {
    score = Math.min(100, score + 10);
  }
  if (data.canvasHash && data.canvasHash.length > 10) {
    score = Math.min(100, score + 10);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    isHuman: score >= 40,
    isSuspect,
    details: details.length > 0 ? details.join("; ") : undefined,
  };
}
