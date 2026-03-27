import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import appStyles from './components/App.module.css';
import { DiscordContextProvider, useDiscordSdk } from './hooks/useDiscordSdk';
import { Provider as JotaiProvider, useAtomValue, useSetAtom } from 'jotai';
import useWebsocket from './hooks/useWebsocket';
import DebugOverlay from './components/debug-overlay/DebugOverlay';
import Coin, { CoinResult } from './components/coin/Coin';
import BalatroBackground from './components/balatro-background/BalatroBackground';
import { setRandomSeedAtom, seedAtom, seedStore } from './state/coinAtoms';
import { userAtom, roomMembersAtom } from './state/userAtoms';
import { AvatarOverlay } from './components/avatar-overlay/AvatarOverlay';
import { MessageType } from './state/websocketAtoms';
import LoadingScreen from './components/loading-screen/LoadingScreen';
import RoomInput from './components/room-input/RoomInput';

const inIframe = window.self !== window.top;

const App: React.FC = () => {
  const shouldAuth = inIframe; // Only authenticate if in an iframe (i.e. in Discord)

  return (
    <>
      <BalatroBackground />
      <DiscordContextProvider authenticateWithDiscord={shouldAuth}>
        <CoinFlipApp />
      </DiscordContextProvider>
    </>
  );
};

const CoinFlipApp: React.FC = () => {
  const { discordSdk, status, authenticated, accessToken, auth, error, instanceId } =
    useDiscordSdk();
  const user = useAtomValue(userAtom);
  const roomMembers = useAtomValue(roomMembersAtom);
  const seed = useAtomValue(seedAtom);
  const setRandomSeed = useSetAtom(setRandomSeedAtom);
  const { send, connectionStatus } = useWebsocket(instanceId);

  function onFlipResult(_result: CoinResult) {
    setRandomSeed();
    seedStore.set(seedAtom, seed);
  }

  const handleFlipSend = () => {
    if (!user) return;
    send({
      type: MessageType.FlipStart,
      seed: seed,
    });
  };

  const debugOverlay = !inIframe && (
    <DebugOverlay
      status={status}
      authenticated={authenticated}
      accessToken={accessToken}
      error={error}
      user={user}
      auth={auth}
      websocketStatus={connectionStatus}
      discordSdk={discordSdk}
    />
  );

  if (!user) {
    return (
      <>
        {debugOverlay}
        <div>
          <div>Failed to authenticate with Discord, try relaunching the activity!</div>
          <div> Debug info: {error ? error.message : 'Unknown error'}</div>
        </div>
      </>
    );
  }

  if ([0, 3].includes(connectionStatus)) {
    return (
      <>
        {debugOverlay}
        <LoadingScreen message="Connecting to room" />
      </>
    );
  }

  return (
    <>
      <AvatarOverlay
        users={roomMembers.map((m) => ({ id: m.id, avatar: m.avatar }))}
        accessToken={accessToken}
        discordSdk={discordSdk}
      />
      <RoomInput initialRoomId={instanceId} />
      <div className={appStyles.app}>
        <div className={appStyles.player}>
          <div className={appStyles.coinArea}>
            <Coin onFlip={handleFlipSend} onComplete={onFlipResult} />
          </div>
        </div>
      </div>
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <JotaiProvider>
      <App />
    </JotaiProvider>
  </React.StrictMode>
);
