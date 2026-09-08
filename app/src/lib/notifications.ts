// Real native notifications via Capacitor's Local Notifications plugin — only
// does anything inside the packaged Android app (Capacitor.isNativePlatform()
// is false in a plain browser tab, where there's no native notification tray
// to post into). No fake/simulated notification on web; it's simply absent
// there, same as the honest-gating pattern used elsewhere in this app.

import { Capacitor } from "@capacitor/core";

let permissionAsked = false;

async function ensurePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if (!permissionAsked) {
      permissionAsked = true;
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== "granted") {
        await LocalNotifications.requestPermissions();
      }
    }
    const { display } = await LocalNotifications.checkPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

// Called once on app start so the permission prompt (native only) happens
// up front rather than surprising the user right as their first generation
// finishes.
export function primeNotificationPermission(): void {
  void ensurePermission();
}

// Fire when this happens while the app may be backgrounded — the whole point
// is not having to babysit the progress screen. Failures here never surface
// to the user; a missed notification isn't worth interrupting the actual
// generation flow over.
export async function notifyGenerationDone(opts: { success: boolean; title: string; body: string }): Promise<void> {
  try {
    const granted = await ensurePermission();
    if (!granted) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483647),
          title: opts.title,
          body: opts.body,
        },
      ],
    });
  } catch {
    // Best-effort only.
  }
}
