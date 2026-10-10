import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  PlusCircle,
  Smile,
  Image,
  ArrowLeft,
  X,
  PhoneCall,
  Video,
  Copy,
  Check,
  Download,
  Maximize2
} from 'lucide-react';
import { playMessageSound } from '../utils/audio';

const COMMON_EMOJIS = ['😀', '😂', '🔥', '🎮', '💀', '🚀', '❤️', '👀', '👍', '🤡', '⚡', '🎉', '🏆', '🍕', '😎'];

export function DirectMessageChat({
  friend,
  messages,
  onSendMessage,
  onBackToFriends,
  onStartVoiceCall,
  currentUser
}) {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMessagesCountRef = useRef(messages?.length || 0);

  // Auto scroll and sound on incoming message
  useEffect(() => {
    if (messages && messages.length > prevMessagesCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== currentUser?.id) {
        playMessageSound();
      }
    }
    prevMessagesCountRef.current = messages?.length || 0;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentUser?.id]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result);
      setAttachmentUrl('');
      setShowAttachmentInput(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = (e) => {
    e.preventDefault();
    const finalAttachment = imagePreview || attachmentUrl.trim();
    if (!inputText.trim() && !finalAttachment) return;

    const attachments = finalAttachment
      ? [{ type: 'image', url: finalAttachment }]
      : [];

    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setAttachmentUrl('');
    setImagePreview(null);
    setShowAttachmentInput(false);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleCopyMessage = (msgId, content) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  };

  const statusColors = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  };

  return (
    <div className="flex-1 bg-discord-chat flex flex-col overflow-hidden relative select-none">
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={lightboxImage}
              alt="Visualização ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={lightboxImage}
                target="_blank"
                rel="noreferrer"
                download="imagem-dm.png"
                className="px-4 py-2 rounded-lg bg-discord-blurple text-white font-semibold text-xs flex items-center gap-2 hover:bg-discord-blurple-hover transition"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" /> Abrir no Navegador
              </a>
              <button
                onClick={() => setLightboxImage(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition"
              >
                Fechar (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-12 border-b border-discord-darkest/60 px-4 flex items-center justify-between bg-discord-chat flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={onBackToFriends}
            className="p-1 rounded-lg hover:bg-white/10 text-discord-muted hover:text-white transition"
            title="Voltar para a lista de amigos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0">
            <img
              src={friend?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend?.username}`}
              alt=""
              className="w-7 h-7 rounded-full object-cover shadow"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-discord-chat ${
                statusColors[friend?.status_mode || 'offline']
              }`}
            />
          </div>

          <div className="truncate">
            <span className="font-bold text-white text-sm truncate">
              {friend?.display_name || friend?.username}
            </span>
            <span className="text-xs text-discord-muted ml-2 truncate hidden sm:inline">
              @{friend?.username}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 text-discord-muted">
          {onStartVoiceCall && (
            <button
              onClick={() => onStartVoiceCall(friend)}
              className="px-3 py-1.5 rounded-lg bg-discord-green/15 text-discord-green hover:bg-discord-green hover:text-black transition flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title="Iniciar Chamada de Voz com Amigo"
            >
              <PhoneCall className="w-4 h-4" />
              <span className="hidden sm:inline">Ligar</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome Banner */}
        <div className="pt-4 pb-6 border-b border-white/5">
          <div className="relative w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-discord-blurple shadow-lg">
            <img
              src={friend?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend?.username}`}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-black text-white">
            {friend?.display_name || friend?.username}
          </h1>
          <p className="text-xs text-discord-muted mt-1">
            Este é o começo do seu histórico de mensagens diretas com <strong>@{friend?.username}</strong>.
          </p>
        </div>

        {/* Messages List */}
        {messages.map((msg, index) => {
          const isMe = msg.sender_id === currentUser?.id;
          const isSameSenderAsPrev =
            index > 0 && messages[index - 1].sender_id === msg.sender_id;

          const date = new Date(msg.created_at || Date.now());
          const timeFormatted = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={msg.id || index}
              className={`relative flex gap-3 hover:bg-black/15 -mx-4 px-4 py-1.5 rounded-md transition group ${
                isSameSenderAsPrev ? 'mt-0' : 'mt-2'
              }`}
            >
              {/* Message floating actions on hover */}
              <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-discord-darkest border border-white/10 rounded-lg shadow-xl px-1.5 py-1 z-10 gap-1 animate-fade-in">
                <button
                  onClick={() => handleCopyMessage(msg.id || index, msg.content)}
                  className="p-1 text-discord-muted hover:text-white rounded hover:bg-white/10 transition"
                  title="Copiar texto"
                >
                  {copiedMsgId === (msg.id || index) ? (
                    <Check className="w-3.5 h-3.5 text-discord-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {COMMON_EMOJIS.slice(0, 4).map((em) => (
                  <button
                    key={em}
                    onClick={() => onSendMessage(em, [])}
                    className="p-0.5 hover:scale-125 transition text-xs"
                    title={`Reagir com ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>

              {!isSameSenderAsPrev ? (
                <img
                  src={
                    isMe
                      ? currentUser?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=me'
                      : friend?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend?.username}`
                  }
                  alt=""
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 shadow-sm"
                />
              ) : (
                <div className="w-10 flex-shrink-0 text-[10px] text-discord-muted opacity-0 group-hover:opacity-100 select-none text-right pr-2 pt-1 font-mono">
                  {timeFormatted}
                </div>
              )}

              <div className="flex-1 min-w-0">
                {!isSameSenderAsPrev && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-bold text-sm text-white">
                      {isMe ? currentUser?.display_name || currentUser?.username : friend?.display_name || friend?.username}
                    </span>
                    <span className="text-[11px] text-discord-muted">{timeFormatted}</span>
                  </div>
                )}

                <div className="text-sm text-discord-text leading-relaxed break-words whitespace-pre-wrap select-text">
                  {msg.content}
                </div>

                {msg.attachments &&
                  Array.isArray(msg.attachments) &&
                  msg.attachments.map((att, i) => (
                    <div
                      key={i}
                      className="mt-2 max-w-md rounded-xl overflow-hidden border border-white/10 relative group/img cursor-pointer"
                      onClick={() => setLightboxImage(att.url)}
                    >
                      <img
                        src={att.url}
                        alt="Anexo"
                        className="max-h-72 rounded-xl object-contain bg-black/30 hover:opacity-95 transition"
                      />
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md p-1.5 rounded-lg text-white opacity-0 group-hover/img:opacity-100 transition shadow">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Area */}
      <div className="px-4 pb-4">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />

        {showAttachmentInput && (
          <div className="mb-2 p-3 bg-discord-darkest rounded-xl border border-white/10 flex items-center gap-2 shadow-xl animate-fade-in">
            <Image className="w-4 h-4 text-discord-blurple flex-shrink-0" />
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="Cole a URL direta da imagem (ex: https://i.imgur.com/...)"
              className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder-discord-muted"
            />
            <button onClick={() => setShowAttachmentInput(false)} className="text-discord-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Local Image Preview Banner */}
        {imagePreview && (
          <div className="mb-2 p-2 bg-discord-darkest rounded-xl border border-discord-blurple/50 flex items-center gap-3 shadow-xl">
            <img
              src={imagePreview}
              alt="Pré-visualização"
              className="w-14 h-14 object-cover rounded-lg border border-white/10"
            />
            <div className="flex-1 text-xs text-discord-text truncate">
              <span className="font-semibold text-white block">Imagem Anexada</span>
              <span className="text-discord-muted">Pronta para enviar</span>
            </div>
            <button
              onClick={() => setImagePreview(null)}
              className="p-1 rounded-full bg-discord-red/80 hover:bg-discord-red text-white transition mr-1"
              title="Remover anexo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-discord-darkest rounded-xl border border-white/10 flex flex-wrap gap-1 shadow-2xl animate-fade-in">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setInputText((prev) => prev + emoji)}
                className="text-lg p-1.5 hover:bg-white/10 rounded-lg transition hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="bg-discord-input rounded-xl flex items-center px-4 py-2.5 gap-3 shadow-inner border border-transparent focus-within:border-discord-blurple/40 transition">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-discord-muted hover:text-white transition flex-shrink-0"
              title="Carregar imagem do computador"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowAttachmentInput(!showAttachmentInput)}
              className="text-discord-muted hover:text-white transition flex-shrink-0"
              title="Inserir imagem por link/URL"
            >
              <Image className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar com @${friend?.display_name || friend?.username}`}
            className="flex-1 bg-transparent text-sm text-white placeholder-discord-muted focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-discord-muted hover:text-discord-yellow transition flex-shrink-0"
            title="Emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() && !attachmentUrl.trim() && !imagePreview}
            className="text-discord-blurple hover:text-discord-blurple-hover disabled:text-discord-muted/30 transition flex-shrink-0 p-1 rounded hover:bg-discord-blurple/10"
            title="Enviar mensagem"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
