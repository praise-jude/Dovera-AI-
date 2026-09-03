import { useEffect, useState } from "react";
import * as api from "../lib/api";
import type { BillingStatus } from "../lib/api";
import { Button } from "../components/ui";

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function Billing() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      await api.ensureAuth();
      setStatus(await api.getBillingStatus());
    } catch {
      setError("Couldn't load your billing status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (reference) {
      // Came back from a Paystack checkout redirect — confirm it server-side
      // (never trust the redirect itself) before showing a result.
      window.history.replaceState({}, "", window.location.pathname);
      api
        .ensureAuth()
        .then(() => api.verifyPayment(reference))
        .then((r) => {
          setVerifyNote(
            r.status === "success"
              ? "Payment confirmed — you're on Premium."
              : `Payment ${r.status}. If you completed checkout, this can take a moment — try refreshing.`
          );
        })
        .catch(() => setVerifyNote("Couldn't confirm that payment. If you were charged, contact support."))
        .finally(load);
    } else {
      load();
    }
  }, []);

  const doSubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.ensureAuth();
      const { authorizationUrl } = await api.subscribe();
      window.location.href = authorizationUrl;
    } catch (err) {
      setBusy(false);
      setError(err instanceof api.ApiError ? err.message : "Couldn't start checkout. Please try again.");
    }
  };

  const doCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.cancelSubscription();
      await load();
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Couldn't cancel. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen billing-screen vup">
      <div className="real-badge" style={{ marginBottom: 10 }}>
        <span className="real-badge-dot" /> Real payments via Paystack
      </div>

      {loading ? (
        <p className="disclaimer-note">Loading…</p>
      ) : !status ? (
        <p className="disclaimer-note" style={{ color: "var(--danger)" }}>{error}</p>
      ) : (
        <>
          {verifyNote && <p className="disclaimer-note" style={{ margin: "0 2px 16px" }}>{verifyNote}</p>}

          <div className="card billing-status-card">
            <div className="billing-plan-name">{status.plan === "PREMIUM" ? "Premium" : "Free"}</div>
            <div className="billing-plan-meta">
              {status.subscriptionStatus === "ACTIVE" && status.planRenewsAt
                ? `Renews ${formatDate(status.planRenewsAt)}`
                : status.subscriptionStatus === "PAST_DUE"
                  ? "Last payment failed — update your card to keep Premium"
                  : status.subscriptionStatus === "CANCELLED"
                    ? "Subscription cancelled"
                    : "No active subscription"}
            </div>
          </div>

          {status.plan !== "PREMIUM" || status.subscriptionStatus !== "ACTIVE" ? (
            <>
              <div className="card billing-offer-card">
                <div className="billing-offer-title">VIDORA Premium</div>
                <div className="billing-offer-price">
                  {formatNaira(status.amountKobo)} <span className="billing-offer-interval">/ month</span>
                </div>
              </div>
              <Button variant="primary" full disabled={busy} onClick={doSubscribe}>
                {busy ? "Redirecting to Paystack…" : `Subscribe — ${formatNaira(status.amountKobo)}/month`}
              </Button>
              <p className="disclaimer-note" style={{ margin: "10px 2px 0" }}>
                You'll be taken to Paystack's secure checkout. VIDORA never sees or stores your card details.
              </p>
            </>
          ) : (
            <Button variant="secondary" full disabled={busy} onClick={doCancel}>
              {busy ? "Cancelling…" : "Cancel subscription"}
            </Button>
          )}

          {error && <p className="disclaimer-note" style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
        </>
      )}
    </div>
  );
}
