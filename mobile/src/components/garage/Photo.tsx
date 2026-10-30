import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { privateImageSource } from "../../core/config/api";
import { PHOTO_ICON, PHOTOS, PhotoKey } from "../../theme/photos";
import { gShape, useGarageTheme } from "../../theme/garage";
import { CATALOG_GROUPS, findCategory } from "../../core/constants/categories";
import { GIcon, GIconName } from "./text";

/**
 * A UI photo from the one map in theme/photos.ts (cover, rounded, never mirrored). Until the file exists:
 * a tint block with one centred rounded icon and no text.
 */
export function Photo({ k, style, radius = gShape.card, icon }: { k: PhotoKey; style?: StyleProp<ViewStyle>; radius?: number; icon?: GIconName }) {
  const { g } = useGarageTheme();
  const src = PHOTOS[k];
  const ck = k.startsWith("category.") ? k.slice(9) : null;
  const cat = ck ? (findCategory(ck) ?? CATALOG_GROUPS.find((x) => x.key === ck) ?? null) : null;
  const glyph = (icon ?? PHOTO_ICON[k] ?? cat?.icon ?? "image-outline") as GIconName;
  return (
    <View accessible={false} style={[{ borderRadius: radius, overflow: "hidden", backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }, style]}>
      {src ? (
        <Image source={src} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: g.card, alignItems: "center", justifyContent: "center", opacity: 0.92 }}>
          <GIcon name={glyph} size={26} color={g.accentText} />
        </View>
      )}
    </View>
  );
}

/**
 * A login-gated server image (shop storefront): fetched with the bearer token, cover, rounded. Falls back to the `fallback`
 * placeholder key while loading, when there is none, or when it fails.
 */
export function PrivatePhoto({ uri, fallback, style, radius = gShape.card }: { uri: string | null | undefined; fallback: PhotoKey; style?: StyleProp<ViewStyle>; radius?: number }) {
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    if (uri) privateImageSource(uri).then((s) => alive && setSrc(s), () => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uri]);
  if (!src || failed) return <Photo k={fallback} style={style} radius={radius} icon="storefront-outline" />;
  return (
    <View accessible={false} style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <Image source={src} contentFit="cover" style={{ width: "100%", height: "100%" }} onError={() => setFailed(true)} />
    </View>
  );
}
