import React, { useEffect, useRef } from 'react';

function PeerAudioItem({ peer, isDeafened }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
      audioRef.current.muted = isDeafened;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[WebRTC Audio] Autoplay aguardando interação do usuário para peer ${peer.user?.username}:`, err);
        });
      }
    }
  }, [peer.stream, isDeafened]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

export function RemoteAudioListener({ peers = {}, isDeafened = false }) {
  return (
    <div className="hidden" aria-hidden="true">
      {Object.entries(peers).map(([socketId, peer]) => (
        <PeerAudioItem
          key={socketId}
          peer={peer}
          isDeafened={isDeafened}
        />
      ))}
    </div>
  );
}
