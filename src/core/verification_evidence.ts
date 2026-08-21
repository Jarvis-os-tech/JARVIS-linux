// Verification Evidence Ledger for J.A.R.V.I.S.
// Records test executions, compiler verifications, and tool outputs as ground truth evidence.
// Ported and enhanced from Hermes (agent/verification_evidence.py)

import { db } from '../db/db';
import { logOrchestrator } from './logger';

export interface EvidenceRecord {
  id?: string;
  sessionId: string;
  agentRole: string;
  command: string;
  status: 'passed' | 'failed' | 'warn';
  exitCode: number;
  outputSummary: string;
  cwd: string;
  timestamp?: number;
}

export class VerificationEvidenceLedger {
  private static instance: VerificationEvidenceLedger;

  public static getInstance(): VerificationEvidenceLedger {
    if (!VerificationEvidenceLedger.instance) {
      VerificationEvidenceLedger.instance = new VerificationEvidenceLedger();
    }
    return VerificationEvidenceLedger.instance;
  }

  constructor() {
    this.initSchema();
  }

  private initSchema(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS verification_evidence (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        command TEXT NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER NOT NULL,
        output_summary TEXT,
        cwd TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  public recordEvidence(evidence: EvidenceRecord): string {
    const id = `evi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO verification_evidence (id, session_id, agent_role, command, status, exit_code, output_summary, cwd, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      evidence.sessionId,
      evidence.agentRole,
      evidence.command,
      evidence.status,
      evidence.exitCode,
      evidence.outputSummary.slice(0, 2000),
      evidence.cwd,
      now
    );

    logOrchestrator.debug(`Recorded verification evidence [${id}] for [${evidence.agentRole}]: ${evidence.command}`);
    return id;
  }

  public getSessionEvidence(sessionId: string): EvidenceRecord[] {
    return db.prepare('SELECT * FROM verification_evidence WHERE session_id = ? ORDER BY timestamp DESC').all(sessionId).map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      agentRole: r.agent_role,
      command: r.command,
      status: r.status,
      exitCode: r.exit_code,
      outputSummary: r.output_summary,
      cwd: r.cwd,
      timestamp: r.timestamp
    }));
  }
}

export const verificationEvidenceLedger = VerificationEvidenceLedger.getInstance();
