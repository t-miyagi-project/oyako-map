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
  // 選択中の施設ID（リストクリックやピンクリックで更新される）
  selectedId?: string | null;
  // ピンがクリックされたときに親へ通知する
  onSelect?: (id: string) => void;
  // 親から高さ(px)を指定する場合に使用（未指定時は既定の高さを使用）
  heightPx?: number;
  // ビューポート変更時の通知（中心・推定半径m）。ドラッグ/ズーム後の idle で呼ばれる。
  onViewportChanged?: (v: { center: { lat: number; lng: number }; radius_m: number }) => void;
};

/**
 * Google Maps の表示コンポーネント。
 * - 中心座標（center）を受け取り、地図をその座標に移動する
 * - places リストのうち、location.lat/lng があるものにピンを立てる
 * - ピンは MarkerClusterer でクラスタリングする
 * - 現在地用のマーカー（青色）を中央に表示する
 */
export default function MapView({ center, places, selectedId, onSelect, heightPx, onViewportChanged }: Props) {
  // 地図を描画するDOM要素のref
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  // google.maps.Map のインスタンス保持
  const mapRef = useRef<google.maps.Map | null>(null);
  // 現在地マーカー
  const selfMarkerRef = useRef<google.maps.Marker | null>(null);
  // クラスタラー
  const clustererRef = useRef<MarkerClusterer | null>(null);
  // 現在地の周囲を目立たせるための円（m単位のサークル）
  const selfCircleRef = useRef<google.maps.Circle | null>(null);
  // 施設ID→マーカーの対応表
  const markersByIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  // 選択中のマーカーID（前回値の保持）
  const selectedIdRef = useRef<string | null>(null);
  // ピンの情報を表示する InfoWindow
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  // 施設ID→Placeデータ（InfoWindow表示用に参照）
  const placeByIdRef = useRef<Map<string, PlaceListItem>>(new Map());
  // ピンのアイコンは Google Maps の既定（変更しない）
  // 初回 idle の実行済みフラグ（初期化直後の idle 通知をスキップしたい場合に使用）
  const initializedRef = useRef(false);

  // 簡易の距離計算（ハーサイン）。m単位を返す。
  const haversineMeters = (a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000; // 地球半径[m]
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const sin1 = Math.sin(dLat / 2);
    const sin2 = Math.sin(dLng / 2);
    const h = sin1 * sin1 + Math.cos(la1) * Math.cos(la2) * sin2 * sin2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

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

      // 現在地マーカー（視認性を高めたカスタムSVGアイコン）を更新
      if (selfMarkerRef.current) {
        selfMarkerRef.current.setMap(null);
        selfMarkerRef.current = null;
      }
      if (selfCircleRef.current) {
        selfCircleRef.current.setMap(null);
        selfCircleRef.current = null;
      }
      // 目立つ同心円（レッド系の外周 + 白縁付きレッドの内円 + 白点）で現在地を表現
      // - data: URL のSVGとして埋め込み、中央にアンカーする
      // - さらにサイズを大きく（40px）し、外周のハローも拡大
      const currentSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'>
          <circle cx='20' cy='20' r='15' fill='rgba(239,68,68,0.32)'/>
          <circle cx='20' cy='20' r='11' fill='#ef4444' stroke='white' stroke-width='4'/>
          <circle cx='20' cy='20' r='4' fill='white'/>
        </svg>
      `;
      const currentIcon: google.maps.Icon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(currentSvg),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20), // 中央にアンカー
      };
      selfMarkerRef.current = new google.maps.Marker({
        position: center,
        map: mapRef.current!,
        title: "現在地",
        icon: currentIcon,
        zIndex: 1000,
        // 軽いアテンションのためにDROPアニメーションを1回だけ付与
        animation: google.maps.Animation.DROP,
      });

      // 現在地をさらに目立たせるため、半径100m程度の淡い円を重ねる（色もレッド系に統一）
      // - ズームに応じて地図上の見た目サイズは変わるが、位置の把握に有効
      selfCircleRef.current = new google.maps.Circle({
        map: mapRef.current!,
        center,
        radius: 100, // 100m（必要に応じて調整）
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        strokeColor: '#ef4444',
        strokeOpacity: 0,
      });

      // 既存のクラスタ/マーカーを破棄
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null);
        clustererRef.current = null;
      }
      // 既存マップ上のピン参照もクリア
      markersByIdRef.current.forEach((m) => m.setMap(null));
      markersByIdRef.current.clear();
      placeByIdRef.current.clear();

      // ピンのアイコンは既定を使用するため初期化処理は不要

      // places からピンを生成（lat/lng があるもののみ）
      const markers: google.maps.Marker[] = [];
      for (const p of places) {
        const lat = p.location?.lat;
        const lng = p.location?.lng;
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        // マーカー生成（Google Maps の既定アイコンを使用）
        const m = new google.maps.Marker({
          position: { lat, lng },
          title: p.name,
        });
        // クリック時は InfoWindow を開き、選択IDを親へ通知
        m.addListener("click", () => {
          // 名前と距離の簡易表示
          const km = (p.location.distance_m / 1000).toFixed(2);
          if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();
          infoWindowRef.current.setContent(`<div style="font-size:12px;line-height:1.4"><strong>${p.name}</strong><div>${km} km</div><div style=\"margin-top:4px\"><a href=\"/places/${p.id}\" style=\"color:#2563eb;text-decoration:underline\">詳細</a></div></div>`);
          infoWindowRef.current.open({ map: mapRef.current!, anchor: m });
          // 選択を親へ通知
          onSelect?.(p.id);
        });
        markers.push(m);
        markersByIdRef.current.set(p.id, m);
        placeByIdRef.current.set(p.id, p);
      }

      // クラスタリングして地図に表示
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current!,
        markers,
      });

      // ビューポート変更（idle）時に中心と半径を親へ通知
      mapRef.current.addListener("idle", () => {
        if (!mapRef.current) return;
        const c = mapRef.current.getCenter();
        const b = mapRef.current.getBounds();
        if (!c || !b) return;
        const centerLiteral = { lat: c.lat(), lng: c.lng() };
        // 半径は中心からビューポート四隅までの最大距離を採用（概算）。
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const nw = new google.maps.LatLng(ne.lat(), sw.lng());
        const se = new google.maps.LatLng(sw.lat(), ne.lng());
        const corners: google.maps.LatLngLiteral[] = [
          { lat: ne.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: sw.lng() },
          { lat: nw.lat(), lng: nw.lng() },
          { lat: se.lat(), lng: se.lng() },
        ];
        const radius = Math.max(
          ...corners.map((pt) => haversineMeters(centerLiteral, { lat: pt.lat, lng: pt.lng }))
        );
        // 初期化直後の idle はスキップし、以降のユーザー操作（ドラッグ/ズーム）で通知
        if (!initializedRef.current) {
          initializedRef.current = true;
          return;
        }
        onViewportChanged?.({ center: centerLiteral, radius_m: Math.round(radius) });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, places]);

  // 選択IDの変化に応じて、該当ピンを強調表示し、地図をpan
  useEffect(() => {
    const sid = selectedId ?? null;
    if (!mapRef.current) return;
    // 前回選択を元に戻す
    const prev = selectedIdRef.current;
    if (prev && markersByIdRef.current.has(prev)) {
      const prevMarker = markersByIdRef.current.get(prev)!;
      prevMarker.setZIndex(undefined as unknown as number);
      // 前回のバウンスを停止
      prevMarker.setAnimation(null);
    }
    // 新たな選択を強調
    if (sid && markersByIdRef.current.has(sid)) {
      const mk = markersByIdRef.current.get(sid)!;
      mk.setZIndex(999);
      const pos = mk.getPosition();
      if (pos) {
        mapRef.current.panTo(pos);
      }
      // バウンス（短時間）を付与
      mk.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => mk.setAnimation(null), 1400);
      // リストクリックでも InfoWindow を開く
      const pl = placeByIdRef.current.get(sid);
      if (pl) {
        const km = (pl.location.distance_m / 1000).toFixed(2);
        if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();
        infoWindowRef.current.setContent(`<div style=\"font-size:12px;line-height:1.4\"><strong>${pl.name}</strong><div>${km} km</div><div style=\"margin-top:4px\"><a href=\"/places/${pl.id}\" style=\"color:#2563eb;text-decoration:underline\">詳細</a></div></div>`);
        infoWindowRef.current.open({ map: mapRef.current!, anchor: mk });
      }
    } else {
      // 選択が解除された場合は InfoWindow を閉じる
      infoWindowRef.current?.close();
    }
    selectedIdRef.current = sid;
  }, [selectedId, places]);

  return (
    <div
      ref={mapDivRef}
      className="w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
      style={heightPx ? { height: `${heightPx}px` } : { height: "48vh" }}
    />
  );
}
