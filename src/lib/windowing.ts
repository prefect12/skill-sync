import type { WindowView } from "./types";

type WindowDescriptor = {
  label: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
};

const WINDOW_MAP: Record<Exclude<WindowView, "main">, WindowDescriptor> = {
  roots: {
    label: "roots",
    title: "Skill Locations",
    width: 960,
    height: 700,
    minWidth: 820,
    minHeight: 620
  },
  settings: {
    label: "settings",
    title: "Settings",
    width: 620,
    height: 520,
    minWidth: 560,
    minHeight: 420
  }
};

export function getWindowView(): WindowView {
  const url = new URL(window.location.href);
  const view = url.searchParams.get("view");
  if (view === "roots" || view === "settings") {
    return view;
  }
  return "main";
}

export function isTauriRuntime() {
  const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  return Boolean(runtimeWindow.__TAURI_INTERNALS__);
}

export async function openAppWindow(view: Exclude<WindowView, "main">) {
  const descriptor = WINDOW_MAP[view];
  const targetUrl = new URL(window.location.href);
  targetUrl.searchParams.set("view", view);

  if (!isTauriRuntime()) {
    window.open(
      targetUrl.toString(),
      descriptor.label,
      `popup=yes,width=${descriptor.width},height=${descriptor.height}`
    );
    return;
  }

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const existing = await WebviewWindow.getByLabel(descriptor.label);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }

    const created = new WebviewWindow(descriptor.label, {
      title: descriptor.title,
      url: targetUrl.toString(),
      center: true,
      width: descriptor.width,
      height: descriptor.height,
      minWidth: descriptor.minWidth,
      minHeight: descriptor.minHeight,
      resizable: true,
      visible: false
    });

    created.once("tauri://error", (error) => {
      console.error(`Failed to create ${view} window`, error);
    });
  } catch (error) {
    console.error(`Failed to open ${view} window`, error);
  }
}

export async function closeCurrentAppWindow() {
  if (!isTauriRuntime()) {
    window.close();
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export async function revealCurrentAppWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const current = getCurrentWebviewWindow();
  await current.show();
  await current.setFocus();
}
