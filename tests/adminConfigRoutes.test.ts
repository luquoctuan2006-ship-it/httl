import assert from 'node:assert/strict';
import type { Express, Request, RequestHandler, Response } from 'express';
import { test } from 'node:test';
import { registerAdminConfigRoutes } from '../src/server/routes/adminConfig';
import type { SystemConfig } from '../src/server/types/systemConfig';

const initialConfig: SystemConfig = {
  aiModel: 'gemini-3.5-flash',
  temperature: 0.55,
  maxTokens: 16000,
  systemPrompt: 'Test prompt',
  maintenanceMode: false,
  sessionTimeout: '60 phút',
  backupAutoSchedule: 'Hằng ngày lúc 00:00',
  rules: {
    bufferMinutes: '20',
    startHour: '07:30',
    endHour: '21:30',
    budgetCapDaily: '8.000.000 ₫',
    budgetAlertThreshold: '90%',
    contingencyPercent: '10%',
    citySpeedLimit: '40 km/h',
    highwaySpeedLimit: '60 km/h',
    passSpeedLimit: '35 km/h',
    conflictChecks: {},
    optimizationPriorities: {},
  },
  referenceCosts: [],
};

test('admin config update returns and audits the newly saved config', async () => {
  let currentConfig = initialConfig;
  let savedConfig: SystemConfig | undefined;
  let auditMessage = '';
  let postHandler: RequestHandler | undefined;
  const app = {
    get: () => app,
    post: (_path: string, ...handlers: RequestHandler[]) => {
      postHandler = handlers[handlers.length - 1];
      return app;
    },
  } as unknown as Express;

  registerAdminConfigRoutes(app, {
    requireAuth: (_req, _res, next) => next(),
    requireAdmin: (_req, _res, next) => next(),
    allowedModels: ['gemini-3.5-flash', 'gemini-2.5-flash'],
    getConfigState: () => ({
      activeSystemConfig: currentConfig,
      dynamicGeminiModel: currentConfig.aiModel,
      dynamicGeminiTemperature: currentConfig.temperature,
      dynamicGeminiMaxTokens: currentConfig.maxTokens,
      dynamicGeminiSystemPrompt: currentConfig.systemPrompt,
      activeReferenceCosts: currentConfig.referenceCosts,
    }),
    setConfigState: (config) => {
      currentConfig = config;
    },
    syncSystemConfigIfStale: async () => {},
    saveSystemConfig: async (config) => {
      savedConfig = config;
    },
    recordAuditLog: async (_user, action) => {
      auditMessage = action;
    },
  });

  assert.ok(postHandler);
  let responseBody: { success: boolean; config: SystemConfig } | undefined;
  const request = {
    body: { aiModel: 'gemini-2.5-flash', maintenanceMode: true },
    authUser: { email: 'admin@example.test' },
  } as unknown as Request;
  const response = {
    json(body: typeof responseBody) {
      responseBody = body;
      return this;
    },
    status() {
      return this;
    },
  } as unknown as Response;

  await postHandler(request, response, () => {});

  assert.equal(responseBody?.success, true);
  assert.equal(responseBody?.config.aiModel, 'gemini-2.5-flash');
  assert.equal(responseBody?.config.maintenanceMode, true);
  assert.deepEqual(responseBody?.config, savedConfig);
  assert.match(auditMessage, /Model=gemini-2\.5-flash/);
  assert.match(auditMessage, /Bảo trì=BẬT/);
});
