import { useStore } from "../lib/store";
import { Sheet } from "../components/Sheet";
import { Button } from "../components/ui";

export function CreditSheet() {
  const { sheet, closeSheet, confirmGenerate, credits } = useStore();
  const after = String(Number(credits.replace(/,/g, "")) - 48).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <Sheet open={sheet} onDismiss={closeSheet} title="Estimated 48 credits">
      <p className="sheet-sub">
        4 scenes × 6s at high quality. Balance {credits} → {after} after generation.
      </p>
      <div className="sheet-table">
        <div className="sheet-table-row">
          <span>Provider</span>
          <span>Available · primary</span>
        </div>
        <div className="sheet-table-row">
          <span>Queue</span>
          <span>~2 min</span>
        </div>
        <div className="sheet-table-row">
          <span>Failed scenes</span>
          <span className="accent-text">Not charged</span>
        </div>
      </div>
      <Button variant="primary" full onClick={confirmGenerate}>Confirm &amp; generate</Button>
      <Button variant="ghost" full onClick={closeSheet}>Cancel</Button>
    </Sheet>
  );
}
