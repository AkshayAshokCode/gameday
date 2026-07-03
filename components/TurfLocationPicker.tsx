"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icon paths break under Next.js's bundler — point
// them at the CDN instead of relying on local asset resolution.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]; // India, roughly centered

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

export default function TurfLocationPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(
      lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER,
      lat != null && lng != null ? 15 : 5
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (lat != null && lng != null) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        markerRef.current = L.marker([clickLat, clickLng]).addTo(map);
      }
      onChange(clickLat, clickLng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced live suggestions as you type — Nominatim's /search endpoint
  // returns multiple ranked matches, not just one.
  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(search)}`
        );
        const results: Suggestion[] = await res.json();
        setSuggestions(results);
        setShowSuggestions(true);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  function selectSuggestion(s: Suggestion) {
    const foundLat = parseFloat(s.lat);
    const foundLng = parseFloat(s.lon);
    setSearch(s.display_name);
    setShowSuggestions(false);
    if (mapRef.current) {
      mapRef.current.setView([foundLat, foundLng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([foundLat, foundLng]);
      } else {
        markerRef.current = L.marker([foundLat, foundLng]).addTo(mapRef.current);
      }
    }
    onChange(foundLat, foundLng);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          placeholder="Search an address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className="block w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-chalk placeholder:text-chalk-dim/50 focus:border-floodlight focus:outline-none"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-chalk-dim">…</span>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-[1000] mt-1 w-full max-h-56 overflow-auto rounded-lg border border-line bg-turf-raised shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                  className="block w-full px-3 py-2 text-left text-sm text-chalk hover:bg-night"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div ref={containerRef} className="h-48 w-full rounded-lg border border-line" />
      <p className="text-xs text-chalk-dim">Tap the map to drop a pin, or pick a search suggestion above.</p>
    </div>
  );
}
