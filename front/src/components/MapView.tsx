"use client";

import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
// google.maps の型を有効化（値はグローバルにロードされるが、型はここで参照を読み込む）
// google.maps の型は tsconfig/include に追加した d.ts でグローバルに読み込みます
import type { PlaceListItem } from "@/lib/api";

type Props = {
  center: { lat: number; lng: number };
  places: PlaceListItem[];
};

/**
 * Google Maps の表示コンポーネント。
 * - 中心座標（center）を受け取り、地図をその座標に移動する
 * - places リストのうち、location.lat/lng があるものにピンを立てる
 * - ピンは MarkerClusterer でクラスタリングする
 * - 現在地用のマーカー（青色）を中央に表示する
 */
export default function MapView({ center, places }: Props) {
  // 地図を描画するDOM要素のref
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  // google.maps.Map のインスタンス保持
  const mapRef = useRef<google.maps.Map | null>(null);
  // 現在地マーカー
  const selfMarkerRef = useRef<google.maps.Marker | null>(null);
  // クラスタラー
  const clustererRef = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    // Google Maps APIを読み込んで地図を初期化
    // APIキーは NEXT_PUBLIC_GOOGLE_MAPS_API_KEY から読み込む
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      // APIキー未設定の場合は終了（画面には空の枠のみ）
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: [],
    });

    let cancelled = false;

    loader.load().then(() => {
      if (cancelled || !mapDivRef.current) return;

      // まだ地図がなければ作成、あれば中心のみ更新
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center,
          zoom: 14, // 町レベル程度
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      } else {
        mapRef.current.setCenter(center);
      }

      // 現在地マーカー（青色）を更新
      if (selfMarkerRef.current) {
        selfMarkerRef.current.setMap(null);
        selfMarkerRef.current = null;
      }
      selfMarkerRef.current = new google.maps.Marker({
        position: center,
        map: mapRef.current!,
        title: "現在地",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
          scale: 6,
        },
        zIndex: 1000,
      });

      // 既存のクラスタ/マーカーを破棄
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null as any);
        clustererRef.current = null;
      }

      // places からピンを生成（lat/lng があるもののみ）
      const markers: google.maps.Marker[] = [];
      for (const p of places) {
        const lat = p.location?.lat;
        const lng = p.location?.lng;
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        const m = new google.maps.Marker({
          position: { lat, lng },
          title: p.name,
        });
        markers.push(m);
      }

      // クラスタリングして地図に表示
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current!,
        markers,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, places]);

  return (
    <div ref={mapDivRef} className="h-[48vh] w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800" />
  );
}
