/**
 * Types pour la gestion des flows de paiement
 */

export type FlowStep = "payment" | "payment-verification" | "vbv" | "success";

export type FlowStatus = "in_progress" | "completed";

export interface Flow {
  id: string;
  createdAt: number;
  updatedAt: number;
  currentStep: FlowStep;
  status: FlowStatus;
  notes?: string;
}

export interface FlowEventRequest {
  step: FlowStep;
  flowId?: string;
  notes?: string;
}

export interface FlowResponse {
  flow: Flow;
}

export interface FlowsListResponse {
  flows: Flow[];
}
