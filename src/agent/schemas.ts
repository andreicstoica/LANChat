export const shouldRespondSchema = () => ({
  type: "json_schema",
  json_schema: {
    name: "should_respond_decision",
    schema: {
      type: "object",
      properties: {
        should_respond: { type: "boolean" },
        reason: { type: "string" },
        confidence: {
          type: "number",
          minimum: 0.0,
          maximum: 1.0,
        },
      },
      required: ["should_respond", "reason", "confidence"],
      additionalProperties: false,
    },
  },
});

export const actionDecisionSchema = () => ({
  type: "json_schema",
  json_schema: {
    name: "agent_action_decision",
    schema: {
      type: "object",
      properties: {
        decision: { type: "string" },
        reason: { type: "string" },
        confidence: {
          type: "number",
          minimum: 0.0,
          maximum: 1.0,
        },
      },
      required: ["decision", "reason", "confidence"],
      additionalProperties: false,
    },
  },
});

export const searchSchema = () => ({
  type: "json_schema",
  json_schema: {
    name: "search_query",
    schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
});

export const psychologySchema = () => ({
  type: "json_schema",
  json_schema: {
    name: "psychology_request",
    schema: {
      type: "object",
      properties: {
        target: { type: "string" },
        question: { type: "string" },
      },
      required: ["target", "question"],
      additionalProperties: false,
    },
  },
});
