import React, { useEffect, useState, useMemo } from 'react';
import styles from './AvatarOverlay.module.css';
import { Avatar } from '../avatar/Avatar';
import { DiscordSDK, Events } from '@discord/embedded-app-sdk';

type UserLike = {
  id: string;
  avatar?: string;
};
type VoiceUserEvent = {
  user_id: string;
  channel_id?: string | undefined;
  lobby_id?: string | undefined;
};

interface AvatarOverlayProps {
  users: UserLike[];
  accessToken?: string | null;
  discordSdk?: DiscordSDK;
}

const MAX_VISIBLE_AVATARS_DESKTOP = 15;
const MAX_VISIBLE_AVATARS_TABLET = 10;
const MAX_VISIBLE_AVATARS_MOBILE = 6;

// Custom hook to track screen size
const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // Default to desktop
  });
  useEffect(() => {
    const handleResize = () => {
      setScreenSize(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return screenSize;
};

//  Renders a fixed footer across the bottom of the screen with evenly spaced avatars.
export const AvatarOverlay: React.FC<AvatarOverlayProps> = ({ users, accessToken, discordSdk }) => {
  const screenWidth = useScreenSize();

  // Determine max avatars based on screen size
  const maxVisibleAvatars = useMemo(() => {
    if (screenWidth <= 480) return MAX_VISIBLE_AVATARS_MOBILE;
    if (screenWidth <= 768) return MAX_VISIBLE_AVATARS_TABLET;
    return MAX_VISIBLE_AVATARS_DESKTOP;
  }, [screenWidth]);

  const visible = useMemo(() => users.slice(0, maxVisibleAvatars), [users, maxVisibleAvatars]);
  const guildId = discordSdk?.guildId ?? undefined;

  // State to track which users are actively speaking
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!discordSdk) return;

    const removeActiveSpeaker = (event: VoiceUserEvent) => {
      setSpeakingUsers((prevSpeaking) => {
        const newSpeaking = new Set(prevSpeaking);
        newSpeaking.delete(event.user_id);
        return newSpeaking;
      });
    };
    const addActiveSpeaker = (event: VoiceUserEvent) => {
      setSpeakingUsers((prevSpeaking) => {
        const newSpeaking = new Set(prevSpeaking);
        newSpeaking.add(event.user_id);
        return newSpeaking;
      });
    };

    discordSdk.subscribe(Events.SPEAKING_START, addActiveSpeaker, {
      channel_id: discordSdk.channelId,
    });
    discordSdk.subscribe(Events.SPEAKING_STOP, removeActiveSpeaker, {
      channel_id: discordSdk.channelId,
    });
    return () => {
      discordSdk.unsubscribe(Events.SPEAKING_START, addActiveSpeaker, {
        channel_id: discordSdk.channelId,
      });
      discordSdk.unsubscribe(Events.SPEAKING_STOP, removeActiveSpeaker, {
        channel_id: discordSdk.channelId,
      });
    };
  }, [discordSdk]);

  if (!visible || visible.length === 0) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {visible.map((u) => (
          <Avatar
            key={u.id}
            guildId={guildId}
            accessToken={accessToken}
            avatar={u.avatar}
            userId={u.id}
            isSpeaking={speakingUsers.has(u.id)}
          />
        ))}
      </div>
    </footer>
  );
};

export default AvatarOverlay;
