/**
 * Client ID Manager
 * Manages persistent UUID for player identification across sessions
 */
export class ClientIdManager {
  private static readonly STORAGE_KEY = 'urbanpoly_client_id';
  
  /**
   * Get existing client ID or create a new one
   * @returns UUID string
   */
  static getOrCreateClientId(): string {
    let clientId = localStorage.getItem(this.STORAGE_KEY);
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem(this.STORAGE_KEY, clientId);
      console.log('[ClientIdManager] Generated new client ID:', clientId);
    }
    return clientId;
  }
  
  /**
   * Get existing client ID without creating a new one
   * @returns UUID string or null if not found
   */
  static getClientId(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }
  
  /**
   * Clear client ID (for testing purposes)
   */
  static clearClientId(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
