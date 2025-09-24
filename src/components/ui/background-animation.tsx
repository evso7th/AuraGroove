"use client";

import React from 'react';
import styles from './background-animation.module.css';

const BackgroundAnimation = () => {
  return (
    <div className={styles.view}>
      <div className={styles.plane}>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
      </div>
    </div>
  );
};

export default BackgroundAnimation;
