/**
 * AetherQuant i18n Translation Dictionary & Hook
 * 支持后期一键扩展与切换多语言（默认纯中文 zh-CN）
 */

export type SupportedLanguage = 'zh' | 'en';

export const translations = {
  zh: {
    // 认证与登录注册模块
    auth: {
      signInTitle: '登录 AetherQuant',
      createAccountTitle: '注册量化投研账号',
      leftWelcomeBackTitle: '欢迎回来！',
      leftHelloFriendTitle: '您好，量化研究员！',
      leftLoginDesc: '登录您的专属投研账号，无缝同步多因子模型、回测与实盘数据。',
      leftRegisterDesc: '创建专属量化投研账号，开启智能因子挖掘与全自动量化回测。',
      btnSignIn: '立即登录',
      btnSignUp: '注册新账号',
      btnSubmitSignIn: '立即登录',
      btnSubmitSignUp: '确认注册',
      orLoginWith: '或使用电子邮箱 / 用户名登录',
      orRegisterWith: '请填写以下信息完成注册',
      inputAccountPlaceholder: '电子邮箱或用户名',
      inputPasswordPlaceholder: '请输入登录密码',
      inputUsernamePlaceholder: '设置用户名 (注册后不可更改)',
      inputEmailPlaceholder: '电子邮箱 (如 trader@example.com)',
      inputRegPasswordPlaceholder: '设置登录密码 (至少 6 位)',
      inputConfirmPasswordPlaceholder: '再次输入密码以确认',
      fillAdminBtn: '填入系统管理员 (admin)',
      d1EncryptedBadge: 'D1 数据库安全认证',
      submittingLogin: '正在验证登录...',
      submittingRegister: '正在创建账号...',
      errEmptyAccount: '请输入电子邮箱/用户名与登录密码',
      errEmptyUsername: '请设置您的用户名',
      errInvalidUsername: '用户名需为 2-20 位字符 (支持中英文、数字与下划线)',
      errEmptyEmail: '请输入有效的电子邮箱',
      errInvalidEmail: '邮箱格式不正确 (如 trader@example.com)',
      errPasswordShort: '密码长度至少需要 6 位',
      errPasswordMismatch: '两次输入的密码不一致，请核对',
      successLogin: '验证成功，欢迎进入 AetherQuant！',
      successRegister: '注册成功！已安全写入 D1 数据库，正在登录...',
    },
    // 用户个人资料模块
    profile: {
      title: '个人投研中心',
      editProfile: '编辑个人资料',
      usernameLabel: '用户名',
      usernameImmutableHint: '用户名在注册后已固定，不可更改',
      nicknameLabel: '用户昵称 / 称谓',
      emailLabel: '电子邮箱',
      titleLabel: '职位头衔',
      departmentLabel: '所属部门 / 组别',
      bioLabel: '量化研究方向简介',
      saveChanges: '保存个人资料',
      saving: '正在保存...',
      errInvalidNickname: '昵称长度需为 2-20 个字符',
      errInvalidEmail: '请输入合法的邮箱格式',
      successUpdate: '个人资料已更新成功',
    },
    // 常规通用词汇
    common: {
      close: '关闭',
      cancel: '取消',
      confirm: '确认',
      success: '操作成功',
      failed: '操作失败',
    },
  },
  en: {
    auth: {
      signInTitle: 'Sign In to AetherQuant',
      createAccountTitle: 'Create Quant Account',
      leftWelcomeBackTitle: 'Welcome Back !',
      leftHelloFriendTitle: 'Hello, Researcher !',
      leftLoginDesc: 'Log in to sync your factor models, backtests, and live trading data.',
      leftRegisterDesc: 'Create an account to start intelligent factor discovery and automated backtesting.',
      btnSignIn: 'Sign In',
      btnSignUp: 'Create Account',
      btnSubmitSignIn: 'Sign In',
      btnSubmitSignUp: 'Sign Up',
      orLoginWith: 'Or sign in with email / username',
      orRegisterWith: 'Fill in details to register',
      inputAccountPlaceholder: 'Email or Username',
      inputPasswordPlaceholder: 'Enter Password',
      inputUsernamePlaceholder: 'Username (Immutable after registration)',
      inputEmailPlaceholder: 'Email Address (e.g. trader@example.com)',
      inputRegPasswordPlaceholder: 'Set Password (min 6 characters)',
      inputConfirmPasswordPlaceholder: 'Confirm Password',
      fillAdminBtn: 'Fill Administrator (admin)',
      d1EncryptedBadge: 'D1 Secure Database Encrypted',
      submittingLogin: 'Signing in...',
      submittingRegister: 'Creating account...',
      errEmptyAccount: 'Please enter email/username and password',
      errEmptyUsername: 'Please enter a username',
      errInvalidUsername: 'Username must be 2-20 alphanumeric characters or underscore',
      errEmptyEmail: 'Please enter a valid email',
      errInvalidEmail: 'Invalid email format (e.g. trader@example.com)',
      errPasswordShort: 'Password must be at least 6 characters',
      errPasswordMismatch: 'Passwords do not match',
      successLogin: 'Authenticated successfully. Welcome to AetherQuant!',
      successRegister: 'Registered successfully! Stored in D1 database.',
    },
    profile: {
      title: 'User Center',
      editProfile: 'Edit Profile',
      usernameLabel: 'Username',
      usernameImmutableHint: 'Username is permanent and cannot be changed',
      nicknameLabel: 'Nickname / Display Name',
      emailLabel: 'Email Address',
      titleLabel: 'Title / Role',
      departmentLabel: 'Department',
      bioLabel: 'Bio & Research Focus',
      saveChanges: 'Save Changes',
      saving: 'Saving...',
      errInvalidNickname: 'Nickname must be 2-20 characters',
      errInvalidEmail: 'Please enter a valid email address',
      successUpdate: 'Profile updated successfully',
    },
    common: {
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      success: 'Success',
      failed: 'Failed',
    },
  },
};

const CURRENT_LANG_KEY = 'aetherquant_app_lang_v1';

export function getAppLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(CURRENT_LANG_KEY) as SupportedLanguage;
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // fallback
  }
  return 'zh'; // 默认纯中文
}

export function setAppLanguage(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(CURRENT_LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export function useI18n() {
  const currentLang = getAppLanguage();
  const t = translations[currentLang];
  return {
    t,
    lang: currentLang,
    setLanguage: (lang: SupportedLanguage) => {
      setAppLanguage(lang);
      window.dispatchEvent(new Event('aetherquant_lang_changed'));
    },
  };
}
