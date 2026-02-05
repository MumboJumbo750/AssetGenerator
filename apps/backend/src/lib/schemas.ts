import fs from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export type SchemaRegistry = {
  ajv: Ajv2020;
  validateOrThrow(schemaId: string, data: unknown): void;
};

export async function loadSchemas(schemaDir: string): Promise<SchemaRegistry> {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const entries = await fs.readdir(schemaDir, { withFileTypes: true });
  const schemaFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".schema.json"))
    .map((e) => path.join(schemaDir, e.name));

  for (const file of schemaFiles) {
    const raw = await fs.readFile(file, "utf8");
    const schema = JSON.parse(raw);
    ajv.addSchema(schema);
  }

  function validateOrThrow(schemaId: string, data: unknown) {
    const validate = ajv.getSchema(schemaId);
    if (!validate) throw new Error(`Schema not loaded: ${schemaId}`);
    const ok = validate(data);
    if (ok) return;
    const details = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`).join("; ");
    throw new Error(`Schema validation failed (${schemaId}): ${details}`);
  }

  return { ajv, validateOrThrow };
}
