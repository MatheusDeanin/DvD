import React, { useState } from 'react';
import { X, Hash, Volume2 } from 'lucide-react';

export function CreateChannelModal({ defaultType = 'text', onClose, onCreateChannel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType); // 'text' | 'voice'
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    try {
      await onCreateChannel({
        name: name.trim(),
        type,
        topic: topic.trim()
      });
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
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">Criar Canal</h2>
          <button onClick={onClose} className="text-discord-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-discord-red/20 text-discord-red text-xs font-medium">
              {error}
            </div>
          )}

          {/* Channel Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-2">
              Tipo de Canal
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setType('text')}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  type === 'text'
                    ? 'border-discord-blurple bg-discord-darkest text-white'
                    : 'border-white/5 bg-discord-darkest/40 text-discord-muted hover:text-white'
                }`}
              >
                <Hash className="w-5 h-5 text-discord-muted" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Texto</div>
                  <div className="text-xs text-discord-muted">Poste mensagens, imagens e memes</div>
                </div>
                <input type="radio" checked={type === 'text'} readOnly className="accent-discord-blurple" />
              </label>

              <label
                onClick={() => setType('voice')}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  type === 'voice'
                    ? 'border-discord-blurple bg-discord-darkest text-white'
                    : 'border-white/5 bg-discord-darkest/40 text-discord-muted hover:text-white'
                }`}
              >
                <Volume2 className="w-5 h-5 text-discord-green" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Voz e Vídeo</div>
                  <div className="text-xs text-discord-muted">Converse por voz, câmera e compartilhe sua tela</div>
                </div>
                <input type="radio" checked={type === 'voice'} readOnly className="accent-discord-blurple" />
              </label>
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
              Nome do Canal <span className="text-discord-red">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-discord-muted">
                {type === 'text' ? '#' : '🔊'}
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="novo-canal"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
              />
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
              Tópico do Canal (Opcional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Sobre o que é este canal?"
              className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-discord-blurple"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white hover:underline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar Canal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
