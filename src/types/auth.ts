/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppRole = 'user' | 'admin';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export interface ManagedUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Khách du lịch';
  isLocked: boolean;
  createdAt: string;
  lastLogin: string;
}

