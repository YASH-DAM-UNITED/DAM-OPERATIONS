import React, { useEffect, useState } from 'react';
import './InstallAppPrompt.css';

const DISMISS_KEY = 'dam:pwa-install-dismissed-until:v1';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
}
function platform() {
  const ua = navigator.userAgent || '';
  const appleMobile = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (appleMobile) return 'ios';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
function safari() {
  const ua = navigator.userAgent || '';
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(ua);
}
function storageGet() {
  try { return Number(localStorage.getItem(DISMISS_KEY) || 0); } catch { return 0; }
}
function storageSet() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* private mode */ }
}

export default function InstallAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const [kind] = useState(platform);
  const [isSafari] = useState(safari);

  useEffect(() => {
    if (isInstalled()) return;
    const onInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      if (Date.now() >= storageGet()) setVisible(true);
    };
    const onInstalled = () => { setVisible(false); setInstallEvent(null); };
    const onModeChange = () => { if (isInstalled()) setVisible(false); };
    const mode = window.matchMedia('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    mode.addEventListener?.('change', onModeChange);
    // Safari has no beforeinstallprompt: show our own install invitation.
    const timer = window.setTimeout(() => {
      if (!isInstalled() && Date.now() >= storageGet()) setVisible(true);
    }, 1800);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mode.removeEventListener?.('change', onModeChange);
    };
  }, []);

  const dismiss = () => { storageSet(); setVisible(false); setInstructions(false); };
  const install = async () => {
    if (installEvent) {
      try {
        await installEvent.prompt();
        const result = await installEvent.userChoice;
        setInstallEvent(null);
        if (result?.outcome === 'accepted') { setVisible(false); return; }
      } catch { /* show manual installation steps instead */ }
    }
    setInstructions(true);
  };
  if (!visible) return null;

  let steps;
  if (kind === 'ios') steps = isSafari
    ? ['Tap the Share button in Safari.', 'Choose “Add to Home Screen” (or “Open as Web App”).', 'Tap “Add” to place DAM OPERATIONS on your Home Screen.']
    : ['Open this website in Safari.', 'Tap Share, then “Add to Home Screen”.', 'Tap “Add” to install DAM OPERATIONS.'];
  else if (kind === 'mac' && isSafari) steps = ['In Safari, open the File menu.', 'Select “Add to Dock…” (macOS Sonoma or later).', 'Confirm “Add” to launch DAM OPERATIONS from the Dock.'];
  else if (kind === 'android') steps = ['Open the browser menu (⋮).', 'Choose “Install app” or “Add to Home screen”.', 'Confirm the installation.'];
  else steps = ['Look for the install icon at the right of the browser address bar.', 'Alternatively open the browser menu and choose “Install DAM OPERATIONS”.', 'Confirm the browser installation dialog.'];

  return (
    <section className="dam-install-card" role="dialog" aria-label="Install DAM OPERATIONS" aria-modal="false">
      <button type="button" className="dam-install-close" aria-label="Dismiss install invitation" onClick={dismiss}>×</button>
      <div className="dam-install-head">
        <img className="dam-install-logo" src="/icons/icon-192.png" alt="" />
        <div><div className="dam-install-eyebrow">YOUR WORKSPACE, ONE TAP AWAY</div><h2>Install DAM OPERATIONS</h2></div>
      </div>
      <p className="dam-install-description">Get faster access with a dedicated app experience, right from your {kind === 'mac' ? 'Dock' : kind === 'ios' || kind === 'android' ? 'Home Screen' : 'desktop'}.</p>
      {instructions && (
        <div className="dam-install-instructions" aria-live="polite">
          <strong>How to install</strong>
          <ol>{steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
          <span>Installation is controlled by your browser; this page cannot install itself automatically.</span>
        </div>
      )}
      <div className="dam-install-actions">
        <button type="button" className="dam-install-later" onClick={dismiss}>Not now</button>
        <button type="button" className="dam-install-primary" onClick={install}>{instructions ? 'Show steps again' : '↓ Install App'}</button>
      </div>
    </section>
  );
}
