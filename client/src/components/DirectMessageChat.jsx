import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  PlusCircle,
  Smile,
  Image,
  ArrowLeft,
  X,
  PhoneCall,
  Video
} from 'lucide-react';

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
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() && !attachmentUrl.trim()) return;

    const attachments = attachmentUrl.trim()
      ? [{ type: 'image', url: attachmentUrl.trim() }]
      : [];

    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setAttachmentUrl('');
    setShowAttachmentInput(false);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const statusColors = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  };

  return (
    <div className="flex-1 bg-discord-chat flex flex-col overflow-hidden relative select-none">
      {/* Header */}
      <div className="h-12 border-b border-discord-darkest/60 px-4 flex items-center justify-between bg-discord-chat flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={onBackToFriends}
            className="p-1 rounded hover:bg-white/10 text-discord-muted hover:text-white transition"
            title="Voltar para a lista de amigos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0">
            <img
              src={friend?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend?.username}`}
              alt=""
              className="w-7 h-7 rounded-full object-cover"
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
              className="p-2 rounded hover:bg-discord-green/20 hover:text-discord-green transition flex items-center gap-1.5 text-xs font-semibold"
              title="Iniciar Chamada de Voz"
            >
              <PhoneCall className="w-4 h-4" />
              <span className="hidden md:inline">Iniciar Chamada</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome Banner */}
        <div className="pt-4 pb-6 border-b border-white/5">
          <div className="relative w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-discord-blurple">
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
              className={`flex gap-3 hover:bg-black/10 -mx-4 px-4 py-1.5 rounded transition group ${
                isSameSenderAsPrev ? 'mt-0' : 'mt-2'
              }`}
            >
              {!isSameSenderAsPrev ? (
                <img
                  src={
                    isMe
                      ? currentUser?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=me'
                      : friend?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend?.username}`
                  }
                  alt=""
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
              ) : (
                <div className="w-10 flex-shrink-0 text-[10px] text-discord-muted opacity-0 group-hover:opacity-100 select-none text-right pr-2 pt-1">
                  {timeFormatted}
                </div>
              )}

              <div className="flex-1 min-w-0">
                {!isSameSenderAsPrev && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-white">
                      {isMe ? currentUser?.display_name || currentUser?.username : friend?.display_name || friend?.username}
                    </span>
                    <span className="text-[11px] text-discord-muted">{timeFormatted}</span>
                  </div>
                )}

                <div className="text-sm text-discord-text leading-relaxed break-words whitespace-pre-wrap">
                  {msg.content}
                </div>

                {msg.attachments &&
                  Array.isArray(msg.attachments) &&
                  msg.attachments.map((att, i) => (
                    <div key={i} className="mt-2 max-w-md rounded-lg overflow-hidden border border-white/5">
                      <img src={att.url} alt="" className="max-h-72 rounded-lg object-contain bg-black/20" />
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
        {showAttachmentInput && (
          <div className="mb-2 p-3 bg-discord-darkest rounded-lg border border-white/10 flex items-center gap-2">
            <Image className="w-4 h-4 text-discord-blurple flex-shrink-0" />
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="Cole a URL direta da imagem (ex: https://i.imgur.com/...)"
              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
            />
            <button onClick={() => setShowAttachmentInput(false)} className="text-discord-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-discord-darkest rounded-lg border border-white/10 flex flex-wrap gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setInputText((prev) => prev + emoji)}
                className="text-lg p-1.5 hover:bg-white/10 rounded transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="bg-discord-input rounded-lg flex items-center px-4 py-2.5 gap-3 shadow-inner">
          <button
            type="button"
            onClick={() => setShowAttachmentInput(!showAttachmentInput)}
            className="text-discord-muted hover:text-white transition flex-shrink-0"
            title="Adicionar imagem"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

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
            disabled={!inputText.trim() && !attachmentUrl.trim()}
            className="text-discord-blurple hover:text-discord-blurple-hover disabled:text-discord-muted/40 transition flex-shrink-0"
            title="Enviar"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
