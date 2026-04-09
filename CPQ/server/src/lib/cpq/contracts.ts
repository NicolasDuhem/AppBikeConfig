import { z } from "zod";

export const integrationParameterSchema = z.object({
  name: z.string(),
  simpleValue: z.string().optional(),
  isNull: z.boolean().optional(),
  type: z.string().optional(),
});

export const startBodySchema = z.object({
  partName: z.string().optional(),
  partNamespace: z.string().optional(),
  headerId: z.string().optional(),
  detailId: z.string().optional(),
  sourceHeaderId: z.string().optional(),
  sourceDetailId: z.string().optional(),
  variantKey: z.string().optional(),
  integrationParameters: z.array(integrationParameterSchema).optional(),
});

export const selectionSchema = z.object({
  id: z.string(),
  value: z.string(),
});

export const configureBodySchema = z.object({
  selections: z.array(selectionSchema).min(1),
  clientRequestId: z.string().optional(),
});

export type StartBody = z.infer<typeof startBodySchema>;
export type ConfigureBody = z.infer<typeof configureBodySchema>;

const catalogueCategorySchema = z.enum([
  "all-bikes",
  "c-line",
  "p-line",
  "g-line",
  "t-line",
  "special-editions",
  "electric",
  "electric-c-line",
  "electric-p-line",
  "electric-g-line",
  "electric-t-line",
]);

export const catalogueQuerySchema = z.object({
  category: catalogueCategorySchema.default("all-bikes"),
});

export type CatalogueCategory = z.infer<typeof catalogueCategorySchema>;

export const configurationVariantsQuerySchema = z.object({
  bikeTypeId: z.string().min(1, "bikeTypeId is required"),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type ConfigurationVariantsQuery = z.infer<typeof configurationVariantsQuerySchema>;

