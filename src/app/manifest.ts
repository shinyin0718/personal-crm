import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "People — personal CRM",
    short_name: "People",
    description: "Remember the people you meet.",
    start_url: "/people",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Scan a card", url: "/scan" }],
  };
}
