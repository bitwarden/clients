import { AutofillVector, QualificationResult } from "../services/abstractions/inline-menu-field-qualifications.service";

export type AutofillDebugSession = {
  sessionId: string;
  startTime: number;
  endTime?: number;
  url: string;
  qualifications: FieldQualificationRecord[];
};

export type FieldQualificationRecord = {
  fieldId: string;
  elementSelector: string;
  attempts: QualificationAttempt[];
  finalDecision?: QualificationResult;
};

export type QualificationAttempt = {
  attemptId: string;
  timestamp: number;
  vector: AutofillVector;
  result: QualificationResult;
  triggeredBy?: string;
};

export type DebugExportFormat = "json" | "summary" | "console";
