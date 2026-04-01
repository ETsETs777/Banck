export const SCRATCHPAD_STORAGE_KEY = "spektors-launcher:scratchpad";

export type ScratchpadImage = { id: string; dataUrl: string };

export type ScratchpadData = {
  v: 1;
  text: string;
  images: ScratchpadImage[];
};

const MAX_IMAGES = 16;
const MAX_FILE_BYTES = 900_000;

export function loadScratchpad(): ScratchpadData {
  try {
    const raw = localStorage.getItem(SCRATCHPAD_STORAGE_KEY);
    if (!raw) return { v: 1, text: "", images: [] };
    const j = JSON.parse(raw) as Partial<ScratchpadData>;
    if (typeof j.text !== "string" || !Array.isArray(j.images)) {
      return { v: 1, text: "", images: [] };
    }
    return {
      v: 1,
      text: j.text,
      images: j.images
        .filter(
          (x): x is ScratchpadImage =>
            x &&
            typeof x.id === "string" &&
            typeof x.dataUrl === "string" &&
            x.dataUrl.startsWith("data:image/"),
        )
        .slice(0, MAX_IMAGES),
    };
  } catch {
    return { v: 1, text: "", images: [] };
  }
}

export function saveScratchpad(data: ScratchpadData): void {
  try {
    localStorage.setItem(
      SCRATCHPAD_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        text: data.text,
        images: data.images.slice(0, MAX_IMAGES),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export async function fileToDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.size > MAX_FILE_BYTES) return null;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

export { MAX_IMAGES, MAX_FILE_BYTES };
