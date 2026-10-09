import React, { useState } from 'react';
import {
  X,
  User,
  Activity,
  LogOut,
  Sparkles,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Palette
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Gamer1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=CyberNinja',
  'https://api.dicebear.com/7.x/bottts/svg?seed=ProSniper',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=HeroX',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Valkyrie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
];

const BANNER_COLORS = [
  '#5865F2', // Blurple
  '#57F287', // Green
  '#FEE75C', // Yellow
  '#EB459E', // Pink
  '#ED4245', // Red
  '#18191C'  // Dark
];

export function UserSettingsModal({
  currentUser,
  onClose,
  onUpdateProfile,
  onLogout,
  keepAliveStatus,
  onTriggerPing
}) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'keepalive'

  // Profile Form States
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [bannerColor, setBannerColor] = useState(currentUser?.banner_color || '#5865F2');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [statusMode, setStatusMode] = useState(currentUser?.status_mode || 'online');
  const [statusText, setStatusText] = useState(currentUser?.status_text || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile({
        displayName,
        avatarUrl,
        bannerColor,
        bio,
        statusMode,
        statusText
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      alert('Erro ao salvar perfil: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPing = async () => {
    setPingTesting(true);
    setPingResult(null);
    try {
      const res = await onTriggerPing();
      setPingResult(res);
    } catch (err) {
      setPingResult({ error: err.message });
    } finally {
      setPingTesting(false);
    }
  };

  const statusColors = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-4xl h-[85vh] bg-discord-chat rounded-2xl shadow-2xl border border-white/5 flex overflow-hidden">
        {/* Settings Navigation Sidebar */}
        <div className="w-60 bg-discord-dark py-6 px-4 flex flex-col justify-between border-r border-discord-darkest/60">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-discord-muted px-2 mb-2">
              Configurações de Usuário
            </h2>

            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold transition ${
                  activeTab === 'profile'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-muted hover:bg-discord-hover hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                Perfil do Usuário
              </button>

              <button
                onClick={() => setActiveTab('keepalive')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold transition ${
                  activeTab === 'keepalive'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-muted hover:bg-discord-hover hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                Anti-Sleep (Render 24/7)
              </button>
            </div>
          </div>

          {/* Logout button */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-discord-red hover:bg-discord-red/10 transition"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-8 relative">
          {/* Close button (ESC) */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full border border-white/10 text-discord-muted hover:text-white hover:bg-white/5 transition flex items-center gap-1 text-xs"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline font-bold">ESC</span>
          </button>

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              <h1 className="text-xl font-black text-white mb-6">
                Perfil de Usuário
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Form Inputs */}
                <form onSubmit={handleSave} className="space-y-4">
                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Nome de Exibição
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={currentUser?.username}
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    />
                  </div>

                  {/* Status Text */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Status Personalizado
                    </label>
                    <input
                      type="text"
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      placeholder="Ex: Jogando com os amigos"
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    />
                  </div>

                  {/* Status Mode */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Modo de Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'online', label: 'Online', color: 'bg-discord-green' },
                        { id: 'idle', label: 'Ausente', color: 'bg-discord-yellow' },
                        { id: 'dnd', label: 'Não Perturbe', color: 'bg-discord-red' },
                        { id: 'offline', label: 'Invisível', color: 'bg-discord-muted' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setStatusMode(item.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition ${
                            statusMode === item.id
                              ? 'border-discord-blurple bg-discord-blurple/20 text-white'
                              : 'border-white/5 bg-discord-darkest text-discord-muted hover:text-white'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Avatar URL or Presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Avatar (URL direta ou escolha abaixo)
                    </label>
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-discord-blurple mb-2"
                    />
                    <div className="flex gap-2">
                      {AVATAR_PRESETS.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAvatarUrl(preset)}
                          className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                            avatarUrl === preset ? 'border-discord-blurple scale-110' : 'border-transparent hover:scale-105'
                          }`}
                        >
                          <img src={preset} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Banner Color */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Cor do Banner de Perfil
                    </label>
                    <div className="flex items-center gap-2">
                      {BANNER_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBannerColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-7 h-7 rounded-full border-2 transition ${
                            bannerColor === color ? 'border-white scale-110' : 'border-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Sobre Mim
                    </label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Conte um pouco sobre você..."
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover font-semibold text-white text-sm transition shadow-lg flex items-center justify-center gap-2"
                  >
                    {saving ? 'Salvando...' : savedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" /> Salvo com Sucesso!
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>
                </form>

                {/* Live Discord Profile Card Preview */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-discord-muted mb-2">
                    Pré-Visualização do Perfil
                  </h3>
                  <div className="w-full bg-discord-darkest rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                    {/* Card Banner */}
                    <div
                      style={{ backgroundColor: bannerColor }}
                      className="h-24 w-full relative transition-colors duration-300"
                    />

                    {/* Avatar & Badges */}
                    <div className="px-4 pb-4 relative">
                      <div className="relative -mt-12 mb-3 inline-block">
                        <img
                          src={avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + currentUser?.username}
                          alt=""
                          className="w-20 h-20 rounded-full border-4 border-discord-darkest bg-discord-dark object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-5 h-5 rounded-full ring-4 ring-discord-darkest ${statusColors[statusMode]}`}
                        />
                      </div>

                      {/* Display name & username */}
                      <div className="p-3 bg-discord-dark rounded-xl space-y-2">
                        <div>
                          <h4 className="text-base font-black text-white">
                            {displayName || currentUser?.username}
                          </h4>
                          <p className="text-xs text-discord-muted">
                            @{currentUser?.username}
                          </p>
                        </div>

                        {statusText && (
                          <div className="text-xs text-discord-text bg-discord-input/60 px-2.5 py-1.5 rounded-md font-medium">
                            {statusText}
                          </div>
                        )}

                        <div className="pt-2 border-t border-white/5">
                          <span className="text-[10px] uppercase font-bold text-discord-muted block mb-1">
                            Sobre Mim
                          </span>
                          <p className="text-xs text-discord-text whitespace-pre-wrap">
                            {bio || 'Nenhuma descrição adicionada.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KEEP-ALIVE TAB */}
          {activeTab === 'keepalive' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-400" />
                  Sistema Anti-Sleep do Render (24/7 Grátis)
                </h1>
                <p className="text-sm text-discord-muted mt-1">
                  O plano grátis do Render desliga a aplicação após 15 minutos sem visitas. Nosso sistema envia self-pings automáticos para garantir que o seu DvD fique acordado para você e seus 10 amigos jogarem a qualquer hora!
                </p>
              </div>

              {/* Status Box */}
              <div className="p-5 rounded-xl bg-discord-darkest border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-4 h-4 rounded-full ${
                        keepAliveStatus?.active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Status do Anti-Sleep: {keepAliveStatus?.active ? 'ATIVO & PROTEGIDO' : 'AGUARDANDO URL DO RENDER'}
                      </h3>
                      <p className="text-xs text-discord-muted">
                        Intervalo de auto-requisição: A cada 10 minutos
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleTestPing}
                    disabled={pingTesting}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pingTesting ? 'animate-spin' : ''}`} />
                    Testar Ping Agora
                  </button>
                </div>

                {pingResult && (
                  <div className="p-3 rounded-lg bg-black/40 text-xs text-discord-text border border-white/5 font-mono">
                    Resultado: {JSON.stringify(pingResult)}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5 text-xs">
                  <div className="p-2.5 rounded-lg bg-discord-dark">
                    <span className="text-discord-muted block">Total de Pings</span>
                    <span className="text-base font-bold text-white">
                      {keepAliveStatus?.totalPings || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-discord-dark">
                    <span className="text-discord-muted block">Pings Bem-Sucedidos</span>
                    <span className="text-base font-bold text-emerald-400">
                      {keepAliveStatus?.successfulPings || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-discord-dark">
                    <span className="text-discord-muted block">Tempo de Resposta</span>
                    <span className="text-base font-bold text-white">
                      {keepAliveStatus?.lastResponseTimeMs ? `${keepAliveStatus.lastResponseTimeMs}ms` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions Guide */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-950/40 to-discord-darkest border border-indigo-500/20 space-y-3">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Dica de Mestre para 100% de Uptime no Render:
                </h4>
                <p className="text-xs text-discord-text leading-relaxed">
                  Quando você fizer o deploy no <strong>Render.com</strong>, adicione a variável de ambiente:
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-black/40 text-amber-300">
                    APP_URL = https://sua-url.onrender.com
                  </code>
                  . O próprio servidor vai fazer ping em si mesmo a cada 10 minutos!
                </p>
                <p className="text-xs text-discord-text leading-relaxed">
                  Para redundância extra grátis, você também pode cadastrar a sua URL em serviços como <strong>cron-job.org</strong> ou <strong>UptimeRobot</strong> para chamar seu endpoint <code>/api/health</code> a cada 10 minutos sem nenhum custo!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
