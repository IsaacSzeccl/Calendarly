import { ImageResponse } from "next/og";
import { BRAND, logoMarkSvg } from "@/components/Logo";

export const alt = "Calendarly: find a time that works for the whole group";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture shown when a poll link is shared in a chat: the mark, the name and one line. */
export default function OpengraphImage() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(logoMarkSvg(BRAND))}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND.paper,
          color: BRAND.ink,
          padding: "72px 80px",
          borderLeft: `28px solid ${BRAND.ribbon}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={src} width={84} height={84} alt="" />
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>Calendarly</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Find a time that works for the whole group.
          </div>
          <div style={{ fontSize: 34, color: BRAND.pencil }}>Answer from a link. No account needed.</div>
        </div>
      </div>
    ),
    size,
  );
}
