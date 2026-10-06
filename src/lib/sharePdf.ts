import { Capacitor } from "@capacitor/core";

// Native app: a web view can't print or download files, so write the PDF to the
// cache folder and open the system share sheet ("Save to Files", Mail, etc.).
// Browser: use the share sheet when available, otherwise download the file.
export async function sharePdf(bytes: Uint8Array, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
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
    return;
  }

  const file = new File([new Uint8Array(bytes)], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
