import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  Shield,
  KeyRound,
  User,
  Mail,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../utils/i18n';
import { formatErrorMessage } from '../../utils/formatters';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { login, register } = useApp();
  const { t } = useI18n();

  // isSignUp: true 代表当前处于“注册账号”界面，false 代表处于“登录”界面
  const [isSignUp, setIsSignUp] = useState(initialMode === 'register');

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(initialMode === 'register');
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [isOpen, initialMode]);

  // 登录表单字段（支持输入用户名或邮箱）
  const [accountInput, setAccountInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 注册表单字段（支持自定义用户名、邮箱、密码、确认密码）
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // 处理登录提交（同时支持邮箱与用户名）
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const account = accountInput.trim();
    const pass = password.trim();

    if (!account || !pass) {
      setErrorMessage(t.auth.errEmptyAccount);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await login(account, pass);
      if (res.success) {
        setSuccessMessage(t.auth.successLogin);
        setTimeout(() => {
          onClose();
        }, 400);
      } else {
        setErrorMessage(formatErrorMessage(res.error, '登录验证失败，请检查账号或密码'));
      }
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err, '网络连接异常，请稍后重试'));
    } finally {
      setIsLoading(false);
    }
  };

  // 处理注册提交（包含用户名、邮箱、密码及确认密码）
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userEmail = regEmail.trim().toLowerCase();
    const userPass = regPassword.trim();
    const confirmPass = regConfirmPassword.trim();
    const username = regUsername.trim();

    // 校验用户名
    if (!username) {
      setErrorMessage(t.auth.errEmptyUsername);
      return;
    }
    if (username.length < 2 || username.length > 20) {
      setErrorMessage(t.auth.errInvalidUsername);
      return;
    }

    // 校验邮箱
    if (!userEmail) {
      setErrorMessage(t.auth.errEmptyEmail);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      setErrorMessage(t.auth.errInvalidEmail);
      return;
    }

    // 校验密码
    if (!userPass || userPass.length < 6) {
      setErrorMessage(t.auth.errPasswordShort);
      return;
    }
    if (confirmPass && userPass !== confirmPass) {
      setErrorMessage(t.auth.errPasswordMismatch);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await register({
        username,
        email: userEmail,
        password: userPass,
        name: username,
      });

      if (res.success) {
        setSuccessMessage(t.auth.successRegister);
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        setErrorMessage(formatErrorMessage(res.error, '注册失败，用户名或邮箱可能已被占用'));
      }
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err, '注册服务异常，请稍后再试'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-root"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none"
      style={{ backgroundColor: '#ebf0ff' }}
    >
      {/* ========================================================================= */}
      {/* 渐变流体波浪背景（精准还原图二优雅现代视觉） */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* 右上角流体渐变波浪 */}
        <svg
          className="absolute -top-10 -right-10 w-[60vw] max-w-[850px] h-[60vw] max-h-[850px] transition-transform duration-700"
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="topRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="45%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
          <path
            d="M320,0 C420,120 540,80 500,260 C460,440 380,480 520,580 L600,600 L600,0 Z"
            fill="url(#topRightGrad)"
            opacity="0.95"
          />
        </svg>

        {/* 左下角流体渐变波浪 */}
        <svg
          className="absolute -bottom-10 -left-10 w-[55vw] max-w-[750px] h-[55vw] max-h-[750px] transition-transform duration-700"
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bottomLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          <path
            d="M0,280 C140,260 220,380 200,480 C180,580 80,560 0,600 Z"
            fill="url(#bottomLeftGrad)"
            opacity="0.95"
          />
        </svg>
      </div>

      {/* 右上角关闭按钮 */}
      <button
        id="auth-modal-screen-close-btn"
        onClick={onClose}
        aria-label="关闭"
        className="absolute top-6 right-6 z-20 w-11 h-11 rounded-full bg-white/80 hover:bg-white text-neutral-600 hover:text-neutral-900 shadow-md backdrop-blur-md flex items-center justify-center transition-all cursor-pointer hover:scale-105 border border-white/60"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ========================================================================= */}
      {/* 双栏式微浮雕卡片（精准还原图一布局与现代中文排版） */}
      {/* ========================================================================= */}
      <div
        id="auth-box-container"
        className="relative z-10 w-full max-w-[840px] min-h-[500px] bg-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(37,99,235,0.18)] border border-neutral-100 overflow-hidden flex flex-col md:flex-row transition-all animate-in fade-in zoom-in-95 duration-300"
      >
        {/* ------------------------------------------------------------- */}
        {/* 左侧引导面板（欢迎词 & 模式一键切换） */}
        {/* ------------------------------------------------------------- */}
        <div className="relative w-full md:w-[42%] bg-[#f7f9fc] p-8 md:p-10 flex flex-col justify-center items-center text-center overflow-hidden border-b md:border-b-0 md:border-r border-neutral-100/80">
          {/* 微浮雕几何圆弧底纹 */}
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full border border-neutral-200/50 pointer-events-none opacity-60" />
          <div className="absolute -bottom-20 -left-12 w-64 h-64 rounded-full border border-neutral-200/60 pointer-events-none opacity-50" />
          <div className="absolute top-1/2 -right-20 w-44 h-44 rounded-full border border-neutral-200/40 pointer-events-none opacity-40" />

          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-800 tracking-tight mb-3">
              {isSignUp ? t.auth.leftWelcomeBackTitle : t.auth.leftHelloFriendTitle}
            </h2>
            <p className="text-xs md:text-[13px] text-neutral-400 font-normal leading-relaxed max-w-[240px] mb-8">
              {isSignUp ? t.auth.leftLoginDesc : t.auth.leftRegisterDesc}
            </p>

            <button
              id="auth-toggle-mode-btn"
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className="px-8 py-2.5 rounded-full bg-[#4863f7] hover:bg-[#3b54ea] active:scale-95 text-white text-xs font-bold tracking-wider shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              {isSignUp ? t.auth.btnSignIn : t.auth.btnSignUp}
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 右侧表单操作区（全中文沉浸交互） */}
        {/* ------------------------------------------------------------- */}
        <div className="relative w-full md:w-[58%] bg-white p-8 md:p-10 flex flex-col justify-center">
          {/* 标题与徽标 */}
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-800 tracking-tight">
              {isSignUp ? t.auth.createAccountTitle : t.auth.signInTitle}
            </h2>

            {/* 云端安全认证微章 */}
            <div className="flex items-center justify-center gap-3 mt-3.5 mb-2.5">
              <div
                title="Cloudflare D1 边缘分布式数据库"
                className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs"
              >
                <Database className="w-3.5 h-3.5" />
              </div>
              <div
                title="SHA-256 加密加盐存储"
                className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs"
              >
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div
                title="量化投研安全鉴权通道"
                className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 font-normal">
              {isSignUp ? t.auth.orRegisterWith : t.auth.orLoginWith}
            </p>
          </div>

          {/* 状态通知 */}
          {errorMessage && (
            <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{formatErrorMessage(errorMessage)}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* 表单区域 */}
          {isSignUp ? (
            /* ================= 注册表单（包含可编辑用户名、邮箱与密码） ================= */
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              {/* 用户名输入框（注册时自由填写） */}
              <div className="relative">
                <input
                  id="auth-reg-username"
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder={t.auth.inputUsernamePlaceholder}
                  className="w-full h-11 px-4 text-xs md:text-sm text-neutral-800 bg-[#f4f7fa] placeholder-neutral-400 rounded-xl border border-neutral-200/70 focus:border-[#4863f7] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              {/* 电子邮箱输入框 */}
              <div className="relative">
                <input
                  id="auth-reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder={t.auth.inputEmailPlaceholder}
                  className="w-full h-11 px-4 text-xs md:text-sm text-neutral-800 bg-[#f4f7fa] placeholder-neutral-400 rounded-xl border border-neutral-200/70 focus:border-[#4863f7] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              {/* 密码输入框 */}
              <div className="relative">
                <input
                  id="auth-reg-password"
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder={t.auth.inputRegPasswordPlaceholder}
                  className="w-full h-11 pl-4 pr-10 text-xs md:text-sm text-neutral-800 bg-[#f4f7fa] placeholder-neutral-400 rounded-xl border border-neutral-200/70 focus:border-[#4863f7] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? '隐藏密码' : '显示密码'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* 确认密码输入框 */}
              <div>
                <input
                  id="auth-reg-confirmpass"
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder={t.auth.inputConfirmPasswordPlaceholder}
                  className="w-full h-11 px-4 text-xs md:text-sm text-neutral-800 bg-[#f4f7fa] placeholder-neutral-400 rounded-xl border border-neutral-200/70 focus:border-[#4863f7] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  id="auth-submit-signup-btn"
                  type="submit"
                  disabled={isLoading}
                  className="px-10 py-3 rounded-full bg-[#4863f7] hover:bg-[#3b54ea] active:scale-95 text-white text-xs font-bold tracking-wider shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.auth.submittingRegister}</span>
                    </>
                  ) : (
                    <span>{t.auth.btnSubmitSignUp}</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ================= 登录表单（支持邮箱或用户名） ================= */
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              {/* 邮箱或用户名输入框 */}
              <div>
                <input
                  id="auth-input-email"
                  type="text"
                  required
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  placeholder={t.auth.inputAccountPlaceholder}
                  className="w-full h-11 px-4 text-xs md:text-sm text-neutral-800 bg-[#f4f7fa] placeholder-neutral-400 rounded-xl border border-neutral-200/70 focus:border-[#4863f7] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              {/* 登录密码输入框 */}
              <div className="relative">
                <input
                  id="auth-input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.inputPasswordPlaceholder}
                  className="w-full h-11 pl-4 pr-10 text-xs md:text-sm text-neutral-800 bg-[#f4f7fa] placeholder-neutral-400 rounded-xl border border-neutral-200/70 focus:border-[#4863f7] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-end text-[11px] text-neutral-400 px-1 pt-1">
                <span className="text-neutral-400">{t.auth.d1EncryptedBadge}</span>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  id="auth-submit-signin-btn"
                  type="submit"
                  disabled={isLoading}
                  className="px-10 py-3 rounded-full bg-[#4863f7] hover:bg-[#3b54ea] active:scale-95 text-white text-xs font-bold tracking-wider shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.auth.submittingLogin}</span>
                    </>
                  ) : (
                    <span>{t.auth.btnSubmitSignIn}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
