import { z } from 'zod';

export const dependencyNames = ['database', 'cache', 'storage'] as const;
export type DependencyName = (typeof dependencyNames)[number];

export const dependencyStatusSchema = z.enum(['up', 'down']);
export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.record(z.enum(dependencyNames), dependencyStatusSchema),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
