import { useStore } from "../lib/store";
import { Spinner, ProgressBar, Button } from "../components/ui";

function statusFor(prog: number): string {
  if (prog < 27) return "Scene 1 of 4 · queued";
  if (prog < 54) return "Scene 2 of 4 · rendering";
  if (prog < 81) return "Scene 3 of 4 · rerouted to backup";
  return "Assembling final cut";
}

export function Generating() {
  const { prog, realJobId, realPending, realStatusMessage, realError, clearRealError, go } = useStore();
  const isReal = Boolean(realJobId) || Boolean(realError) || realPending;

  if (realError) {
    return (
      <div className="screen generating-screen vup">
        <div className="generating-center">
          <div className="generating-error-icon">!</div>
          <h2 className="generating-title">Generation failed</h2>
          <p className="generating-sub">{realError}</p>
          <p className="generating-sub" style={{ marginTop: 4 }}>
            Your project is safe and nothing was charged.
          </p>
        </div>
        <Button
          variant="primary"
          full
          onClick={() => {
            clearRealError();
            go("slideshow");
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="screen generating-screen vup">
      <div className="generating-center">
        <Spinner size={80} />
        <h2 className="generating-title">{isReal ? "Rendering your video" : "Generating 4 scenes"}</h2>
        <p className="generating-sub">
          Runs on our servers — you can close the app. We'll notify you when it's done.
        </p>
        <ProgressBar value={prog} />
        <div className="mono generating-status">{isReal ? realStatusMessage ?? "Working…" : statusFor(prog)}</div>
      </div>

      {!isReal && (
        <div className="card generating-footer-card">
          <p>
            Held: 48 credits · charged only on delivered scenes. Scene 3 was rerouted to a backup
            provider by Smart Router.
          </p>
        </div>
      )}
    </div>
  );
}
