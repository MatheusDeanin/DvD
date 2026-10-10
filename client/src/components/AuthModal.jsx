import React, { useState } from 'react';
import { LogIn, UserPlus, Database, Shield, Zap, Sparkles, KeyRound, ArrowLeft, CheckCircle2, Download, Copy } from 'lucide-react';

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
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [pendingAuth, setPendingAuth] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: email, recoveryCode: confirmPassword, newPassword: password })
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
      ? { username, email, password, displayName: displayName || username, acceptTerms: document.getElementById('consentLGPD')?.checked }
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

      if (mode === 'register' && data.recoveryCodes) {
        setRecoveryCodes(data.recoveryCodes);
        setPendingAuth({ user: data.user, token: data.token });
      } else {
        onLoginSuccess(data.user, data.token);
      }
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
      <div className="relative w-full max-w-md bg-discord-dark rounded-xl shadow-2xl border border-white/5 overflow-y-auto max-h-[95vh] scrollbar-thin">
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

        {/* Form Body or Recovery Codes */}
        {recoveryCodes ? (
          <div className="p-6 space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-2">Códigos de Recuperação</h2>
              <p className="text-sm text-discord-muted">
                Guarde estes códigos em um lugar seguro. Eles são a única forma de acessar sua conta caso você perca sua senha. Cada código só pode ser usado uma vez.
              </p>
            </div>

            <div className="bg-discord-darkest rounded-xl p-4 border border-white/5 shadow-inner">
              <div className="grid grid-cols-2 gap-3 text-center">
                {recoveryCodes.map((code, idx) => (
                  <div key={idx} className="font-mono text-sm text-discord-green font-bold bg-black/30 py-2 rounded">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCodes.join('\n'));
                  setSuccessMsg('Códigos copiados para a área de transferência!');
                  setTimeout(() => setSuccessMsg(''), 3000);
                }}
                className="flex-1 py-2.5 rounded-lg bg-discord-darkest hover:bg-discord-darkest/80 text-white text-xs font-semibold flex items-center justify-center gap-2 transition border border-white/10"
              >
                <Copy className="w-4 h-4" /> Copiar
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([`CÓDIGOS DE RECUPERAÇÃO - DVD\n\nGuarde em um lugar seguro!\n\n${recoveryCodes.join('\n')}`], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dvd_recovery_codes_${pendingAuth?.user?.username || 'user'}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 py-2.5 rounded-lg bg-discord-darkest hover:bg-discord-darkest/80 text-white text-xs font-semibold flex items-center justify-center gap-2 transition border border-white/10"
              >
                <Download className="w-4 h-4" /> Baixar .txt
              </button>
            </div>

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (pendingAuth) {
                    onLoginSuccess(pendingAuth.user, pendingAuth.token);
                  }
                }}
                className="w-full py-3 px-4 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover font-semibold text-white text-sm transition-all shadow-lg"
              >
                Entendi, já guardei com segurança
              </button>
            </div>
          </div>
        ) : (
          <>
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
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                  Código de Recuperação <span className="text-discord-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Seu código de 16 caracteres"
                  className="w-full px-3 py-2.5 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
                />
              </div>
              <p className="text-xs text-discord-muted text-center">
                Você recebeu códigos de recuperação quando criou sua conta.
              </p>
            </>
          )}

          {mode === 'register' && (
            <>
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
              <div className="flex items-start gap-2 mt-4 bg-discord-darkest/50 p-3 rounded-lg border border-white/5">
                <input
                  type="checkbox"
                  id="consentLGPD"
                  required
                  className="mt-0.5 accent-discord-blurple w-4 h-4 cursor-pointer"
                />
                <label htmlFor="consentLGPD" className="text-xs text-discord-muted leading-tight">
                  Eu concordo com os <a href="#" onClick={(e) => { e.preventDefault(); alert('Termos e LGPD: Nós armazenamos apenas o necessário para sua conta funcionar (email, senha, nome, status, amigos). Suas mensagens são guardadas até você apagar. Ao aceitar, você concorda com este processamento e pode solicitar a exportação ou exclusão dos seus dados a qualquer momento.'); }} className="text-discord-blurple hover:underline">Termos de Serviço e Política de Privacidade (LGPD)</a>, e consinto com o processamento dos meus dados para usar o DvD.
                </label>
              </div>
            </>
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
          </>
        )}
      </div>
    </div>
  );
}
