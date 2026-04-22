type AppBrandProps = {
  kicker: string;
  title: string;
  subtitle: string;
};

export function AppBrand({ kicker, title, subtitle }: AppBrandProps) {
  return (
    <div className="toolbar-copy app-brand">
      <img className="app-brand-logo" src="/skillsync-logo.png" alt="" aria-hidden="true" />
      <div className="app-brand-copy">
        <p className="toolbar-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="toolbar-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
