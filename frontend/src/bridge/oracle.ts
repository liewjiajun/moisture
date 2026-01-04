// Oracle module for score verification
// Connects to the oracle server for production score signing

const ORACLE_URL = import.meta.env.VITE_ORACLE_URL || 'http://localhost:3001';

export interface ReplayData {
  playerId: string;
  roundId: number;
  survivalTime: number;
  events: GameEvent[];
  checksum: string;
}

export interface GameEvent {
  timestamp: number;
  type: 'move' | 'shoot' | 'hit' | 'death';
  data: any;
}

export interface VerificationResult {
  valid: boolean;
  signature: Uint8Array | null;
  error?: string;
}

// Verify a game run through the oracle server
export async function verifyRun(replayData: ReplayData): Promise<VerificationResult> {
  try {
    const response = await fetch(`${ORACLE_URL}/api/verify-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerId: replayData.playerId,
        roundId: replayData.roundId,
        survivalTime: replayData.survivalTime,
        events: replayData.events,
        checksum: replayData.checksum,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        signature: null,
        error: result.error || 'Verification failed',
      };
    }

    if (result.valid && result.signature) {
      return {
        valid: true,
        signature: new Uint8Array(result.signature),
      };
    }

    return {
      valid: false,
      signature: null,
      error: result.error || 'Invalid response from oracle',
    };
  } catch (error) {
    console.error('Oracle verification error:', error);
    return {
      valid: false,
      signature: null,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Get the oracle's public key (for verification)
export async function getOraclePublicKey(): Promise<Uint8Array | null> {
  try {
    const response = await fetch(`${ORACLE_URL}/api/public-key`);
    const data = await response.json();

    if (data.publicKeyBytes) {
      return new Uint8Array(data.publicKeyBytes);
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch oracle public key:', error);
    return null;
  }
}

// Health check for oracle server
export async function checkOracleHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ORACLE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
