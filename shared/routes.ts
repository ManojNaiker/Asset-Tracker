import { z } from 'zod';
import { 
  insertUserSchema, insertEmployeeSchema, insertAssetTypeSchema, 
  insertAssetSchema, insertAllocationSchema, insertVerificationSchema,
  users, employees, assetTypes, assets, allocations, verifications, auditLogs
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  forbidden: z.object({
    message: z.string(),
  })
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
        423: z.object({ message: z.string() }) // Locked
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    changePassword: {
      method: 'POST' as const,
      path: '/api/auth/change-password' as const,
      input: z.object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(6),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
  },
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees' as const,
      input: z.object({
        search: z.string().optional(),
        branch: z.string().optional(),
        department: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof employees.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees' as const,
      input: insertEmployeeSchema,
      responses: {
        201: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employees/:id' as const,
      input: insertEmployeeSchema.partial(),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    import: {
      method: 'POST' as const,
      path: '/api/employees/import' as const,
      input: z.array(insertEmployeeSchema), // Array of employees
      responses: {
        200: z.object({ count: z.number() }),
      },
    },
  },
  assetTypes: {
    list: {
      method: 'GET' as const,
      path: '/api/asset-types' as const,
      responses: {
        200: z.array(z.custom<typeof assetTypes.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/asset-types' as const,
      input: insertAssetTypeSchema,
      responses: {
        201: z.custom<typeof assetTypes.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/asset-types/:id' as const,
      input: insertAssetTypeSchema.partial(),
      responses: {
        200: z.custom<typeof assetTypes.$inferSelect>(),
      },
    },
  },
  assets: {
    list: {
      method: 'GET' as const,
      path: '/api/assets' as const,
      input: z.object({
        search: z.string().optional(),
        typeId: z.coerce.number().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof assets.$inferSelect & { type: typeof assetTypes.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/assets' as const,
      input: insertAssetSchema,
      responses: {
        201: z.custom<typeof assets.$inferSelect>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/assets/:id' as const,
      input: insertAssetSchema.partial(),
      responses: {
        200: z.custom<typeof assets.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/assets/:id' as const,
      responses: {
        204: z.void(),
      },
    },
  },
  allocations: {
    list: {
      method: 'GET' as const,
      path: '/api/allocations' as const,
      responses: {
        200: z.array(z.custom<typeof allocations.$inferSelect & { asset: typeof assets.$inferSelect, employee: typeof employees.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/allocations' as const,
      input: insertAllocationSchema,
      responses: {
        201: z.custom<typeof allocations.$inferSelect>(),
      },
    },
    return: {
      method: 'POST' as const,
      path: '/api/allocations/:id/return' as const,
      input: z.object({
        returnReason: z.string(),
        status: z.string(), // New asset status
      }),
      responses: {
        200: z.custom<typeof allocations.$inferSelect>(),
      },
    },
  },
  verifications: {
    list: {
      method: 'GET' as const,
      path: '/api/verifications' as const,
      responses: {
        200: z.array(z.custom<typeof verifications.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/verifications' as const,
      input: insertVerificationSchema,
      responses: {
        201: z.custom<typeof verifications.$inferSelect>(),
      },
    },
  },
  stats: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/stats/dashboard' as const,
      responses: {
        200: z.object({
          totalAssets: z.number(),
          allocatedAssets: z.number(),
          availableAssets: z.number(),
          totalEmployees: z.number(),
          assetsByStatus: z.array(z.object({ status: z.string(), count: z.number() })),
          assetsByType: z.array(z.object({ name: z.string(), count: z.number() })),
        }),
      },
    },
  },
  sso: {
    get: {
      method: 'GET' as const,
      path: '/api/settings/sso' as const,
      responses: {
        200: z.custom<any>(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/settings/sso' as const,
      input: z.any(),
      responses: {
        200: z.custom<any>(),
      },
    },
    metadata: {
      method: 'GET' as const,
      path: '/api/auth/saml/metadata' as const,
      responses: {
        200: z.string(),
      },
    },
    callback: {
      method: 'POST' as const,
      path: '/api/auth/saml/callback' as const,
      responses: {
        200: z.any(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
