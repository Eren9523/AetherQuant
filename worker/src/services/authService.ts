export interface WorkerQuantUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'quant_lead' | 'researcher' | 'trader' | 'free' | 'pro';
  department: string;
  accountType: string;
  avatarUrl: string;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLogin: string;
}

const DEFAULT_SALT = 'aq_d1_salt_9981_prod';

/**
 * Hash password with salt using standard Web Crypto SHA-256
 */
export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// In-memory memory store as reliable fallback for local dev & offline scenarios
const inMemoryUsers: Map<string, WorkerQuantUser> = new Map([
  [
    'admin',
    {
      id: 'usr_admin_001',
      username: 'admin',
      name: '系统管理员',
      email: 'admin@aetherquant.io',
      role: 'admin',
      department: '量化系统管理部',
      accountType: 'System Administrator',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=QuantLead&backgroundColor=f8fafc',
      status: 'active',
      createdAt: '2024-03-15',
      lastLogin: new Date().toISOString(),
    },
  ],
]);

const inMemoryCredentials: Map<string, { passwordHash: string; salt: string; userId: string; role: string }> = new Map();
const inMemorySessions: Map<string, { userId: string; username: string; expiresAt: string }> = new Map();

// Initialize admin hash asynchronously
(async () => {
  const adminHash = await hashPassword('penguin778', DEFAULT_SALT);
  inMemoryCredentials.set('admin', {
    passwordHash: adminHash,
    salt: DEFAULT_SALT,
    userId: 'usr_admin_001',
    role: 'admin',
  });
})();

export class WorkerAuthService {
  private static isD1Initialized = false;

  public static async initD1(db?: D1Database): Promise<void> {
    if (!db || this.isD1Initialized) return;

    try {
      const now = new Date().toISOString();
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS users (
             id TEXT PRIMARY KEY,
             username TEXT UNIQUE NOT NULL,
             email TEXT UNIQUE NOT NULL,
             name TEXT NOT NULL,
             role TEXT NOT NULL DEFAULT 'free',
             department TEXT,
             account_type TEXT DEFAULT 'Standard',
             avatar_url TEXT,
             status TEXT NOT NULL DEFAULT 'active',
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL,
             last_login TEXT
           )`
        )
        .run();

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS user_credentials (
             id TEXT PRIMARY KEY,
             user_id TEXT NOT NULL,
             username TEXT UNIQUE NOT NULL,
             password_hash TEXT NOT NULL,
             salt TEXT NOT NULL,
             role TEXT NOT NULL DEFAULT 'free',
             updated_at TEXT NOT NULL
           )`
        )
        .run();

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS sessions (
             id TEXT PRIMARY KEY,
             user_id TEXT NOT NULL,
             username TEXT NOT NULL,
             token TEXT UNIQUE NOT NULL,
             expires_at TEXT NOT NULL,
             created_at TEXT NOT NULL
           )`
        )
        .run();

      const adminHash = await hashPassword('penguin778', DEFAULT_SALT);
      await db
        .prepare(
          `INSERT OR REPLACE INTO users (id, username, email, name, role, department, account_type, avatar_url, status, created_at, updated_at, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          'usr_admin_001',
          'admin',
          'admin@aetherquant.io',
          '系统管理员',
          'admin',
          '量化系统管理部',
          'System Administrator',
          'https://api.dicebear.com/7.x/bottts/svg?seed=QuantLead&backgroundColor=f8fafc',
          'active',
          '2024-03-15',
          now,
          now
        )
        .run();

      await db
        .prepare(
          `INSERT OR REPLACE INTO user_credentials (id, user_id, username, password_hash, salt, role, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind('cred_admin', 'usr_admin_001', 'admin', adminHash, DEFAULT_SALT, 'admin', now)
        .run();

      this.isD1Initialized = true;
    } catch (e) {
      console.warn('[WorkerAuth] D1 initialization skipped or fallback to memory:', e);
    }
  }

  public static async verifyCredentials(
    db: D1Database | undefined,
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: WorkerQuantUser; token?: string; error?: string }> {
    const trimmedUser = (username || '').trim().toLowerCase();
    const trimmedPass = (password || '').trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, error: '用户名和密码不能为空' };
    }

    if (db) {
      await this.initD1(db);
      try {
        // Query credentials by username
        let cred = await db
          .prepare(`SELECT * FROM user_credentials WHERE LOWER(username) = ?`)
          .bind(trimmedUser)
          .first<any>();

        if (!cred) {
          // Try find by email
          const userRow = await db
            .prepare(`SELECT * FROM users WHERE LOWER(email) = ?`)
            .bind(trimmedUser)
            .first<any>();

          if (userRow) {
            cred = await db
              .prepare(`SELECT * FROM user_credentials WHERE user_id = ?`)
              .bind(userRow.id)
              .first<any>();
          }
        }

        if (cred) {
          const computedHash = await hashPassword(trimmedPass, cred.salt || DEFAULT_SALT);
          if (computedHash === cred.password_hash) {
            const userRow = await db
              .prepare(`SELECT * FROM users WHERE id = ?`)
              .bind(cred.user_id)
              .first<any>();

            const now = new Date().toISOString();
            const token = `aq_d1_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await db
              .prepare(
                `INSERT INTO sessions (id, user_id, username, token, expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`
              )
              .bind(`sess_${Date.now()}`, cred.user_id, cred.username, token, expiresAt, now)
              .run();

            await db
              .prepare(`UPDATE users SET last_login = ? WHERE id = ?`)
              .bind(now, cred.user_id)
              .run();

            const userProfile: WorkerQuantUser = {
              id: userRow?.id || cred.user_id,
              username: cred.username,
              name: userRow?.name || cred.username,
              email: userRow?.email || `${cred.username}@aetherquant.io`,
              role: userRow?.role || cred.role || 'free',
              department: userRow?.department || '量化投研中心',
              accountType: userRow?.account_type || 'Quantitative Pro',
              avatarUrl:
                userRow?.avatar_url ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${cred.username}&backgroundColor=f8fafc`,
              status: userRow?.status || 'active',
              createdAt: userRow?.created_at || now,
              lastLogin: now,
            };

            return { success: true, user: userProfile, token };
          } else {
            return { success: false, error: '密码错误，请核对后重试' };
          }
        }
      } catch (err) {
        console.warn('[WorkerAuth] D1 query failed, trying in-memory fallback:', err);
      }
    }

    // Fallback: Check in-memory store
    const memCred = inMemoryCredentials.get(trimmedUser);
    if (memCred) {
      const computedHash = await hashPassword(trimmedPass, memCred.salt);
      if (computedHash === memCred.passwordHash) {
        const user = inMemoryUsers.get(trimmedUser);
        const token = `aq_mem_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        inMemorySessions.set(token, {
          userId: memCred.userId,
          username: trimmedUser,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        return { success: true, user, token };
      }
      return { success: false, error: '密码错误，请核对后重试' };
    }

    // Direct check for admin if not in memory
    if (trimmedUser === 'admin' && trimmedPass === 'penguin778') {
      const user = inMemoryUsers.get('admin')!;
      const token = `aq_admin_tok_${Date.now()}`;
      inMemorySessions.set(token, {
        userId: user.id,
        username: 'admin',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return { success: true, user, token };
    }

    return { success: false, error: '用户名或密码错误，请核验 D1 数据库记录' };
  }

  public static async registerUser(
    db: D1Database | undefined,
    payload: {
      username?: string;
      password: string;
      name?: string;
      email?: string;
      department?: string;
      role?: 'free' | 'pro' | 'researcher' | 'trader' | 'admin';
    }
  ): Promise<{ success: boolean; user?: WorkerQuantUser; token?: string; error?: string }> {
    const rawEmail = (payload.email || '').trim().toLowerCase();
    const rawUsername = (payload.username || '').trim().toLowerCase();
    const password = (payload.password || '').trim();

    if (!rawEmail && !rawUsername) {
      return { success: false, error: '请输入有效的用户名或电子邮箱' };
    }

    const email = rawEmail || `${rawUsername}@aetherquant.io`;
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return { success: false, error: '请输入正确的邮箱格式 (如 user@example.com)' };
    }

    let username = rawUsername;
    if (!username) {
      username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
      if (!username || username.length < 2) {
        username = `user_${Math.random().toString(36).substring(2, 7)}`;
      }
    }

    const name = (payload.name || username || email.split('@')[0]).trim();
    const department = payload.department || '量化投研中心';
    const role = payload.role || 'pro';

    if (!password || password.length < 6) {
      return { success: false, error: '密码长度至少需要6位' };
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const passHash = await hashPassword(password, DEFAULT_SALT);
    const now = new Date().toISOString();
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}&backgroundColor=f1f5f9`;

    const userProfile: WorkerQuantUser = {
      id: userId,
      username,
      name,
      email,
      role,
      department,
      accountType: 'Institutional Pro',
      avatarUrl,
      status: 'active',
      createdAt: now,
      lastLogin: now,
    };

    if (db) {
      await this.initD1(db);
      try {
        // Check existing
        const existing = await db
          .prepare(`SELECT * FROM user_credentials WHERE LOWER(username) = ?`)
          .bind(username)
          .first<any>();

        if (existing) {
          return { success: false, error: '该用户名已在系统中注册，请直接登录' };
        }

        await db
          .prepare(
            `INSERT INTO users (id, username, email, name, role, department, account_type, avatar_url, status, created_at, updated_at, last_login)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(userId, username, email, name, role, department, 'Institutional Pro', avatarUrl, 'active', now, now, now)
          .run();

        await db
          .prepare(
            `INSERT INTO user_credentials (id, user_id, username, password_hash, salt, role, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(`cred_${userId}`, userId, username, passHash, DEFAULT_SALT, role, now)
          .run();

        const token = `aq_d1_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await db
          .prepare(
            `INSERT INTO sessions (id, user_id, username, token, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`sess_${Date.now()}`, userId, username, token, expiresAt, now)
          .run();

        return { success: true, user: userProfile, token };
      } catch (err) {
        console.warn('[WorkerAuth] D1 register error, fallback to memory:', err);
      }
    }

    // Save in memory
    inMemoryUsers.set(username, userProfile);
    inMemoryCredentials.set(username, {
      passwordHash: passHash,
      salt: DEFAULT_SALT,
      userId,
      role,
    });

    const token = `aq_mem_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    inMemorySessions.set(token, {
      userId,
      username,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return { success: true, user: userProfile, token };
  }

  public static async verifySession(
    db: D1Database | undefined,
    token: string
  ): Promise<{ success: boolean; user?: WorkerQuantUser }> {
    if (!token) return { success: false };

    if (db) {
      try {
        const sess = await db
          .prepare(`SELECT * FROM sessions WHERE token = ?`)
          .bind(token)
          .first<any>();

        if (sess) {
          const userRow = await db
            .prepare(`SELECT * FROM users WHERE id = ?`)
            .bind(sess.user_id)
            .first<any>();

          if (userRow) {
            return {
              success: true,
              user: {
                id: userRow.id,
                username: userRow.username,
                name: userRow.name,
                email: userRow.email,
                role: userRow.role,
                department: userRow.department,
                accountType: userRow.account_type,
                avatarUrl: userRow.avatar_url,
                status: userRow.status,
                createdAt: userRow.created_at,
                lastLogin: userRow.last_login,
              },
            };
          }
        }
      } catch (err) {
        console.warn('[WorkerAuth] Session lookup error in D1:', err);
      }
    }

    const memSess = inMemorySessions.get(token);
    if (memSess) {
      const user = inMemoryUsers.get(memSess.username);
      if (user) return { success: true, user };
    }

    return { success: false };
  }

  public static async getAllUsers(db?: D1Database): Promise<WorkerQuantUser[]> {
    if (db) {
      try {
        const res = await db.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all<any>();
        if (res.results && res.results.length > 0) {
          return res.results.map((u: any) => ({
            id: u.id,
            username: u.username,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department,
            accountType: u.account_type,
            avatarUrl: u.avatar_url,
            status: u.status,
            createdAt: u.created_at,
            lastLogin: u.last_login,
          }));
        }
      } catch (err) {
        console.warn('[WorkerAuth] getAllUsers D1 error, using in-memory:', err);
      }
    }
    return Array.from(inMemoryUsers.values());
  }

  public static async logoutUser(db: D1Database | undefined, token: string): Promise<void> {
    if (db && token) {
      try {
        await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
      } catch {}
    }
    if (token) {
      inMemorySessions.delete(token);
    }
  }
}
