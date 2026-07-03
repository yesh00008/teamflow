import { badRequest } from "./errors.js";

// Run a zod schema against a payload, throwing a 400 with field details.
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest("Validation failed", result.error.flatten());
  }
  return result.data;
}
