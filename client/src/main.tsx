import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAntiBotChecks, trackBehavior } from "./lib/antibot-client";

// Initialiser les vérifications Anti-Bot au démarrage
initAntiBotChecks();
trackBehavior();

createRoot(document.getElementById("root")!).render(<App />);
