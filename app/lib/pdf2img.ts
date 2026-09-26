export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

// Hard ceiling on rendered canvas dimensions. Without this, a
// malformed or unusually large PDF page combined with scale=4 could
// try to allocate a canvas large enough to hang or crash the tab.
const MAX_CANVAS_DIMENSION = 4000;
const CONVERSION_TIMEOUT_MS = 30_000;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
    loadPromise = import("pdfjs-dist/build/pdf.mjs").then((lib) => {
        // Set the worker source to use local file
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        pdfjsLib = lib;
        isLoading = false;
        return lib;
    });

    return loadPromise;
}

async function convertPdfToImageInner(file: File): Promise<PdfConversionResult> {
    const lib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // Render at scale 4 by default, but never let the canvas exceed
    // MAX_CANVAS_DIMENSION on either axis.
    const baseViewport = page.getViewport({ scale: 1 });
    const requestedScale = 4;
    const widthAtRequestedScale = baseViewport.width * requestedScale;
    const heightAtRequestedScale = baseViewport.height * requestedScale;
    const largestDimension = Math.max(widthAtRequestedScale, heightAtRequestedScale);
    const scale = largestDimension > MAX_CANVAS_DIMENSION
        ? requestedScale * (MAX_CANVAS_DIMENSION / largestDimension)
        : requestedScale;

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
    }

    await page.render({ canvasContext: context!, viewport }).promise;

    return new Promise((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    // Create a File from the blob with the same name as the pdf
                    const originalName = file.name.replace(/\.pdf$/i, "");
                    const imageFile = new File([blob], `${originalName}.png`, {
                        type: "image/png",
                    });

                    resolve({
                        imageUrl: URL.createObjectURL(blob),
                        file: imageFile,
                    });
                } else {
                    resolve({
                        imageUrl: "",
                        file: null,
                        error: "Failed to create image blob",
                    });
                }
            },
            "image/png",
            1.0
        ); // Set quality to maximum (1.0)
    });
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        const timeout = new Promise<PdfConversionResult>((resolve) => {
            setTimeout(() => {
                resolve({
                    imageUrl: "",
                    file: null,
                    error: "PDF conversion timed out. The file may be too complex or malformed.",
                });
            }, CONVERSION_TIMEOUT_MS);
        });

        return await Promise.race([convertPdfToImageInner(file), timeout]);
    } catch (err) {
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err}`,
        };
    }
}