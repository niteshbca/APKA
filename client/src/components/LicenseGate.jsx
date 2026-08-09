import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { checkLicense, getDeviceId, saveLicense, saveValidationState, embeddedPublicKey } from '../utils/license';
import { LICENSE_STATES } from '../utils/license';
import { Spinner } from './ui';
import LicenseActivation from '../pages/LicenseActivation';
import LicenseExpired from '../pages/LicenseExpired';

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
    setLicense(result.license);
    setState(result.state);
    setChecking(false);

    // Periodic online re-validation (anti-bypass: catches server-side suspension).
    if (result.state === LICENSE_STATES.VALID && navigator.onLine) {
      try {
        const deviceId = await getDeviceId();
        const res = await api.post('/license/validate', { licenseId: result.license.payload.licenseId, deviceId });
        if (res.data?.success) {
          const d = res.data.data;
          if (d.license && d.signature) {
            const payload = d.license;
            await saveLicense({ payload, signature: d.signature, boundDeviceId: deviceId, publicKey: embeddedPublicKey() });
            await saveValidationState({ valid: true, serverTime: d.serverTime });
          }
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
