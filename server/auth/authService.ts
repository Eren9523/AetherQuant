import crypto from 'crypto';
import { d1Client } from '../db/d1Client';

export interface QuantUser {
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
 * Hash password with salt using SHA-256
 */
export function hashPassword(password: string, salt: string = DEFAULT_SALT): string {
  return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
}

export class D1AuthService {
  private static isInitialized = false;

  /**
   * Seed all initial default users and encrypted credentials into Cloudflare D1 tables
   */
  public static async initD1AdminCredentials(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const now = new Date().toISOString();

      // 1. Ensure table schemas exist
      await d1Client.executeQuery(
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
      );

      await d1Client.executeQuery(
        `CREATE TABLE IF NOT EXISTS user_credentials (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL,
           username TEXT UNIQUE NOT NULL,
           password_hash TEXT NOT NULL,
           salt TEXT NOT NULL,
           role TEXT NOT NULL DEFAULT 'free',
           updated_at TEXT NOT NULL
         )`
      );

      await d1Client.executeQuery(
        `CREATE TABLE IF NOT EXISTS sessions (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL,
           username TEXT NOT NULL,
           token TEXT UNIQUE NOT NULL,
           expires_at TEXT NOT NULL,
           created_at TEXT NOT NULL
         )`
      );

      // 2. Initialize default system admin in D1 if not exists
      const initialUsers = [
        {
          id: 'usr_admin_001',
          username: 'admin',
          name: '系统管理员',
          email: 'admin@aetherquant.io',
          password: 'penguin778',
          role: 'admin',
          department: '量化系统管理部',
          accountType: 'System Administrator',
          avatarUrl: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=QuantLead&backgroundColor=f8fafc',
          createdAt: '2024-03-15',
        },
      ];

      for (const u of initialUsers) {
        const passHash = hashPassword(u.password, DEFAULT_SALT);

        // Check if user already exists in D1
        const existing = await d1Client.executeQuery<any>(
          `SELECT id, avatar_url, name, email, department, account_type FROM users WHERE id = ? OR LOWER(username) = LOWER(?) LIMIT 1`,
          [u.id, u.username]
        );

        if (!existing.results || existing.results.length === 0) {
          // Insert initial user record only if not exists
          await d1Client.executeQuery(
            `INSERT INTO users (id, username, email, name, role, department, account_type, avatar_url, status, created_at, updated_at, last_login)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [u.id, u.username, u.email, u.name, u.role, u.department, u.accountType, u.avatarUrl, 'offline', u.createdAt, now, null]
          );
        }

        // Insert or update credentials table in D1
        await d1Client.executeQuery(
          `INSERT OR REPLACE INTO user_credentials (id, user_id, username, password_hash, salt, role, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [`cred_${u.username}`, u.id, u.username, passHash, DEFAULT_SALT, u.role, now]
        );
      }

      console.log('[D1Auth] Initialized system admin account in Cloudflare D1 with salted SHA-256 encryption.');
      this.isInitialized = true;
    } catch (err) {
      console.error('[D1Auth] Error initializing D1 credentials:', err);
    }
  }

  /**
   * Verify username & password against encrypted hash in D1 database
   */
  public static async verifyCredentials(username: string, password: string): Promise<{ success: boolean; user?: QuantUser; token?: string; error?: string }> {
    await this.initD1AdminCredentials();

    try {
      const trimmedUser = (username || '').trim().toLowerCase();
      const trimmedPass = (password || '').trim();

      if (!trimmedUser || !trimmedPass) {
        return { success: false, error: '用户名和密码不能为空' };
      }

      // Query credential record in D1 by username OR email
      const creds = await d1Client.executeQuery<any>(
        `SELECT * FROM user_credentials WHERE LOWER(username) = ?`,
        [trimmedUser]
      );

      let credRecord = creds.results && creds.results[0];

      if (!credRecord) {
        // Try query user by email in users table first
        const userByEmail = await d1Client.executeQuery<any>(
          `SELECT * FROM users WHERE LOWER(email) = ?`,
          [trimmedUser]
        );
        if (userByEmail.results && userByEmail.results[0]) {
          const u = userByEmail.results[0];
          const credRes = await d1Client.executeQuery<any>(
            `SELECT * FROM user_credentials WHERE user_id = ?`,
            [u.id]
          );
          credRecord = credRes.results && credRes.results[0];
        }
      }

      if (!credRecord) {
        return { success: false, error: '账号不存在，请检查用户名或注册新账号' };
      }

      const computedHash = hashPassword(trimmedPass, credRecord.salt || DEFAULT_SALT);

      if (computedHash !== credRecord.password_hash) {
        return { success: false, error: '密码错误，请核对后重试' };
      }

      // Query user profile from D1
      const userRes = await d1Client.executeQuery<any>(
        `SELECT * FROM users WHERE id = ?`,
        [credRecord.user_id]
      );

      const u = userRes.results && userRes.results[0];
      const now = new Date().toISOString();

      // Create session in D1
      const token = `aq_d1_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await d1Client.executeQuery(
        `INSERT INTO sessions (id, user_id, username, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`sess_${Date.now()}`, credRecord.user_id, credRecord.username, token, expiresAt, now]
      );

      // Update last_login in D1
      await d1Client.executeQuery(
        `UPDATE users SET last_login = ? WHERE id = ?`,
        [now, credRecord.user_id]
      );

      const quantUser: QuantUser = {
        id: u?.id || credRecord.user_id,
        username: credRecord.username,
        name: u?.name || credRecord.username,
        email: u?.email || `${credRecord.username}@aetherquant.io`,
        role: u?.role || credRecord.role || 'free',
        department: u?.department || '量化投研中心',
        accountType: u?.account_type || 'Quantitative Pro',
        avatarUrl: u?.avatar_url || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(credRecord.username)}&backgroundColor=f8fafc`,
        status: u?.status || 'active',
        createdAt: u?.created_at || now,
        lastLogin: now,
      };

      return {
        success: true,
        user: quantUser,
        token,
      };
    } catch (e: any) {
      console.error('[D1Auth] Verification error:', e);
      return { success: false, error: e.message || 'D1 数据库查询异常' };
    }
  }

  /**
   * Register a new user and store credentials directly into D1
   */
  public static async registerUser(payload: {
    username?: string;
    password: string;
    name?: string;
    email?: string;
    department?: string;
    role?: 'free' | 'pro' | 'researcher' | 'trader' | 'admin';
  }): Promise<{ success: boolean; user?: QuantUser; token?: string; error?: string }> {
    await this.initD1AdminCredentials();

    const rawEmail = (payload.email || '').trim().toLowerCase();
    const rawUsername = (payload.username || '').trim().toLowerCase();
    const password = (payload.password || '').trim();

    if (!rawEmail && !rawUsername) {
      return { success: false, error: '请输入有效的电子邮箱' };
    }

    const email = rawEmail || `${rawUsername}@aetherquant.io`;
    // Validate email format simply
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

    // Check if email already exists in users table
    if (rawEmail) {
      const existingEmail = await d1Client.executeQuery<any>(
        `SELECT * FROM users WHERE LOWER(email) = ?`,
        [email]
      );
      if (existingEmail.results && existingEmail.results.length > 0) {
        return { success: false, error: '该邮箱已在系统中注册，请直接登录' };
      }
    }

    // Check if username already exists in D1
    const existing = await d1Client.executeQuery<any>(
      `SELECT * FROM user_credentials WHERE LOWER(username) = ?`,
      [username]
    );

    if (existing.results && existing.results.length > 0) {
      // If user provided email only, disambiguate username with suffix
      if (!rawUsername && rawEmail) {
        username = `${username}_${Math.random().toString(36).substring(2, 6)}`;
      } else {
        return { success: false, error: '该用户名已在 D1 数据库中注册，请直接登录' };
      }
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const passHash = hashPassword(password, DEFAULT_SALT);
    const now = new Date().toISOString();
    const avatarUrl = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(username)}&backgroundColor=f8fafc`;

    // 1. Insert into users table
    await d1Client.executeQuery(
      `INSERT INTO users (id, username, email, name, role, department, account_type, avatar_url, status, created_at, updated_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, email, name, role, department, 'Institutional Pro', avatarUrl, 'active', now, now, now]
    );

    // 2. Insert into credentials table
    await d1Client.executeQuery(
      `INSERT INTO user_credentials (id, user_id, username, password_hash, salt, role, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`cred_${userId}`, userId, username, passHash, DEFAULT_SALT, role, now]
    );

    // 3. Create session
    const token = `aq_d1_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await d1Client.executeQuery(
      `INSERT INTO sessions (id, user_id, username, token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`sess_${Date.now()}`, userId, username, token, expiresAt, now]
    );

    const quantUser: QuantUser = {
      id: userId,
      username,
      name,
      email,
      role,
      department,
      accountType: 'Institutional Standard',
      avatarUrl,
      status: 'active',
      createdAt: now,
      lastLogin: now,
    };

    return {
      success: true,
      user: quantUser,
      token,
    };
  }

  /**
   * Update user avatar in D1
   */
  public static async updateUserAvatar(userIdOrUsername: string, avatarUrl: string): Promise<{ success: boolean; avatarUrl: string; error?: string }> {
    await this.initD1AdminCredentials();
    if (!userIdOrUsername || !avatarUrl) {
      return { success: false, avatarUrl: '', error: '缺少用户标识或头像数据' };
    }

    try {
      const now = new Date().toISOString();
      await d1Client.executeQuery(
        `UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ? OR LOWER(username) = LOWER(?)`,
        [avatarUrl, now, userIdOrUsername, userIdOrUsername]
      );
      return { success: true, avatarUrl };
    } catch (err: any) {
      return { success: false, avatarUrl, error: err.message || '更新头像失败' };
    }
  }

  /**
   * Update user profile in D1
   */
  public static async updateUserProfile(userIdOrUsername: string, profileData: Partial<QuantUser>): Promise<{ success: boolean; user?: QuantUser; error?: string }> {
    await this.initD1AdminCredentials();
    if (!userIdOrUsername) {
      return { success: false, error: '缺少用户标识' };
    }

    try {
      const now = new Date().toISOString();
      const existing = await d1Client.executeQuery<any>(
        `SELECT * FROM users WHERE id = ? OR LOWER(username) = LOWER(?)`,
        [userIdOrUsername, userIdOrUsername]
      );

      if (existing.results && existing.results.length > 0) {
        const u = existing.results[0];
        const newName = profileData.name !== undefined ? profileData.name : u.name;
        const newEmail = profileData.email !== undefined ? profileData.email : u.email;
        const newDept = profileData.department !== undefined ? profileData.department : u.department;
        const newAccountType = profileData.accountType !== undefined ? profileData.accountType : u.account_type;
        const newAvatar = profileData.avatarUrl !== undefined ? profileData.avatarUrl : u.avatar_url;

        await d1Client.executeQuery(
          `UPDATE users SET name = ?, email = ?, department = ?, account_type = ?, avatar_url = ?, updated_at = ? WHERE id = ?`,
          [newName, newEmail, newDept, newAccountType, newAvatar, now, u.id]
        );

        return {
          success: true,
          user: {
            id: u.id,
            username: u.username,
            name: newName,
            email: newEmail,
            role: u.role,
            department: newDept,
            accountType: newAccountType,
            avatarUrl: newAvatar,
            status: u.status,
            createdAt: u.created_at,
            lastLogin: u.last_login || now,
          },
        };
      }
      return { success: false, error: '未找到用户记录' };
    } catch (err: any) {
      return { success: false, error: err.message || '更新个人资料失败' };
    }
  }

  /**
   * Verify session token in D1
   */
  public static async verifySession(token: string): Promise<{ success: boolean; user?: QuantUser }> {
    if (!token) return { success: false };
    await this.initD1AdminCredentials();

    try {
      const sessRes = await d1Client.executeQuery<any>(
        `SELECT * FROM sessions WHERE token = ?`,
        [token]
      );

      if (!sessRes.results || sessRes.results.length === 0) {
        return { success: false };
      }

      const sess = sessRes.results[0];
      const userRes = await d1Client.executeQuery<any>(
        `SELECT * FROM users WHERE id = ?`,
        [sess.user_id]
      );

      if (!userRes.results || userRes.results.length === 0) {
        return { success: false };
      }

      const u = userRes.results[0];
      return {
        success: true,
        user: {
          id: u.id,
          username: u.username || sess.username,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          accountType: u.account_type,
          avatarUrl: u.avatar_url,
          status: u.status,
          createdAt: u.created_at,
          lastLogin: u.last_login,
        },
      };
    } catch {
      return { success: false };
    }
  }

  /**
   * Invalidate session / Logout from D1
   */
  public static async logoutUser(token?: string): Promise<{ success: boolean }> {
    if (!token) return { success: true };
    try {
      await d1Client.executeQuery(`DELETE FROM sessions WHERE token = ?`, [token]);
      return { success: true };
    } catch {
      return { success: true };
    }
  }

  /**
   * Get all users in D1 for Admin Console
   */
  public static async getAllUsers(): Promise<QuantUser[]> {
    await this.initD1AdminCredentials();
    const res = await d1Client.executeQuery<any>(`SELECT * FROM users ORDER BY created_at ASC`);
    if (res.results && res.results.length > 0) {
      return res.results.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department || '量化投研中心',
        accountType: u.account_type || 'Standard',
        avatarUrl: u.avatar_url || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(u.username)}&backgroundColor=f8fafc`,
        status: u.status || 'offline',
        createdAt: u.created_at || '2024-03-15',
        lastLogin: u.last_login ? new Date(u.last_login).toLocaleString() : '未登录',
      }));
    }
    return [];
  }
}
