export type TriggerType =
  | "lead.created"
  | "booking.created"
  | "booking.cancelled"
  | "conversation.handoff"
  | "schedule.daily"
  | "webhook.received";

export type Operator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "exists";

export type Condition = { field: string; op: Operator; value: unknown };

export type ActionType =
  | "send_email"
  | "send_sms"
  | "notify_slack"
  | "create_task"
  | "tag_record"
  | "adjust_inventory"
  | "post_webhook";

export type Action = { type: ActionType; config: Record<string, unknown> };

export type RuleDefinition = {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
};

export type StepResult = { action: string; status: "success" | "skipped" | "failed"; detail: string };

export type RunOutcome = {
  ruleId: string;
  ruleName: string;
  trigger: TriggerType;
  status: "success" | "skipped" | "failed";
  steps: StepResult[];
  durationMs: number;
};
