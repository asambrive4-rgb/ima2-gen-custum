import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

type ReferenceImageCardProps = {
  variant?: "sidebar" | "bottom";
};

export function ReferenceImageCard({ variant = "sidebar" }: ReferenceImageCardProps) {
  const { t } = useI18n();
  const refs = useAppStore((s) => s.referenceImages);
  const removeReference = useAppStore((s) => s.removeReference);

  return (
    <div
      className={`reference-card reference-card--${variant}`}
      role="region"
      aria-label={t("prompt.refCardTitle")}
    >
      <div className="reference-card__header">
        <span className="section-title reference-card__title">{t("prompt.refCardTitle")}</span>
        {refs.length > 0 && (
          <span className="reference-card__count">
            {refs.length}/5
          </span>
        )}
      </div>

      <div className="reference-card__content">
        {refs.length === 0 ? (
          <div className="reference-card__empty">
            {t("prompt.noRefsSelected")}
          </div>
        ) : (
          <div className="reference-card__chips">
            {refs.map((src, i) => (
              <div
                key={i}
                className="reference-card__chip"
                title={t("prompt.refChipTitle", { n: i + 1 })}
              >
                <img
                  src={src}
                  alt={t("prompt.refChipAlt", { n: i + 1 })}
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  className="reference-card__chip-remove"
                  onClick={() => removeReference(i)}
                  aria-label={t("prompt.refRemoveAria", { n: i + 1 })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
