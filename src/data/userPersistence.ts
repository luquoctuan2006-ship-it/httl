import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

export const initialDefaultUsers: ManagedUserRecord[] = [
  {
    id: 'usr-admin-tuan',
    name: 'Lữ Quốc Tuấn',
    email: 'luquoctuan2006@gmail.com',
    phone: '0905 123 456',
    role: 'Admin',
    isLocked: false,
    createdAt: '01/10/2026',
    lastLogin: 'Hôm nay',
  },
  {
    id: 'usr-admin-voyager',
    name: 'Điều phối viên Voyager',
    email: 'admin@voyager.vn',
    phone: '0905 888 999',
    role: 'Admin',
    isLocked: false,
    createdAt: '01/10/2026',
    lastLogin: 'Hôm nay',
  },
  {
    id: 'usr-tourist-demo',
    name: 'Khách du lịch mẫu',
    email: 'demo.tourist@voyager.vn',
    phone: '0912 345 678',
    role: 'Khách du lịch',
    isLocked: false,
    createdAt: '05/10/2026',
    lastLogin: 'Hôm qua',
  },
];

export interface UsersPersistenceStore {
  load(): Promise<ManagedUserRecord[]>;
  save(users: ManagedUserRecord[]): Promise<void>;
}

export async function createUsersPersistenceStore(filePath: string): Promise<UsersPersistenceStore> {
  await mkdir(path.dirname(filePath), { recursive: true });

  let currentUsers: ManagedUserRecord[] | null = null;

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      currentUsers = parsed;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[User persistence] Unable to read ${filePath}:`, error);
    }
  }

  return {
    async load() {
      if (currentUsers) return currentUsers;

      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentUsers = parsed;
          return currentUsers;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`[User persistence] Unable to load ${filePath}:`, error);
        }
      }
      currentUsers = [...initialDefaultUsers];
      return currentUsers;
    },
    async save(users: ManagedUserRecord[]) {
      const temporaryPath = `${filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(users, null, 2), 'utf8');
      await rename(temporaryPath, filePath);
      currentUsers = users;
    },
  };
}
