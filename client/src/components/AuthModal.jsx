import React, { useState } from 'react';
import { LogIn, UserPlus, Database, Shield, Zap, Sparkles, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

export function AuthModal({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (mode === 'forgot') {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: email, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao redefinir senha.');
        setSuccessMsg('Senha alterada com sucesso! Agora você pode entrar.');
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = mode === 'register'
      ? { username, email, password, displayName: displayName || username }
      : { login: email || username, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao autenticar.');
      }

      // Save token and user
      localStorage.setItem('discord_token', data.token);
      localStorage.setItem('discord_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick fill for testing
  const handleQuickDemo = (role) => {
    if (role === 'admin') {
      setEmail('admin@discord.local');
      setUsername('AdminGamer');
      setPassword('123456');
    } else {
      const randomNum = Math.floor(Math.random() * 90) + 10;
      setEmail(`amigo${randomNum}@discord.local`);
      setUsername(`Amigo${randomNum}`);
      setPassword('123456');
    }
    setMode('register');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-discord-dark rounded-xl shadow-2xl border border-white/5 overflow-hidden">
        {/* Banner header */}
        <div className="bg-gradient-to-r from-discord-blurple to-indigo-600 p-6 text-center text-white relative">
          <div className="inline-flex p-1.5 rounded-2xl bg-white/10 backdrop-blur-md mb-2 shadow-inner border border-white/10">
            <img
              src="/logo.jpg"
              alt="DvD Logo"
              className="w-16 h-16 object-contain rounded-xl shadow-md"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight">DvD</h1>
          <p className="text-sm text-indigo-100 mt-1 font-medium">
            100% Grátis • Voz, Câmera e Compartilhamento de Tela
          </p>

          {/* Neon Database badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 text-xs font-semibold backdrop-blur-md text-emerald-300 border border-emerald-400/20">
            <Database className="w-3.5 h-3.5" />
            <span>Banco Neon PostgreSQL</span>
          </div>
        </div>

        {/* Tab switcher */}
        {mode !== 'forgot' ? (
          <div className="flex border-b border-discord-darkest bg-discord-darkest/40">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                mode === 'login'
                  ? 'text-white border-b-2 border-discord-blurple bg-discord-dark'
                  : 'text-discord-muted hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                mode === 'register'
                  ? 'text-white border-b-2 border-discord-blurple bg-discord-dark'
                  : 'text-discord-muted hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Criar Conta
            </button>
          </div>
        ) : (
          <div className="p-3 border-b border-discord-darkest bg-discord-darkest/40 flex items-center justify-between px-6">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-discord-blurple" /> Recuperação de Senha
            </span>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              className="text-xs text-discord-muted hover:text-white flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Login
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-discord-red/20 border border-discord-red/40 text-discord-red text-xs font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                Nome de Usuário <span className="text-discord-red">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: player_um"
                className="w-full px-3 py-2.5 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
              {mode === 'register' ? 'E-mail' : 'E-mail ou Usuário'} <span className="text-discord-red">*</span>
            </label>
            <input
              type={mode === 'register' ? 'email' : 'text'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'register' ? 'seu-email@gmail.com' : 'email@exemplo.com ou usuário'}
              className="w-full px-3 py-2.5 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted">
                {mode === 'forgot' ? 'Nova Senha' : 'Senha'} <span className="text-discord-red">*</span>
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                  className="text-xs text-discord-blurple hover:underline font-medium"
                >
                  Esqueceu sua senha?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
            />
          </div>

          {mode === 'forgot' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                Confirmar Nova Senha <span className="text-discord-red">*</span>
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
              />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                Nome de Exibição (Apelido opcional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como seus amigos vão te ver"
                className="w-full px-3 py-2.5 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover font-semibold text-white text-sm transition-all shadow-lg hover:shadow-discord-blurple/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'forgot' ? (
              <>
                <KeyRound className="w-4 h-4" /> Redefinir Senha
              </>
            ) : mode === 'register' ? (
              <>
                <UserPlus className="w-4 h-4" /> Cadastrar e Entrar
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Entrar no DvD
              </>
            )}
          </button>

          {/* Quick Demo buttons */}
          {mode !== 'forgot' && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-xs text-center text-discord-muted mb-2">
                Teste rápido com 1 clique (para você ou seus amigos):
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin')}
                  className="px-2.5 py-1.5 rounded-md bg-discord-input hover:bg-discord-hover text-xs text-discord-text hover:text-white transition flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3 h-3 text-discord-yellow" />
                  Criar Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('friend')}
                  className="px-2.5 py-1.5 rounded-md bg-discord-input hover:bg-discord-hover text-xs text-discord-text hover:text-white transition flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3 h-3 text-discord-green" />
                  Criar Amigo
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
