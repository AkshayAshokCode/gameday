import type { MetadataRoute } from "next";

// Web app manifest — makes "Add to Home Screen" install GameDay like an app:
// our icon, the night background behind the splash, no browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameDay",
    short_name: "GameDay",
    description: "The weekly game, minus the group-chat chaos.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e0b",
    theme_color: "#0a0e0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
