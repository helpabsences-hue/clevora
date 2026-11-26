import type { MetadataRoute } from "next";

/** Installable app ("Ajouter à l'écran d'accueil"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parcolia",
    short_name: "Parcolia",
    description: "Votre agence de location, simplement.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F8FAFC",
    theme_color: "#054570",
    lang: "fr",
    dir: "auto",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nouvelle réservation", url: "/reservations/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Aujourd'hui", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
