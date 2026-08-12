import AutofillScript from "../../models/autofill-script";
import { AgentFillOp, AgentFillOpResult } from "../../types/agent-fill";

interface InsertAutofillContentService {
  fillForm(fillScript: AutofillScript, showAnimations?: boolean): void;
  fillAgentFields(ops: AgentFillOp[], expectedOrigin: string): Promise<AgentFillOpResult[]>;
}

export { InsertAutofillContentService };
