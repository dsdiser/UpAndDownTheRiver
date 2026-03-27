import React from 'react';
import styles from './LoadingScreen.module.css';

const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading' }) => {
  return (
    <div className={styles.loadingScreen} role="status" aria-live="polite">
      <div className={styles.loadingEllipsis}>
        {message}
        <span className={styles.dot}>.</span>
        <span className={styles.dot}>.</span>
        <span className={styles.dot}>.</span>
      </div>
    </div>
  );
};

export default LoadingScreen;
