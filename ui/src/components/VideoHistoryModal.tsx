import { useEffect, useState, type MouseEvent } from "react";
import { useI18n } from "../i18n";
import { getVideoHistory, type VideoHistoryItem } from "../lib/api";

type VideoHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function VideoHistoryModal({ isOpen, onClose }: VideoHistoryModalProps) {
  const { t } = useI18n();
  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 20;

  useEffect(() => {
    if (!isOpen) return;
    setVideos([]);
    setOffset(0);
    setError(null);
    void loadVideos(0, true);
  }, [isOpen]);

  const loadVideos = async (currentOffset: number, replace = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVideoHistory(LIMIT, currentOffset);
      if (replace) {
        setVideos(res.items);
      } else {
        setVideos((prev) => [...prev, ...res.items]);
      }
      setHasMore(res.hasMore);
      setOffset(currentOffset + LIMIT);
    } catch (err) {
      console.error("[VideoHistoryModal] load fail:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleModalClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div className="video-history-backdrop" onClick={onClose}>
      <div className="video-history-modal" onClick={handleModalClick}>
        <div className="video-history-modal__header">
          <h2 className="video-history-modal__title">{t("history.videoHistoryTitle")}</h2>
          <button type="button" className="video-history-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="video-history-modal__body">
          {error && <div className="video-history-modal__error">{error}</div>}

          {videos.length === 0 && !loading && !error ? (
            <div className="video-history-modal__empty">
              {t("gallery.emptyAll")}
            </div>
          ) : (
            <div className="video-history-modal__grid">
              {videos.map((vid) => (
                <div key={vid.id} className="video-history-card">
                  <div className="video-history-card__media">
                    <video
                      src={vid.videoUrl}
                      preload="metadata"
                      controls
                      playsInline
                      className="video-history-card__video"
                    />
                  </div>
                  <div className="video-history-card__info">
                    <p className="video-history-card__prompt" title={vid.prompt}>
                      {vid.prompt}
                    </p>
                    <div className="video-history-card__meta">
                      {vid.duration && <span>{vid.duration}s</span>}
                      {vid.resolution && <span>{vid.resolution}</span>}
                      {vid.createdAt && (
                        <span>
                          {new Date(vid.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && <div className="video-history-modal__loading">{t("common.loading")}</div>}

          {hasMore && !loading && (
            <button
              type="button"
              className="video-history-modal__more-btn"
              onClick={() => void loadVideos(offset)}
            >
              {t("history.moreHistory")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
