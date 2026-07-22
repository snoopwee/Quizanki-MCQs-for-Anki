"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AVATAR_QUALITY,
  AVATAR_SIZE,
  containScale,
  cropToSourceRect,
  drawRegionToBlob,
} from "@/lib/image";

// The blank canvas the image floats on, and the fixed circular crop guide.
const STAGE_W = 320;
const STAGE_H = 264;
const CROP = 200;
const CROP_X = (STAGE_W - CROP) / 2;
const CROP_Y = (STAGE_H - CROP) / 2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export type AvatarCropperHandle = {
  /** Render the circle-framed square to a downscaled JPEG blob. */
  getBlob: () => Promise<Blob>;
};

// Free-positioning square cropper: the whole image floats on a blank stage and
// can be dragged ANYWHERE (even leaving empty space) and zoomed; a fixed circular
// guide marks what gets kept. Nothing is clamped — the user lands the photo where
// they want. Geometry lives in the pure helpers in lib/image.
export const AvatarCropper = forwardRef<AvatarCropperHandle, { file: File; onReady?: () => void }>(
  function AvatarCropper({ file, onReady }, ref) {
    // Create AND revoke the object URL in one effect (stored in state), so React
    // Strict Mode's double-mount can't revoke a URL that's still the <img> src —
    // the classic bug that left the cropper blank until you re-picked the file.
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    const stageRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<{ px: number; py: number } | null>(null);

    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const base = dims ? containScale(dims.w, dims.h, STAGE_W, STAGE_H) : 1;
    const scale = base * zoom;

    function onImgLoad() {
      const el = imgRef.current;
      if (!el) return;
      const w = el.naturalWidth;
      const h = el.naturalHeight;
      const s = containScale(w, h, STAGE_W, STAGE_H);
      setDims({ w, h });
      setZoom(1);
      // Center the whole image on the stage to start.
      setOffset({ x: (STAGE_W - w * s) / 2, y: (STAGE_H - h * s) / 2 });
      onReady?.();
    }

    // Zoom about the crop-circle centre so the framed subject stays put.
    function applyZoom(nextZoom: number) {
      if (!dims) return;
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const sOld = base * zoom;
      const sNew = base * z;
      const cx = CROP_X + CROP / 2;
      const cy = CROP_Y + CROP / 2;
      setOffset({
        x: cx - ((cx - offset.x) / sOld) * sNew,
        y: cy - ((cy - offset.y) / sOld) * sNew,
      });
      setZoom(z);
    }

    function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { px: e.clientX, py: e.clientY };
    }
    function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.px;
      const dy = e.clientY - dragRef.current.py;
      dragRef.current = { px: e.clientX, py: e.clientY };
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy })); // free — no clamping
    }
    function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }

    // Wheel-to-zoom needs a non-passive native listener to preventDefault the
    // page scroll. Re-bound on state change to capture the latest zoom/offset.
    useEffect(() => {
      const el = stageRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        applyZoom(zoom - e.deltaY * 0.0015);
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, offset, dims]);

    useImperativeHandle(
      ref,
      () => ({
        async getBlob() {
          if (!imgRef.current || !dims) throw new Error("Image isn't ready yet.");
          const rect = cropToSourceRect(CROP_X, CROP_Y, CROP, scale, offset.x, offset.y);
          return drawRegionToBlob(imgRef.current, dims.w, dims.h, rect, AVATAR_SIZE, AVATAR_QUALITY);
        },
      }),
      [scale, offset, dims],
    );

    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative max-w-full cursor-grab touch-none overflow-hidden rounded-card border border-line bg-white active:cursor-grabbing"
          style={{ width: STAGE_W, height: STAGE_H }}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL, cropped entirely client-side
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
              style={
                dims
                  ? {
                      width: dims.w * scale,
                      height: dims.h * scale,
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                    }
                  : { visibility: "hidden" }
              }
            />
          )}

          {/* Dim everything outside the crop circle (huge spread shadow, clipped
              by the stage's overflow-hidden). */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: CROP_X,
              top: CROP_Y,
              width: CROP,
              height: CROP,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            }}
          />

          {/* Crop ring + rule-of-thirds grid, clipped to the circle. */}
          <div
            aria-hidden
            className="pointer-events-none absolute overflow-hidden rounded-full ring-2 ring-white/80"
            style={{ left: CROP_X, top: CROP_Y, width: CROP, height: CROP }}
          >
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
          </div>
        </div>

        <div className="flex w-full max-w-xs items-center gap-3">
          <span aria-hidden className="text-xs font-semibold text-faint">
            −
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
          <span aria-hidden className="text-base font-semibold text-faint">
            +
          </span>
        </div>

        <p className="text-xs text-faint">Drag to move · scroll or use the slider to zoom</p>
      </div>
    );
  },
);
