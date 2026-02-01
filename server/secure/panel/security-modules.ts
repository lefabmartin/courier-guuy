/**
 * Module central pour exporter tous les modules de sécurité
 * Facilite l'importation et l'utilisation des différents modules
 */

// hCaptcha adaptatif
export {
  type HCaptchaMode,
  type HCaptchaConfig,
  type HCaptchaVerifyResponse,
  getHCaptchaConfig,
  verifyHCaptcha,
  shouldShowCaptcha,
  getSiteKey,
} from "./hcaptcha";

// Proof of Work
export {
  type Difficulty,
  type PoWConfig,
  type PoWChallenge,
  type PoWSolution,
  getPoWConfig,
  getDifficultyForScore,
  generateChallenge,
  verifySolution,
} from "./proof-of-work";

// Mouse Dynamics
export {
  type MouseMovement,
  type MouseDynamicsResult,
  analyzeMouseDynamics,
} from "./mouse-dynamics";

// WebGL Fingerprint
export {
  type WebGLFingerprintData,
  type WebGLFingerprintResult,
  analyzeWebGLFingerprint,
} from "./webgl-fingerprint";

// Behavior Analysis
export {
  type BehaviorData,
  type BehaviorAnalysisResult,
  analyzeBehavior,
} from "./behavior-analysis";

// JS Challenge
export {
  type JSChallengeData,
  type JSChallengeSolution,
  generateJSChallenge,
  verifyJSChallenge,
} from "./js-challenge";

// Honeypot
export {
  type HoneypotField,
  generateHoneypotField,
  generateHoneypotFields,
  checkHoneypot,
  quickHoneypotCheck,
} from "./honeypot";
