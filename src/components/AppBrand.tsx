type AppBrandProps = {
  kicker: string;
  title: string;
  subtitle: string;
};

export function AppBrand({ kicker, title, subtitle }: AppBrandProps) {
  return (
    <div className="toolbar-copy app-brand">
      <div className="app-brand-mark" aria-hidden="true">
        <img className="app-brand-logo" src="/skillsync-logo.svg" alt="" />
      </div>
      <div className="app-brand-copy">
        <p className="toolbar-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="toolbar-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
