import { useStore } from "../lib/store";
import { Button, Chip, Placeholder } from "../components/ui";
import { AD_STYLES } from "../lib/data";

export function AdStudio() {
  const { adStyle, setAdStyle, go } = useStore();

  return (
    <div className="screen ad-screen vup">
      <div className="product-row">
        <Placeholder label="product" className="product-thumb" />
        <div className="product-info">
          <div className="product-name">Aurora Serum 30ml</div>
          <div className="product-meta">1 image · background removed</div>
        </div>
        <button className="link-btn">Replace image</button>
      </div>

      <div className="section-label">Advert style</div>
      <div className="style-chip-row">
        {AD_STYLES.map((s) => (
          <Chip key={s} selected={adStyle === s} onClick={() => setAdStyle(s)}>{s}</Chip>
        ))}
      </div>

      <div className="card concept-card">
        <div className="concept-title">Concept · {adStyle}</div>
        <p className="concept-body">
          Open on the serum bottle catching golden-hour light against dark marble. A slow dolly
          reveals the product mark, closing on a single falling droplet for a premium, editorial feel.
        </p>
        <div className="concept-inset">
          <span className="section-label" style={{ margin: 0 }}>Voice-over</span>
          <p>"Some mornings deserve more than water. Aurora Serum — for the mornings that matter."</p>
        </div>
        <div className="concept-inset">
          <span className="section-label" style={{ margin: 0 }}>Caption</span>
          <p>"Aurora Serum. Now in stock."</p>
        </div>
      </div>

      <Button variant="primary" full onClick={() => go("storyboard")}>Approve → storyboard</Button>
    </div>
  );
}
