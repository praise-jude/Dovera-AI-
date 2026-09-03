import { useStore } from "../lib/store";
import { Spinner, ProgressBar } from "../components/ui";

function statusFor(prog: number): string {
  if (prog < 27) return "Scene 1 of 4 · queued";
  if (prog < 54) return "Scene 2 of 4 · rendering";
  if (prog < 81) return "Scene 3 of 4 · rerouted to backup";
  return "Assembling final cut";
}

export function Generating() {
  const { prog } = useStore();

  return (
    <div className="screen generating-screen vup">
      <div className="generating-center">
        <Spinner size={80} />
        <h2 className="generating-title">Generating 4 scenes</h2>
        <p className="generating-sub">
          Runs on our servers — you can close the app. We'll notify you when it's done.
        </p>
        <ProgressBar value={prog} />
        <div className="mono generating-status">{statusFor(prog)}</div>
      </div>

      <div className="card generating-footer-card">
        <p>
          Held: 48 credits · charged only on delivered scenes. Scene 3 was rerouted to a backup
          provider by Smart Router.
        </p>
      </div>
    </div>
  );
}
