/**
 * Durable document validation and storage-domain declaration for Session categories.
 * @module @deepseek-ai/dsh-session-categories/src/spec
 */
import { z } from 'zod';
import type { SessionCategoryDocument } from './types.ts';
/** Runtime validator for the complete durable Session category document. */
export declare const sessionCategoryDocumentSchema: z.ZodType<SessionCategoryDocument>;
/** Storage domain holding the authoritative Session category document. */
export declare const sessionCategoriesDomainSpec: {
    name: string;
    version: number;
    global: {
        schema: z.ZodType<SessionCategoryDocument, unknown, z.core.$ZodTypeInternals<SessionCategoryDocument, unknown>>;
        initial: {
            version: 1;
            revision: number;
            categories: never[];
            assignments: never[];
            pendingArchive: never[];
        };
    };
    tables: {};
};
//# sourceMappingURL=spec.d.ts.map