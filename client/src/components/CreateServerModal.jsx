import React, { useState } from 'react';
import { X, Plus, Hash, KeyRound, Sparkles } from 'lucide-react';

export function CreateServerModal({ onClose, onCreateServer, onJoinServer }) {
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreateServer({ name: name.trim(), iconUrl: iconUrl.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onJoinServer(inviteCode.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-discord-dark rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center relative border-b border-white/5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-discord-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-black text-white">
            {tab === 'create' ? 'Crie o seu servidor' : 'Entrar em um servidor'}
          </h2>
          <p className="text-xs text-discord-muted mt-1">
            Seu servidor é onde você e seus amigos se reúnem para jogar e conversar.
          </p>

          {/* Switch tabs */}
          <div className="flex bg-discord-darkest rounded-lg p-1 mt-4">
            <button
              onClick={() => { setTab('create'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                tab === 'create' ? 'bg-discord-blurple text-white' : 'text-discord-muted hover:text-white'
              }`}
            >
              Criar Novo
            </button>
            <button
              onClick={() => { setTab('join'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                tab === 'join' ? 'bg-discord-blurple text-white' : 'text-discord-muted hover:text-white'
              }`}
            >
              Entrar com Convite
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-discord-red/20 text-discord-red text-xs font-medium border border-discord-red/30">
              {error}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                  Nome do Servidor <span className="text-discord-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Sala de Jogos dos Amigos"
                  className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                  Ícone do Servidor (Opcional)
                </label>
                <input
                  type="text"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="URL direta de uma imagem"
                  className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full py-2.5 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover font-semibold text-white text-sm transition shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Servidor'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                  Código de Convite <span className="text-discord-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Ex: AMIGOS10 ou INV-XXXXXX"
                  className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple uppercase font-mono"
                />
                <p className="text-[11px] text-discord-muted mt-1">
                  Exemplo: O servidor principal usa o código <span className="text-white font-mono">AMIGOS10</span>
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !inviteCode.trim()}
                  className="w-full py-2.5 rounded-lg bg-discord-green hover:bg-emerald-500 font-semibold text-black text-sm transition shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Entrando...' : 'Entrar no Servidor'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
