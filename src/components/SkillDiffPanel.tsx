import { buildRenderedDiffHunks } from "../lib/compare";
import { formatDiffChangeLabel, getMessages } from "../lib/i18n";
import type { Language, SkillDiffPayload } from "../lib/types";

type SkillDiffPanelProps = {
  language: Language;
  compare: SkillDiffPayload | null;
  loading: boolean;
  error: string;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
};

export function SkillDiffPanel({
  language,
  compare,
  loading,
  error,
  activeFilePath,
  onSelectFile
}: SkillDiffPanelProps) {
  const messages = getMessages(language);
  const files = compare?.files ?? [];
  const selectedFile = files.find((file) => file.path === activeFilePath) ?? files[0] ?? null;
  const hunks = selectedFile ? buildRenderedDiffHunks(selectedFile) : [];

  return (
    <section className="inspector-section">
      <div className="section-heading">
        <h3>{messages.compareTitle}</h3>
        {selectedFile ? (
          <span
            className={`status-pill compare-pill compare-pill-${selectedFile.change}${
              selectedFile.isBinary ? " compare-pill-binary" : ""
            }`}
          >
            {formatDiffChangeLabel(language, selectedFile.change, selectedFile.isBinary)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="muted-copy">{messages.compareLoading}</p>
      ) : error ? (
        <div className="compare-empty-state">
          <strong>{messages.compareUnavailable}</strong>
          <p>{error}</p>
        </div>
      ) : files.length === 0 ? (
        <div className="compare-empty-state">
          <strong>{messages.compareTitle}</strong>
          <p>{messages.compareNoFiles}</p>
        </div>
      ) : (
        <div className="compare-layout">
          <section className="compare-files">
            <p className="compare-subtitle">{messages.changedFilesTitle}</p>
            <div className="compare-file-list">
              {files.map((file) => {
                const active = file.path === selectedFile?.path;
                return (
                  <button
                    key={file.path}
                    className={active ? "compare-file-row active" : "compare-file-row"}
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                  >
                    <div className="compare-file-copy">
                      <strong>{file.path}</strong>
                      <p>
                        {formatDiffChangeLabel(language, file.change, file.isBinary)}
                        {file.isBinary ? ` · ${messages.binaryFilePreviewUnavailable}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="compare-viewer">
            {selectedFile ? (
              <>
                <div className="compare-file-header">
                  <div>
                    <strong>{selectedFile.path}</strong>
                    <p>
                      {messages.compareRemoteLabel} -&gt; {messages.compareLocalLabel}
                    </p>
                  </div>
                  <span
                    className={`status-pill compare-pill compare-pill-${selectedFile.change}${
                      selectedFile.isBinary ? " compare-pill-binary" : ""
                    }`}
                  >
                    {formatDiffChangeLabel(
                      language,
                      selectedFile.change,
                      selectedFile.isBinary
                    )}
                  </span>
                </div>

                {selectedFile.isBinary ? (
                  <div className="compare-empty-state">
                    <strong>{messages.binaryFilePreviewUnavailable}</strong>
                    <p>{messages.compareNoText}</p>
                  </div>
                ) : hunks.length === 0 ? (
                  <div className="compare-empty-state">
                    <strong>{messages.compareTitle}</strong>
                    <p>{messages.compareNoText}</p>
                  </div>
                ) : (
                  <div className="compare-diff-scroll">
                    {hunks.map((hunk) => (
                      <div key={hunk.key} className="compare-hunk">
                        <div className="compare-hunk-header">{hunk.header}</div>
                        {hunk.lines.map((line) => (
                          <div
                            key={line.key}
                            className={`compare-line compare-line-${line.kind}`}
                          >
                            <span className="compare-line-prefix">{line.prefix}</span>
                            <span className="compare-line-content">
                              {line.content || " "}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="compare-empty-state">
                <strong>{messages.compareTitle}</strong>
                <p>{messages.compareNoFiles}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
