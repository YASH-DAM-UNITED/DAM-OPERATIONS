import React, { useEffect, useState } from 'react';
import './InstallAppPrompt.css';

const DISMISS_KEY = 'dam:pwa-install-dismissed-until:v2';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const installed = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const readDismiss = () => { try { return Number(localStorage.getItem(DISMISS_KEY) || 0); } catch { return 0; } };
const snooze = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS)); } catch {} };
function detect() {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/i.test(ua) && !/CriOS|Chrome|Chromium|Edg|OPR|FxiOS|Firefox/i.test(ua);
  return { kind: ios ? 'ios' : /Android/i.test(ua) ? 'android' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : 'desktop', safari };
}

export default function InstallAppPrompt() {
  const [device] = useState(detect);
  const [visible, setVisible] = useState(false);
  const [guide, setGuide] = useState(false);
  const [step, setStep] = useState(0);
  const [deferred, setDeferred] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const iosSafari = device.kind === 'ios' && device.safari;
  const macSafari = device.kind === 'mac' && device.safari;
  const iosOther = device.kind === 'ios' && !device.safari;

  useEffect(() => {
    if (installed()) return;
    const onPrompt = e => { e.preventDefault(); setDeferred(e); if (Date.now() >= readDismiss()) setVisible(true); };
    const onInstalled = () => { setVisible(false); setGuide(false); setDeferred(null); };
    const onVisibility = () => { if (installed()) onInstalled(); };
    const media = window.matchMedia('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('pageshow', onVisibility);
    media.addEventListener?.('change', onVisibility);
    const timer = window.setTimeout(() => { if (!installed() && Date.now() >= readDismiss()) setVisible(true); }, 1600);
    return () => { window.clearTimeout(timer); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); window.removeEventListener('pageshow', onVisibility); media.removeEventListener?.('change', onVisibility); };
  }, []);

  const close = () => { snooze(); setVisible(false); setGuide(false); };
  const beginGuide = () => { setGuide(true); setStep(0); setShowHelp(false); };
  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        setDeferred(null);
        if (choice?.outcome === 'accepted') { setVisible(false); return; }
      } catch { setDeferred(null); }
    }
    beginGuide();
  };
  if (!visible || installed()) return null;

  const steps = iosSafari ? [
    { title: 'Open the Safari page menu', detail: 'Tap the Share icon (square with an up arrow). On newer Safari layouts, tap the page menu button first if Share is inside it.', glyph: '↥' },
    { title: 'Choose Add to Home Screen', detail: 'Scroll through the share options and tap “Add to Home Screen”. If hidden, scroll to the bottom and check “Edit Actions”.', glyph: '⊞' },
    { title: 'Confirm the app', detail: 'Keep the name “DAM OPERATIONS”, enable “Open as Web App” if offered, then tap “Add”.', glyph: '✓' }
  ] : macSafari ? [
    { title: 'Open Safari’s File menu', detail: 'In the macOS menu bar at the very top, select File.', glyph: '☰' },
    { title: 'Select Add to Dock', detail: 'Choose “Add to Dock…” (available on macOS Sonoma 14 or later).', glyph: '＋' },
    { title: 'Confirm Add', detail: 'Confirm the name and click Add. Find DAM OPERATIONS in your Dock or Applications.', glyph: '✓' }
  ] : iosOther ? [
    { title: 'Open DAM OPERATIONS in Safari', detail: 'Copy the current page address, open Safari and paste it into the address bar.', glyph: '↗' },
    { title: 'Open Safari’s Share menu', detail: 'Tap the Share button in Safari.', glyph: '↥' },
    { title: 'Add to Home Screen', detail: 'Choose “Add to Home Screen”, then confirm Add.', glyph: '✓' }
  ] : device.kind === 'android' ? [
    { title: 'Open browser menu', detail: 'Tap the three-dot menu in Chrome.', glyph: '⋮' },
    { title: 'Install app', detail: 'Choose “Install app” or “Add to Home screen”.', glyph: '⊞' },
    { title: 'Confirm', detail: 'Confirm installation when prompted.', glyph: '✓' }
  ] : [
    { title: 'Open your browser menu', detail: 'Look for the install icon in the address bar or open the browser menu.', glyph: '⋯' },
    { title: 'Install DAM OPERATIONS', detail: 'Select “Install app” or “Apps → Install this site as an app” if available.', glyph: '⊞' },
    { title: 'Confirm', detail: 'Approve the installation prompt.', glyph: '✓' }
  ];

  return <aside className="dam-install-card" role="dialog" aria-modal="false" aria-label="Install DAM OPERATIONS">
    <button className="dam-install-close" type="button" onClick={close} aria-label="Close install invitation">×</button>
    <div className="dam-install-head"><img src="/icons/icon-192.png" alt="" className="dam-install-logo" /><div><div className="dam-install-eyebrow">YOUR WORKSPACE, ONE TAP AWAY</div><h2>Install DAM OPERATIONS</h2></div></div>
    {!guide ? <>
      <p className="dam-install-description">Launch your branch workspace directly from your {device.kind === 'mac' ? 'Dock' : device.kind === 'desktop' ? 'desktop' : 'Home Screen'}.</p>
      <div className="dam-install-actions"><button type="button" className="dam-install-later" onClick={close}>Not now</button><button type="button" className="dam-install-primary" onClick={install}>Install App <span aria-hidden="true">↗</span></button></div>
    </> : <>
      <div className="dam-install-progress" aria-label={`Installation step ${step + 1} of ${steps.length}`}>{steps.map((_, i) => <span key={i} className={i <= step ? 'active' : ''} />)}</div>
      <div className="dam-install-step" aria-live="polite"><div className="dam-install-step-symbol" aria-hidden="true">{steps[step].glyph}</div><div><div className="dam-install-step-count">STEP {step + 1} OF {steps.length}</div><h3>{steps[step].title}</h3><p>{steps[step].detail}</p></div></div>
      {iosSafari && step === 0 && <div className="dam-install-hint"><span aria-hidden="true">↥</span> Look for Safari’s Share button in its toolbar. The button position depends on your Safari version.</div>}
      {iosSafari && step === 1 && <div className="dam-install-hint"><span aria-hidden="true">⊞</span> “Add to Home Screen” is an Apple menu item, not a button inside this website.</div>}
      <div className="dam-install-actions"><button type="button" className="dam-install-later" onClick={() => step ? setStep(step - 1) : setGuide(false)}>{step ? 'Back' : 'Back'}</button><button type="button" className="dam-install-primary" onClick={() => step < steps.length - 1 ? setStep(step + 1) : close()}>{step < steps.length - 1 ? 'Next step →' : 'Done'}</button></div>
      <button type="button" className="dam-install-help" onClick={() => setShowHelp(v => !v)} aria-expanded={showHelp}>Why can’t this install automatically? {showHelp ? '−' : '+'}</button>
      {showHelp && <p className="dam-install-help-text">Apple Safari does not allow websites to press its Share button or Add to Home Screen option. These steps guide you through Apple’s own installation controls.</p>}
    </>}
  </aside>;
}
