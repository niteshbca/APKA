import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { checkLicense, getDeviceId, saveLicense, saveValidationState, savePublicKey, embeddedPublicKey } from '../utils/license';
import { LICENSE_STATES } from '../utils/license';
import { Spinner } from './ui';
import LicenseActivation from '../pages/LicenseActivation';
import LicenseExpired from '../pages/LicenseExpired';

/**
 * Fetch the vendor's current signing public key from the server and cache it
 * locally. Combined with multi-key verification this makes the client immune
 * to signing-key rotations (old embedded key still works offline).
 */
async function cacheServerPublicKey() {
  try {
    const res = await api.get('/license/public-key');
    const pem = res.data?.data?.publicKey;
    if (pem) await savePublicKey(pem);
  } catch {
    /* offline or endpoint unavailable - embedded key still used */
  }
}

/**
 * Blocks billing and all protected UI until a valid, signed license is present.
 * Verification happens locally (works offline) with an RSA signature check.
 * When online, the license is periodically re-validated and the server clock
 * offset is stored to detect system-clock tampering.
 */
export default function LicenseGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [state, setState] = useState(LICENSE_STATES.LOADING);
  const [license, setLicense] = useState(null);

  const verify = useCallback(async () => {
    const result = await checkLicense();
    let state = result.state;
    let lic = result.license;

    // Self-heal: if the locally-stored license fails signature verification
    // (e.g. the vendor rotated the signing key), silently re-activate online
    // using the stored License ID so the user is not locked out.
    if (
      (state === LICENSE_STATES.INVALID_SIGNATURE || state === LICENSE_STATES.CORRUPTED) &&
      navigator.onLine &&
      result.license?.payload?.licenseId
    ) {
      try {
        const deviceId = await getDeviceId();
        const r = await api.post('/license/activate', {
          licenseId: result.license.payload.licenseId,
          deviceId,
          deviceName: 'POS Terminal',
          platform: navigator.userAgent,
        });
        const d = r.data?.data;
        if (d?.license && d?.signature) {
          await saveLicense({ payload: d.license, signature: d.signature, boundDeviceId: d.deviceId || deviceId, publicKey: null });
          await saveValidationState({ valid: true, serverTime: d.serverTime });
          await cacheServerPublicKey();
          const again = await checkLicense();
          state = again.state;
          lic = again.license;
        }
      } catch {
        /* keep the original invalid state and show the manual re-activation screen */
      }
    }

    setLicense(lic);
    setState(state);
    setChecking(false);

    // Periodic online re-validation (anti-bypass: catches server-side suspension).
    if (state === LICENSE_STATES.VALID && navigator.onLine) {
      try {
        const deviceId = await getDeviceId();
        const res = await api.post('/license/validate', { licenseId: lic.payload.licenseId, deviceId });
        if (res.data?.success) {
          const d = res.data.data;
          if (d.license && d.signature) {
            const payload = d.license;
            await saveLicense({ payload, signature: d.signature, boundDeviceId: deviceId, publicKey: embeddedPublicKey() });
            await saveValidationState({ valid: true, serverTime: d.serverTime });
          }
          await cacheServerPublicKey();
          await saveValidationState({ valid: true, serverTime: d.serverTime });
        } else {
          await saveValidationState({ valid: false, reason: 'ONLINE_REJECTED' });
        }
      } catch (err) {
        if (err.code === 'LICENSE_EXPIRED' || err.code === 'LICENSE_SUSPENDED') {
          await saveValidationState({ valid: false, reason: err.code });
          const r2 = await checkLicense();
          setLicense(r2.license);
          setState(r2.state);
        }
      }
    }
  }, []);

  useEffect(() => {
    verify();
    const iv = setInterval(verify, 10 * 60 * 1000);
    const onlineHandler = () => verify();
    window.addEventListener('online', onlineHandler);
    return () => {
      clearInterval(iv);
      window.removeEventListener('online', onlineHandler);
    };
  }, [verify]);

  if (checking) {
    return (
      <div className="license-screen">
        <Spinner label="Checking license..." />
      </div>
    );
  }

  if (state === LICENSE_STATES.VALID) {
    return <>{children}</>;
  }

  if (state === LICENSE_STATES.NOT_ACTIVATED) {
    return <LicenseActivation onActivated={() => { setChecking(true); verify(); }} />;
  }

  return (
    <LicenseExpired
      state={state}
      license={license}
      onRenewed={() => { setChecking(true); verify(); }}
    />
  );
}
