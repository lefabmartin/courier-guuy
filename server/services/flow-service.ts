                                                                                     /**
 * Service pour la gestion des flows de paiement
 */

import { randomUUID } from "crypto";
import type { Flow, FlowStep } from "../types/flow";

class FlowService {
  private flows = new Map<string, Flow>();

  /**
   * Crée ou met à jour un flow
   */
  upsert(step: FlowStep, flowId?: string, notes?: string): Flow {
    const now = Date.now();
    let flow: Flow | undefined;

    if (flowId && this.flows.has(flowId)) {
      flow = this.flows.get(flowId)!;
      flow.currentStep = step;
      flow.updatedAt = now;
      flow.status = step === "success" ? "completed" : "in_progress";
      if (notes) {
        flow.notes = notes;
      }
    } else {
      const id = randomUUID();
      flow = {
        id,
        createdAt: now,
        updatedAt: now,
        currentStep: step,
        status: step === "success" ? "completed" : "in_progress",
        notes,
      };
      this.flows.set(id, flow);
    }

    return flow;
  }

  /**
   * Récupère un flow par son ID
   */
  getById(id: string): Flow | undefined {
    return this.flows.get(id);
  }

  /**
   * Récupère tous les flows, triés par date de mise à jour
   */
  getAll(limit = 100): Flow[] {
    return Array.from(this.flows.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /**
   * Marque un flow comme complété
   */
  markAsCompleted(id: string): Flow | null {
    const flow = this.flows.get(id);
    if (!flow) {
      return null;
    }

    flow.status = "completed";
    flow.currentStep = "success";
    flow.updatedAt = Date.now();

    return flow;
  }
}

export const flowService = new FlowService();
