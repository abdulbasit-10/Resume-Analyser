import {useState, useCallback} from 'react'
import {useDropzone, type FileRejection} from 'react-dropzone'
import { formatSize } from '../lib/utils'

interface FileUploaderProps {
    onFileSelect?: (file: File | null) => void;
}

const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes

// Client-side checks can always be bypassed by a determined attacker,
// so this is a UX convenience, not a security boundary. The magic-byte
// check at least catches a renamed non-PDF file before we spend time
// uploading and rendering it.
const looksLikePdf = async (file: File): Promise<boolean> => {
    try {
        const headerBytes = await file.slice(0, 5).arrayBuffer();
        const bytes = new Uint8Array(headerBytes);
        const header = String.fromCharCode(...bytes);
        return header.startsWith('%PDF-');
    } catch {
        return false;
    }
};

const FileUploader = ({ onFileSelect }: FileUploaderProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
        setValidationError(null);

        if (fileRejections.length > 0) {
            const reason = fileRejections[0].errors[0]?.code;
            if (reason === 'file-too-large') {
                setValidationError(`File is too large. Max size is ${formatSize(maxFileSize)}.`);
            } else if (reason === 'file-invalid-type') {
                setValidationError('Only PDF files are accepted.');
            } else {
                setValidationError('This file could not be accepted.');
            }
            setFile(null);
            onFileSelect?.(null);
            return;
        }

        const candidate = acceptedFiles[0] || null;
        if (!candidate) {
            setFile(null);
            onFileSelect?.(null);
            return;
        }

        const isPdf = await looksLikePdf(candidate);
        if (!isPdf) {
            setValidationError('This file doesn\'t look like a valid PDF.');
            setFile(null);
            onFileSelect?.(null);
            return;
        }

        setFile(candidate);
        onFileSelect?.(candidate);
    }, [onFileSelect]);

    const {getRootProps, getInputProps} = useDropzone({
        onDrop,
        multiple: false,
        accept: { 'application/pdf': ['.pdf']},
        maxSize: maxFileSize,
    })

    return (
        <div className="w-full gradient-border">
            <div {...getRootProps()}>
                <input {...getInputProps()} />

                <div className="space-y-4 cursor-pointer">
                    {file ? (
                        <div className="uploader-selected-file" onClick={(e) => e.stopPropagation()}>
                            <img src="/images/pdf.png" alt="pdf" className="size-10" />
                            <div className="flex items-center space-x-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                                        {file.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {formatSize(file.size)}
                                    </p>
                                </div>
                            </div>
                            <button className="p-2 cursor-pointer" onClick={(e) => {
                                setFile(null);
                                setValidationError(null);
                                onFileSelect?.(null)
                            }}>
                                <img src="/icons/cross.svg" alt="remove" className="w-4 h-4" />
                            </button>
                        </div>
                    ): (
                        <div>
                            <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                                <img src="/icons/info.svg" alt="upload" className="size-20" />
                            </div>
                            <p className="text-lg text-gray-500">
                                <span className="font-semibold">
                                    Click to upload
                                </span> or drag and drop
                            </p>
                            <p className="text-lg text-gray-500">PDF (max {formatSize(maxFileSize)})</p>
                            {validationError && (
                                <p className="text-sm text-red-500 mt-2">{validationError}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
export default FileUploader
