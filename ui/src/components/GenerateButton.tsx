import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function GenerateButton() {
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const generate = useAppStore((s) => s.generate);
  const openReadinessPopup = useAppStore((s) => s.openReadinessPopup);
  const videoModelSelected = useAppStore((s) => s.videoModelSelected);
  const { t } = useI18n();

  const loading = activeGenerations > 0;
  const label = videoModelSelected
    ? loading
      ? t("generate.videoButtonLoading", { n: activeGenerations })
      : t("generate.videoButton")
    : loading
      ? t("generate.buttonLoading", { n: activeGenerations })
      : t("generate.button");

  return (
    <div className="generate-row">
      <button
        type="button"
        className={`generate-btn${loading ? " loading" : ""}`}
        onClick={() => void generate()}
      >
        {label}
      </button>
      <button
        type="button"
        className="generate-row__readiness"
        onClick={openReadinessPopup}
        title={t("readiness.openTitle")}
        aria-label={t("readiness.openTitle")}
      >
        ?
      </button>
    </div>
  );
}
