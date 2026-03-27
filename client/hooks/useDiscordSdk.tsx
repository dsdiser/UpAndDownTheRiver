import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import LoadingScreen from '../components/loading-screen/LoadingScreen';
import { OAuthScopes } from '@discord/embedded-app-sdk/output/schema/types';
import type { Auth, User } from '../types/user';
import { useSetAtom } from 'jotai';
import { userAtom } from '../state/userAtoms';
import { hc } from 'hono/client';
import { appType } from '../../worker/main';
import { getProxiedUrl } from '../utils/url-proxy';

export enum Status {
  Idle = 'idle',
  Ready = 'ready',
  Authenticating = 'authenticating',
  Authenticated = 'authenticated',
  Error = 'error',
}

const generateInstanceId = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const generateUserId = () => (Math.floor(Math.random() * 9000) + 1000).toString();

export const setInstanceIdInUrl = (instanceId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('room', instanceId);
  window.history.replaceState({}, '', url.toString());
};

// get room id from url params
const getRoomIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  let roomParam = urlParams.get('room');
  // room id should be alphanumeric only and max 4 chars
  if (roomParam && (!/^[a-zA-Z0-9]+$/.test(roomParam) || roomParam.length > 4)) {
    roomParam = '';
  }
  return roomParam || '';
};

const getRoomInstance = () => {
  let roomId = getRoomIdFromUrl();
  if (!roomId) {
    roomId = generateInstanceId();
    setInstanceIdInUrl(roomId);
  }
  return roomId;
};

interface DiscordContextValue {
  discordSdk?: DiscordSDK;
  accessToken?: string | null;
  authenticated: boolean;
  auth?: Auth;
  status: Status;
  error?: Error | null;
  instanceId: string;
}

const MOCK_USER: User = {
  id: generateUserId(),
  username: 'Unauthed User',
  discriminator: '0001',
  public_flags: 0,
};

const DiscordContext = createContext<DiscordContextValue | undefined>(undefined);
const scope = ['identify', 'guilds', 'guilds.members.read', 'rpc.voice.read'];

interface ProviderProps {
  children: ReactNode;
  authenticateWithDiscord: boolean; // Whether to perform auth to discord on mount. If not create mock user
  scope?: OAuthScopes[];
  loadingScreen?: ReactNode;
}

export const DiscordContextProvider: React.FC<ProviderProps> = ({
  children,
  authenticateWithDiscord = false,
  loadingScreen = <LoadingScreen />,
}) => {
  const clientId = (import.meta as any).env?.VITE_DISCORD_CLIENT_ID;
  const sdkRef = useRef<DiscordSDK | undefined>(undefined);
  const [status, setStatus] = useState<Status>(Status.Authenticating);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const setUser = useSetAtom(userAtom);
  const [auth, setAuth] = useState<any | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Ensure global user is set to a mock when we're not authenticating with Discord
  useEffect(() => {
    if (!authenticateWithDiscord) {
      setUser(MOCK_USER);
      setAuthenticated(true);
      setStatus(Status.Authenticated);
      setAuth({ user: MOCK_USER });
    }
    // only run when `authenticateWithDiscord` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticateWithDiscord]);

  if (!sdkRef.current && clientId && status != Status.Error && authenticateWithDiscord) {
    try {
      sdkRef.current = new DiscordSDK(clientId);
    } catch (err) {
      console.error('Failed to initialize Discord SDK', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus(Status.Error);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!sdkRef.current) {
        return;
      }

      try {
        setStatus(Status.Idle);
        await sdkRef.current.ready();
        if (!mounted) return;
        setStatus(Status.Ready);

        if (!authenticateWithDiscord) return;

        setStatus(Status.Authenticating);

        // Request an authorization code from the Discord client
        const { code } = await sdkRef.current.commands.authorize({
          client_id: clientId,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope,
        });

        // Exchange the code for an access token at our server endpoint
        const res = await hc<appType>(getProxiedUrl(window.location.origin))
          .api.token.$post({
            json: { code },
          })
          .catch((err) => {
            throw new Error(
              `Token exchange request failed: ${err instanceof Error ? err.message : String(err)}`
            );
          });
        const body = await res.json();
        if (body.error) {
          throw new Error(
            `Token exchange failed: ${body.error} STATUS:${res.status} ${res.statusText} ${res.url}`
          );
        }
        const token = body.access_token;
        if (!mounted) return;
        setAccessToken(token);

        // Authenticate the SDK with the returned access token so commands can be called
        const auth = await sdkRef.current.commands.authenticate({
          access_token: token,
        });
        if (!mounted) return;

        setAuthenticated(true);
        setStatus(Status.Authenticated);
        setUser(auth.user);
        setAuth(auth);
      } catch (err: any) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus(Status.Error);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [authenticateWithDiscord, scope]);

  const value: DiscordContextValue = {
    discordSdk: sdkRef.current,
    accessToken,
    authenticated,
    auth,
    status,
    error,
    instanceId: sdkRef.current?.instanceId || getRoomInstance(),
  };

  if (status === Status.Authenticating && loadingScreen) {
    return <>{loadingScreen}</>;
  }

  return <DiscordContext.Provider value={value}>{children}</DiscordContext.Provider>;
};

export function useDiscordSdk(): DiscordContextValue {
  const ctx = useContext(DiscordContext);
  if (!ctx) {
    const MOCK_DISCORD_CONTEXT_VALUE: DiscordContextValue = {
      discordSdk: undefined,
      accessToken: null,
      authenticated: false,
      auth: undefined,
      status: Status.Error,
      error: new Error('Discord SDK not initialized'),
      instanceId: getRoomInstance(),
    };
    return MOCK_DISCORD_CONTEXT_VALUE;
  }

  return ctx;
}

export default useDiscordSdk;
