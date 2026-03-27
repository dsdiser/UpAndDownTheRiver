import React, { useCallback, useEffect } from 'react';
import { motion, Transition, useAnimation } from 'motion/react';
import styles from './Avatar.module.css';
import { useAtomValue } from 'jotai';
import {
  flipAnimationDuration,
  startFlipAtom,
  activeFlipperUserIdAtom,
} from '../../state/coinAtoms';

interface AvatarProps {
  guildId?: string; // Discord Guild ID to fetch guild-specific avatarS
  accessToken?: string | null; // Discord OAuth2 access token
  avatar?: string | null; // User's avatar hash from Discord
  userId: string; // User's Discord or randomized ID
  isSpeaking?: boolean; // Whether the user is currently speaking
}

const transition: Transition = {
  type: 'spring',
  duration: flipAnimationDuration,
  bounce: 0.95,
};

/**
 * Avatar component to display user's avatar image.
 */
export const Avatar: React.FC<AvatarProps> = ({
  guildId,
  accessToken,
  avatar,
  userId,
  isSpeaking = false,
}) => {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const startFlip = useAtomValue(startFlipAtom);
  const activeFlipperUserId = useAtomValue(activeFlipperUserIdAtom);
  const controls = useAnimation();

  useEffect(() => {
    if (startFlip && activeFlipperUserId === userId) {
      controls.start({ translateY: [10, 0], transition: transition });
    }
  }, [startFlip, activeFlipperUserId, controls]);

  const setDefaultAvatar = useCallback(() => {
    let avatarSrc = '';
    if (avatar) {
      avatarSrc = `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=256`;
    } else {
      const defaultAvatarIndex = BigInt(userId) % 6n;
      avatarSrc = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png?size=256`;
    }
    setAvatarUrl(avatarSrc);
  }, [userId, avatar]);

  useEffect(() => {
    if (!accessToken) {
      setDefaultAvatar();
      return;
    }

    fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((guildsMembersRead) => {
        if (guildsMembersRead?.avatar) {
          const avatarSrc = `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${guildsMembersRead.avatar}.png?size=256`;
          setAvatarUrl(avatarSrc);
        } else {
          setDefaultAvatar();
        }
      })
      .catch((_error) => {
        // fallback to default avatars
        setDefaultAvatar();
      });
  }, [guildId, accessToken, avatar, userId]);

  if (!avatarUrl) {
    return null;
  }

  return (
    <motion.div
      className={`${styles.avatar} ${isSpeaking ? styles.speaking : ''}`}
      animate={controls}
    >
      <img
        src={avatarUrl}
        width="64"
        height="64"
        alt="User Avatar"
        draggable={false}
        className={styles.img}
      />
    </motion.div>
  );
};
