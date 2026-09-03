import { useStore } from "../lib/store";
import { Button, Chip } from "../components/ui";
import { ANSWER_CHIPS, SCENES } from "../lib/data";

export function Director() {
  const { chat, answerPicked, pickAnswer, go } = useStore();

  return (
    <div className="screen director-screen vup">
      <div className="chat-col">
        <div className="bubble bubble-user">
          Advertise my new skincare serum with a luxury, golden-hour feel.
        </div>

        <div className="bubble-row">
          <div className="avatar-v">V</div>
          <div className="bubble bubble-director">
            Love it. To build a plan I need a few details — pick what fits, or type your own.
          </div>
        </div>

        <div className="answer-chips">
          {ANSWER_CHIPS.map((c) => (
            <Chip key={c} selected={answerPicked === c} onClick={() => pickAnswer(c)}>
              {c}
            </Chip>
          ))}
        </div>

        {chat === 2 && (
          <>
            <div className="bubble-row vup">
              <div className="avatar-v">V</div>
              <div className="bubble bubble-director">
                Got it — I'm assuming a marble studio set, golden-hour lighting, and a slow,
                elegant camera style. You can change any of this once you're in the storyboard.
              </div>
            </div>

            <div className="plan-card vup">
              <div className="plan-card-header">
                <span>4 scenes · 24s · luxury · 9:16</span>
                <span className="mono plan-badge">DRAFT</span>
              </div>
              <div className="plan-rows">
                {SCENES.map((s) => (
                  <div key={s.id} className="plan-row">
                    <span className="mono plan-row-num">{String(s.id).padStart(2, "0")}</span>
                    <div className="plan-row-body">
                      <div className="plan-row-name">{s.name}</div>
                      <div className="plan-row-desc">{s.desc}</div>
                    </div>
                    <button className="plan-row-edit" onClick={() => go("scene")}>edit</button>
                  </div>
                ))}
              </div>
              <div className="plan-card-footer">
                <Button variant="secondary" onClick={() => pickAnswer(answerPicked || "")}>Revise</Button>
                <Button variant="primary" onClick={() => go("storyboard")}>Open storyboard</Button>
              </div>
            </div>

            <p className="disclaimer-note">
              Nothing is charged yet. Credits are only estimated once you generate from the storyboard.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
