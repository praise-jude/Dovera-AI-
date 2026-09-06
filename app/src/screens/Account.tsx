import { useEffect, useState } from "react";
import * as api from "../lib/api";
import type { Account as AccountInfo } from "../lib/api";
import { Button } from "../components/ui";

export function Account() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [claimEmail, setClaimEmail] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    api
      .ensureAuth()
      .then(() => api.getAccount())
      .then(setAccount)
      .catch(() => setError("Couldn't load your account."));
  }, []);

  const doClaim = async () => {
    setClaimError(null);
    if (claimPassword.length < 8) {
      setClaimError("Password must be at least 8 characters.");
      return;
    }
    setClaimBusy(true);
    try {
      const updated = await api.setCredentials(claimEmail, claimPassword);
      setAccount(updated);
      setClaimed(true);
    } catch (err) {
      setClaimError(err instanceof api.ApiError ? err.message : "Couldn't save your account. Please try again.");
    } finally {
      setClaimBusy(false);
    }
  };

  const doLogin = async () => {
    setLoginError(null);
    setLoginBusy(true);
    try {
      await api.login(loginEmail, loginPassword);
      window.location.reload();
    } catch (err) {
      setLoginBusy(false);
      setLoginError(err instanceof api.ApiError ? err.message : "Incorrect email or password.");
    }
  };

  const doLogout = () => {
    if (!window.confirm("Log out of this account on this device?")) return;
    api.logout();
    window.location.reload();
  };

  return (
    <div className="screen account-screen vup">
      <div className="real-badge" style={{ marginBottom: 14 }}>
        <span className="real-badge-dot" /> Real account, real login
      </div>

      {error && <p className="disclaimer-note" style={{ color: "var(--danger)" }}>{error}</p>}
      {!account && !error && <p className="disclaimer-note">Loading…</p>}

      {account && (
        <>
          {account.isDeviceAccount ? (
            <>
              <p className="disclaimer-note" style={{ margin: "0 2px 14px" }}>
                This device has a local account with no email or password of its own yet — your
                projects only exist here. Set a real email and password to log into the same
                account from another phone or computer.
              </p>

              <div className="section-label" style={{ marginTop: 0 }}>Email</div>
              <input
                className="text-input"
                type="email"
                placeholder="you@example.com"
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <div className="section-label" style={{ marginTop: 0 }}>Password</div>
              <input
                className="text-input"
                type="password"
                placeholder="At least 8 characters"
                value={claimPassword}
                onChange={(e) => setClaimPassword(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              {claimError && <p className="disclaimer-note" style={{ color: "var(--danger)" }}>{claimError}</p>}
              <Button variant="primary" full disabled={claimBusy || !claimEmail} onClick={doClaim}>
                {claimBusy ? "Saving…" : "Save my account"}
              </Button>
            </>
          ) : (
            <div className="card" style={{ marginBottom: 16 }}>
              {claimed && (
                <p className="disclaimer-note" style={{ color: "var(--accent)", margin: "0 0 8px" }}>
                  Saved — you can now log in with this email on any device.
                </p>
              )}
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Signed in as</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{account.email}</div>
            </div>
          )}

          <Button variant="ghost" full onClick={doLogout} style={{ marginTop: account.isDeviceAccount ? 8 : 0 }}>
            Log out of this device
          </Button>

          <div className="section-label">Log in to a different account</div>
          {!showLogin ? (
            <Button variant="secondary" full onClick={() => setShowLogin(true)}>
              Log in with email &amp; password
            </Button>
          ) : (
            <>
              <input
                className="text-input"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <input
                className="text-input"
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              {loginError && <p className="disclaimer-note" style={{ color: "var(--danger)" }}>{loginError}</p>}
              <Button variant="primary" full disabled={loginBusy || !loginEmail || !loginPassword} onClick={doLogin}>
                {loginBusy ? "Logging in…" : "Log in"}
              </Button>
              <p className="disclaimer-note" style={{ margin: "8px 2px 0" }}>
                This replaces the account currently active on this device.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
