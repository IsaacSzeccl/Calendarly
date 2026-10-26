import { ImageResponse } from "next/og";
import { BRAND, logoMarkSvg } from "@/components/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the mark on a paper square. */
export default function AppleIcon() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(logoMarkSvg(BRAND))}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f2ede2" }}>
        <img src={src} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
