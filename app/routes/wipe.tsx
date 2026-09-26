import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePuterStore } from "~/lib/puter";

interface ResumeRecord {
    id: string;
    resumePath?: string;
    imagePath?: string;
    companyName?: string;
    jobTitle?: string;
}

const WipeApp = () => {
    const { auth, isLoading, error, clearError, fs, kv } = usePuterStore();
    const navigate = useNavigate();
    const [resumes, setResumes] = useState<ResumeRecord[]>([]);
    const [isWiping, setIsWiping] = useState(false);
    const [statusText, setStatusText] = useState('');

    // Load only this app's own records (resume:* keys), never the
    // account's full file root, so we only ever show/delete our own data.
    const loadResumes = async () => {
        const entries = await kv.list('resume:', true);
        if (!entries) {
            setResumes([]);
            return;
        }
        const parsed = (entries as { key: string; value: string }[])
            .map((entry) => {
                try {
                    return JSON.parse(entry.value) as ResumeRecord;
                } catch {
                    return null;
                }
            })
            .filter((r): r is ResumeRecord => r !== null);
        setResumes(parsed);
    };

    useEffect(() => {
        loadResumes();
    }, []);

    useEffect(() => {
        if (!isLoading && !auth.isAuthenticated) {
            navigate("/auth?next=/wipe");
        }
    }, [isLoading]);

    const handleDelete = async () => {
        const confirmed = window.confirm(
            `This will permanently delete ${resumes.length} resume(s) and their analysis data submitted through this app. This cannot be undone. Continue?`
        );
        if (!confirmed) return;

        setIsWiping(true);
        setStatusText('Deleting your resume data...');

        try {
            const entries = await kv.list('resume:', true);
            const items = (entries as { key: string; value: string }[]) || [];

            for (const item of items) {
                try {
                    const data = JSON.parse(item.value) as ResumeRecord;
                    if (data.resumePath) await fs.delete(data.resumePath);
                    if (data.imagePath) await fs.delete(data.imagePath);
                } catch {
                    // skip malformed entries but still remove the key below
                }
                await kv.delete(item.key);
            }

            setStatusText('Done.');
            await loadResumes();
        } catch (err) {
            console.error(err);
            setStatusText('Error: Failed to delete some data. Please try again.');
        } finally {
            setIsWiping(false);
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error {error}</div>;
    }

    return (
        <div>
            Authenticated as: {auth.user?.username}
            <div>Your submitted resumes ({resumes.length}):</div>
            <div className="flex flex-col gap-4">
                {resumes.map((resume) => (
                    <div key={resume.id} className="flex flex-row gap-4">
                        <p>{resume.companyName || 'Unknown company'} — {resume.jobTitle || 'Unknown role'}</p>
                    </div>
                ))}
            </div>
            {statusText && <div>{statusText}</div>}
            <div>
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded-md cursor-pointer disabled:opacity-50"
                    onClick={handleDelete}
                    disabled={isWiping || resumes.length === 0}
                >
                    {isWiping ? 'Wiping...' : 'Wipe My Resume Data'}
                </button>
            </div>
        </div>
    );
};

export default WipeApp;
