import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import {
  AutofillDebugSession,
  DebugExportFormat,
  FieldQualificationRecord,
  QualificationAttempt,
} from "../models/autofill-debug-data";
import { devFlagEnabled } from "../../platform/flags";
import {
  AutofillVector,
  QualificationResult,
} from "./abstractions/inline-menu-field-qualifications.service";

export class AutofillDebugService {
  private tracingDepth = 1;
  private currentSession: AutofillDebugSession | null = null;
  readonly sessionStore: Map<string, AutofillDebugSession> = new Map();
  private readonly maxQualificationsPerSession = 100;
  private readonly sessionTimeoutMs = 5 * 60 * 1000; // 5 minutes

  isDebugEnabled(): boolean {
    return devFlagEnabled("autofillDebugMode");
  }

  hasCurrentSession(): boolean {
    return this.currentSession !== null;
  }

  getTracingDepth(): number {
    return this.tracingDepth;
  }

  setTracingDepth(depth: number): void {
    if (depth < 0) {
      console.warn("[Bitwarden Debug] Tracing depth must be >= 0. Setting to 0.");
      this.tracingDepth = 0;
      return;
    }
    this.tracingDepth = depth;
  }

  startSession(url: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      url,
      qualifications: [],
    };
    this.sessionStore.set(sessionId, this.currentSession);

    setTimeout(() => this.cleanupSession(sessionId), this.sessionTimeoutMs);

    return sessionId;
  }

  endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession = null;
    }
  }

  recordQualification(
    fieldId: string,
    elementSelector: string,
    vector: AutofillVector,
    result: QualificationResult,
    triggeredBy?: string,
  ): void {
    if (!this.currentSession) {
      return;
    }

    if (this.currentSession.qualifications.length >= this.maxQualificationsPerSession) {
      console.warn(
        `[Bitwarden Debug] Max qualifications (${this.maxQualificationsPerSession}) reached for session`,
      );
      return;
    }

    let fieldRecord = this.currentSession.qualifications.find((q) => q.fieldId === fieldId);

    if (!fieldRecord) {
      fieldRecord = {
        fieldId,
        elementSelector,
        attempts: [],
      };
      this.currentSession.qualifications.push(fieldRecord);
    }

    const attempt: QualificationAttempt = {
      attemptId: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      vector,
      result,
      triggeredBy,
    };

    fieldRecord.attempts.push(attempt);
    fieldRecord.finalDecision = result;
  }

  exportCurrentSession(format: DebugExportFormat = "json"): string {
    if (!this.currentSession) {
      return format === "json" ? JSON.stringify({ error: "No active session" }) : "No active session";
    }

    return this.exportSession(this.currentSession.sessionId, format);
  }

  exportSession(sessionId: string, format: DebugExportFormat = "json"): string {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return format === "json" ? JSON.stringify({ error: "Session not found" }) : "Session not found";
    }

    switch (format) {
      case "json":
        return JSON.stringify(session, null, 2);
      case "summary":
        return this.generateSummary(sessionId);
      case "console":
        this.generateConsoleOutput(sessionId);
        return "Output logged to console";
      default:
        return JSON.stringify(session, null, 2);
    }
  }

  generateSummary(sessionId: string): string {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return "Session not found";
    }

    const lines: string[] = [];
    lines.push("=".repeat(80));
    lines.push("Bitwarden Autofill Debug Summary");
    lines.push("=".repeat(80));
    lines.push(`Session ID: ${session.sessionId}`);
    lines.push(`URL: ${session.url}`);
    lines.push(`Start Time: ${new Date(session.startTime).toISOString()}`);
    if (session.endTime) {
      lines.push(`End Time: ${new Date(session.endTime).toISOString()}`);
      lines.push(`Duration: ${((session.endTime - session.startTime) / 1000).toFixed(2)}s`);
    }
    lines.push("");
    lines.push(`Total Fields Qualified: ${session.qualifications.length}`);
    lines.push("");

    for (const fieldRecord of session.qualifications) {
      lines.push("-".repeat(80));
      lines.push(`Field ID: ${fieldRecord.fieldId}`);
      lines.push(`Selector: ${fieldRecord.elementSelector}`);
      lines.push(`Attempts: ${fieldRecord.attempts.length}`);

      if (fieldRecord.finalDecision) {
        lines.push(
          `Final Decision: ${fieldRecord.finalDecision.result ? "✅ QUALIFIED" : "❌ REJECTED"}`,
        );

        if (fieldRecord.finalDecision.conditions.pass.length > 0) {
          lines.push("");
          lines.push("Passed Conditions:");
          for (const condition of fieldRecord.finalDecision.conditions.pass) {
            lines.push(`  ✓ ${condition.name}`);
          }
        }

        if (fieldRecord.finalDecision.conditions.fail.length > 0) {
          lines.push("");
          lines.push("Failed Conditions:");
          for (const condition of fieldRecord.finalDecision.conditions.fail) {
            lines.push(`  ✗ ${condition.name}`);
          }
        }

        if (fieldRecord.finalDecision.meta) {
          lines.push("");
          lines.push(`Vector: ${fieldRecord.finalDecision.meta.vector}`);
          lines.push(`Timestamp: ${new Date(fieldRecord.finalDecision.meta.timestamp).toISOString()}`);
        }
      }

      lines.push("");
    }

    lines.push("=".repeat(80));
    lines.push("⚠️  WARNING: This debug data may contain sensitive information.");
    lines.push("Do not share this data publicly or with untrusted parties.");
    lines.push("=".repeat(80));

    return lines.join("\n");
  }

  generateConsoleOutput(sessionId: string): void {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      console.warn("[Bitwarden Debug] Session not found");
      return;
    }

    console.group(
      `%c[Bitwarden Debug] Session: ${session.sessionId}`,
      "color: #175DDC; font-weight: bold; font-size: 14px",
    );
    console.log(`URL: ${session.url}`);
    console.log(`Start Time: ${new Date(session.startTime).toISOString()}`);
    if (session.endTime) {
      console.log(`End Time: ${new Date(session.endTime).toISOString()}`);
      console.log(`Duration: ${((session.endTime - session.startTime) / 1000).toFixed(2)}s`);
    }
    console.log(`Total Fields: ${session.qualifications.length}`);

    for (const fieldRecord of session.qualifications) {
      const icon = fieldRecord.finalDecision?.result ? "✅" : "❌";
      const status = fieldRecord.finalDecision?.result ? "QUALIFIED" : "REJECTED";

      console.group(`${icon} Field: ${fieldRecord.fieldId} (${status})`);
      console.log(`Selector: ${fieldRecord.elementSelector}`);
      console.log(`Attempts: ${fieldRecord.attempts.length}`);

      if (fieldRecord.finalDecision) {
        if (fieldRecord.finalDecision.conditions.pass.length > 0) {
          console.group("✓ Passed Conditions");
          for (const condition of fieldRecord.finalDecision.conditions.pass) {
            console.log(`${condition.name}`);
            if (condition.functionSource) {
              console.log(`Function:`, condition.functionSource);
            }
          }
          console.groupEnd();
        }

        if (fieldRecord.finalDecision.conditions.fail.length > 0) {
          console.group("✗ Failed Conditions");
          for (const condition of fieldRecord.finalDecision.conditions.fail) {
            console.log(`${condition.name}`);
            if (condition.functionSource) {
              console.log(`Function:`, condition.functionSource);
            }
          }
          console.groupEnd();
        }

        if (fieldRecord.finalDecision.meta) {
          console.group("Metadata");
          console.log(`Vector: ${fieldRecord.finalDecision.meta.vector}`);
          console.log(`Timestamp: ${new Date(fieldRecord.finalDecision.meta.timestamp).toISOString()}`);
          console.log(`Field Snapshot:`, fieldRecord.finalDecision.meta.fieldSnapshot);
          if (fieldRecord.finalDecision.meta.pageSnapshot) {
            console.log(`Page Snapshot:`, fieldRecord.finalDecision.meta.pageSnapshot);
          }
          if (fieldRecord.finalDecision.meta.preconditions) {
            console.log(`Preconditions:`, fieldRecord.finalDecision.meta.preconditions);
          }
          console.groupEnd();
        }
      }

      console.groupEnd();
    }

    console.groupEnd();
  }

  captureFieldSnapshot(field: AutofillField): AutofillField {
    // Return a shallow copy to avoid capturing field values
    return { ...field, value: "[REDACTED]" };
  }

  capturePageSnapshot(pageDetails: AutofillPageDetails): Partial<AutofillPageDetails> {
    // Return only non-sensitive page information
    return {
      title: pageDetails.title,
      url: pageDetails.url,
      documentUrl: pageDetails.documentUrl,
      forms: pageDetails.forms,
      // Exclude fields array to avoid capturing field values
    };
  }

  private cleanupSession(sessionId: string): void {
    if (this.currentSession?.sessionId === sessionId) {
      this.endSession();
    }
    this.sessionStore.delete(sessionId);
  }
}
