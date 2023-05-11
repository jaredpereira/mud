import { NextApiRequest, NextApiResponse } from "next";

export default function SpacePWAManifest(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.json({
    name: "Mud",
    short_name: "Mud",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    theme_color: "#fffaf0",
    background_color: "#fffaf0",
    display: "standalone",
    orientation: "portrait",
    start_url: "/s/" + req.query.space,
  });
}
