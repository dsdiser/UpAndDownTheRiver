import { useState } from 'react';
import styles from './DebugOverlay.module.css';
import { DiscordSDK } from '@discord/embedded-app-sdk';

export default function DebugOverlay(props: {
  status: string;
  authenticated: boolean;
  accessToken?: string | null;
  error?: Error | null;
  user: any;
  auth: any;
  websocketStatus: number; // WebSocket status code
  discordSdk?: DiscordSDK;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div aria-hidden={!open}>
      {!open && (
        <button
          className={styles.debugToggle}
          aria-expanded={open}
          aria-controls="debug-panel"
          onClick={() => setOpen((s) => !s)}
          title={open ? 'Hide debug' : 'Show debug'}
        >
          {open ? '\u00d7' : 'Debug'}
        </button>
      )}

      <aside
        id="debug-panel"
        className={`${styles.debugPanel} ${open ? styles.open : ''}`}
        role="region"
        aria-label="Debug information"
      >
        <div className={styles.debugPanelInner}>
          <div className={styles.headerRow}>
            <strong>Debug</strong>
            <button
              className={styles.debugClose}
              onClick={() => setOpen(false)}
              aria-label="Close debug panel"
            >
              Close
            </button>
          </div>
          <div>
            WebSocket Status:
            <strong>
              {props.websocketStatus === 0
                ? ' CONNECTING'
                : props.websocketStatus === 1
                ? ' OPEN'
                : props.websocketStatus === 2
                ? ' CLOSING'
                : props.websocketStatus === 3
                ? ' CLOSED'
                : ' UNKNOWN'}
            </strong>
          </div>
          <div>Hostname: {window.location.origin}</div>
          <div>
            Status: <strong>{props.status}</strong>
          </div>
          <div>
            Error: <strong>{props.error ? props.error.message : 'none'}</strong>
          </div>
          <div>
            Channel ID : <strong>{props.discordSdk?.channelId || 'none'}</strong>
          </div>
          <div className={styles.mt8}>
            <pre className={styles.debugPre}>
              {props.auth ? JSON.stringify(props.auth, null, 2) : 'noauth'}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}
