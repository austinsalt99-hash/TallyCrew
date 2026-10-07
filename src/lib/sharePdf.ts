import { Capacitor } from "@capacitor/core";

function toFile(bytes: Uint8Array, filename: string): File {
  return new File([new Uint8Array(bytes)], filename, { type: "application/pdf" });
}

// iPadOS 13+ reports itself as "Macintosh" in the user agent — same as a real
// Mac — but (unlike a real Mac) has touch support, which is the standard way
// to tell the two apart.
function isTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPod|iPad|Android/i.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

// Whether the browser can share a PDF file at all — used to decide whether to
// show a secondary "Share" button on web. Feature-detected with a throwaway
// file rather than assumed from navigator.share existing, since that alone
// doesn't guarantee file support.
export function canShareWeb(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([""], "test.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

async function sharePdfNative(bytes: Uint8Array, filename: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: bytesToBase64(bytes),
    directory: Directory.Cache,
  });
  await Share.share({ title: filename, files: [uri], dialogTitle: "Save invoice" });
}

// Saves the PDF. Native app: a web view can't download files, so write to the
// cache folder and open the system share sheet — on iOS that sheet has its own
// "Save to Files" entry alongside AirDrop/Mail/etc., so this one action covers
// saving. Mobile web (iPhone/iPad/Android browsers): same reasoning — a plain
// download link doesn't reliably save there, but the share sheet does. Desktop
// web (Mac/Windows/Linux): the OS share surface has no save action at all, only
// send-to-app entries (AirDrop, Mail, Messages, ...), so a direct download is
// used instead — that's what actually lands the file on disk there.
export async function savePdf(bytes: Uint8Array, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) return sharePdfNative(bytes, filename);

  const file = toFile(bytes, filename);
  if (isTouchDevice() && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Explicit "share it straight away" action, offered as a separate button on
// web (see canShareWeb above) for when someone wants to AirDrop/email/message
// the PDF without saving it first. Not relevant on native — the single save
// action there already opens this same sheet.
export async function sharePdfWeb(bytes: Uint8Array, filename: string): Promise<void> {
  await navigator.share({ files: [toFile(bytes, filename)], title: filename });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
