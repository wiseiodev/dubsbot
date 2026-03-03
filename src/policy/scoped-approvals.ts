import { randomUUID } from 'node:crypto';

import type { ToolSideEffect } from '../tools/schemas';

export type ApprovalScopeContext = {
  principal: string;
  operationClass: ToolSideEffect;
  resourceScope: string;
  scopeId: string;
};

export type ScopedApprovalRecord = ApprovalScopeContext & {
  id: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
};

export class InMemoryScopedApprovalStore {
  private readonly records = new Map<string, ScopedApprovalRecord>();

  save(input: ApprovalScopeContext & { expiresAt: string }): ScopedApprovalRecord {
    const now = new Date().toISOString();
    const record: ScopedApprovalRecord = {
      id: randomUUID(),
      principal: input.principal,
      operationClass: input.operationClass,
      resourceScope: input.resourceScope,
      scopeId: input.scopeId,
      expiresAt: input.expiresAt,
      createdAt: now,
      revokedAt: null,
    };
    this.records.set(input.scopeId, record);
    return record;
  }

  revoke(scopeId: string): boolean {
    const record = this.records.get(scopeId);
    if (!record || record.revokedAt) {
      return false;
    }
    record.revokedAt = new Date().toISOString();
    this.records.set(scopeId, record);
    return true;
  }

  matchExact(input: ApprovalScopeContext): ScopedApprovalRecord | null {
    const record = this.records.get(input.scopeId);
    if (!record) {
      return null;
    }
    if (
      record.principal !== input.principal ||
      record.operationClass !== input.operationClass ||
      record.resourceScope !== input.resourceScope
    ) {
      return null;
    }
    return record;
  }
}
