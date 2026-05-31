import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { OptionGroup } from "./OptionGroup";
import { deriveVideoModeUI, MAX_REF2V_DURATION_UI } from "../lib/imageModels";
import {
  clearReferenceLibrary as apiClearReferenceLibrary,
  deleteReferenceLibraryItem,
  listReferenceLibrary,
  uploadReferenceLibraryImage,
  useReferenceLibraryItem,
  type ReferenceLibraryItem,
} from "../lib/api";
import type { VideoResolutionUI } from "../types";

const RES_ITEMS = [
  { value: "480p" as const, label: "480p" },
  { value: "720p" as const, label: "720p" },
];

const ASPECT_ITEMS = ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"].map((value) => ({
  value,
  label: value,
}));

const DURATIONS = [3, 5, 8, 10, 12, 15];

export function VideoControlsPanel() {
  const { t } = useI18n();
  const refCount = useAppStore((s) => s.activeVideoRefCount());
  const duration = useAppStore((s) => s.videoDuration);
  const setDuration = useAppStore((s) => s.setVideoDuration);
  const resolution = useAppStore((s) => s.videoResolution);
  const setResolution = useAppStore((s) => s.setVideoResolution);
  const aspect = useAppStore((s) => s.videoAspectRatio);
  const setAspect = useAppStore((s) => s.setVideoAspectRatio);
  const addReferenceDataUrl = useAppStore((s) => s.addReferenceDataUrl);
  const showToast = useAppStore((s) => s.showToast);

  const [items, setItems] = useState<ReferenceLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxDuration = refCount >= 2 ? MAX_REF2V_DURATION_UI : 15;
  const mode = deriveVideoModeUI(refCount);

  const refreshLibrary = async () => {
    setLoading(true);
    try {
      const data = await listReferenceLibrary();
      setItems(data.items ?? []);
    } catch (error) {
      console.warn("[ReferenceLibrary] load failed", error);
      showToast("참조 이미지 보관함을 불러오지 못했습니다.", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshLibrary();
  }, []);

  const addLibraryItemAsReference = async (item: ReferenceLibraryItem) => {
    try {
      const result = await useReferenceLibraryItem(item.id);
      addReferenceDataUrl(result.base64);
      showToast("참조 이미지로 추가했습니다.");
    } catch (error) {
      console.warn("[ReferenceLibrary] use failed", error);
      showToast("참조 이미지 추가에 실패했습니다.", true);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteReferenceLibraryItem(id);
      await refreshLibrary();
    } catch (error) {
      console.warn("[ReferenceLibrary] delete failed", error);
      showToast("보관함 이미지 삭제에 실패했습니다.", true);
    }
  };

  const clearLibrary = async () => {
    try {
      await apiClearReferenceLibrary();
      await refreshLibrary();
    } catch (error) {
      console.warn("[ReferenceLibrary] clear failed", error);
      showToast("보관함 전체 삭제에 실패했습니다.", true);
    }
  };

  const uploadLibraryImage = async (file: File, autoUse: boolean) => {
    setUploading(true);
    try {
      const result = await uploadReferenceLibraryImage(file);
      await refreshLibrary();
      if (autoUse) {
        addReferenceDataUrl(result.base64);
      }
      showToast(autoUse ? "보관함에 저장하고 참조로 추가했습니다." : "보관함에 저장했습니다.");
    } catch (error) {
      console.warn("[ReferenceLibrary] upload failed", error);
      showToast("보관함 업로드에 실패했습니다.", true);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadOption = async (autoUse: boolean) => {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await uploadLibraryImage(file, autoUse);
  };

  return (
    <div className="right-panel-settings video-controls">
      <div className="option-group">
        <div className="section-title">{t("video.durationTitle")}</div>
        <div className="option-row">
          {DURATIONS.filter((item) => item <= maxDuration).map((item) => (
            <button
              key={item}
              type="button"
              className={`option-btn${duration === item ? " active" : ""}`}
              onClick={() => setDuration(item)}
            >
              {item}s
            </button>
          ))}
        </div>
        {mode === "reference-to-video" && (
          <p className="option-help" style={{ color: "var(--amber, #f59e0b)", marginTop: "6px", fontSize: "11px" }}>
            레퍼런스 영상 생성은 최대 10초까지 지원됩니다.
          </p>
        )}
      </div>

      <OptionGroup<VideoResolutionUI>
        title={t("video.resolutionTitle")}
        items={RES_ITEMS}
        value={resolution}
        onChange={setResolution}
      />

      <OptionGroup<string>
        title={t("video.aspectTitle")}
        items={ASPECT_ITEMS}
        value={aspect}
        onChange={setAspect}
      />

      <div className="reference-library-section" style={{ marginTop: "20px", borderTop: "1px solid var(--border, #333)", paddingTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <strong style={{ fontSize: "12px" }}>참조 이미지 보관함 {items.length} / 100</strong>
          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(99, 102, 241, 0.15)", color: "#6366f1", fontWeight: "bold" }}>
            최근 사용순
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", marginTop: "12px", flexWrap: "nowrap" }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setPendingFile(file);
            }}
            accept="image/*"
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="action-btn"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: "bold",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid var(--accent, #6366f1)",
              color: "var(--accent, #6366f1)",
              borderRadius: "6px",
              cursor: "pointer",
              minHeight: "40px",
            }}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "저장 중..." : "보관함에 이미지 업로드"}
          </button>

          <button
            type="button"
            className="action-btn action-btn--danger"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: "bold",
              background: items.length > 0 ? "rgba(255, 77, 79, 0.1)" : "rgba(255, 77, 79, 0.03)",
              border: items.length > 0 ? "1px solid #ff4d4f" : "1px solid rgba(255, 77, 79, 0.15)",
              color: items.length > 0 ? "#ff4d4f" : "rgba(255, 77, 79, 0.4)",
              borderRadius: "6px",
              cursor: items.length > 0 ? "pointer" : "not-allowed",
              minHeight: "40px",
            }}
            disabled={items.length === 0}
            onClick={() => setShowClearConfirm(true)}
          >
            전체 삭제
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "20px 0", fontSize: "12px", color: "var(--fg-muted, #888)" }}>
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", fontSize: "12px", color: "var(--fg-muted, #888)", border: "1px dashed var(--border, #333)", borderRadius: "6px" }}>
            보관함이 비어 있습니다.
          </div>
        ) : (
          <div className="ref-lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", maxHeight: "480px", overflowY: "auto", paddingRight: "4px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="ref-lib-item"
                style={{ position: "relative", width: "100%", height: 0, paddingBottom: "100%", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border, #333)", cursor: "pointer", background: "#000" }}
                onClick={() => void addLibraryItemAsReference(item)}
                title="클릭하여 참조 이미지로 사용"
              >
                <img
                  src={item.url}
                  alt={item.originalName}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  loading="lazy"
                />
                <button
                  type="button"
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.7)",
                    color: "#ff4d4f",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteItem(item.id);
                  }}
                  title="보관함에서 삭제"
                >
                  ×
                </button>
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.5)",
                    color: "#fff",
                    fontSize: "9px",
                    padding: "2px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  사용
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingFile && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px",
        }}>
          <div style={{
            background: "var(--bg-card, #1c1c1e)",
            border: "1px solid var(--border, #333)",
            borderRadius: "12px",
            padding: "20px",
            maxWidth: "360px",
            width: "100%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}>
            <strong style={{ fontSize: "14px", display: "block", marginBottom: "8px", color: "var(--fg, #fff)" }}>
              보관함 이미지 저장 옵션
            </strong>
            <p style={{ fontSize: "12px", color: "var(--fg-muted, #aaa)", marginBottom: "20px", lineHeight: "1.4" }}>
              선택한 이미지를 보관함에 추가합니다.<br />어떻게 저장하시겠습니까?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button type="button" className="action-btn" onClick={() => void handleUploadOption(false)}>
                보관함에만 저장
              </button>
              <button type="button" className="action-btn action-btn--primary" onClick={() => void handleUploadOption(true)}>
                저장하고 현재 참조로 사용
              </button>
              <button type="button" style={{ padding: "10px", fontSize: "11px", borderRadius: "8px", background: "transparent", color: "#ff4d4f", border: "none", cursor: "pointer" }} onClick={() => setPendingFile(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px",
        }}>
          <div style={{
            background: "var(--bg-card, #1c1c1e)",
            border: "1px solid var(--border, #333)",
            borderRadius: "12px",
            padding: "20px",
            maxWidth: "360px",
            width: "100%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}>
            <strong style={{ fontSize: "14px", display: "block", marginBottom: "8px", color: "#ff4d4f" }}>
              참조 이미지 보관함 전체 삭제
            </strong>
            <p style={{ fontSize: "12px", color: "var(--fg-muted, #aaa)", marginBottom: "20px", lineHeight: "1.4" }}>
              보관함에 저장된 모든 참조 이미지를 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button type="button" className="action-btn" onClick={() => setShowClearConfirm(false)}>
                취소
              </button>
              <button
                type="button"
                className="action-btn action-btn--danger"
                onClick={async () => {
                  setShowClearConfirm(false);
                  await clearLibrary();
                }}
              >
                전체 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}