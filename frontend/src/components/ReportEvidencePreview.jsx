import { useEffect, useState } from 'react';
import { getReportEvidenceObjectUrl } from '../services/api';
import './ReportEvidencePreview.css';

export default function ReportEvidencePreview({ reportId, alt = 'Ảnh bằng chứng khiếu nại' }) {
    const [src, setSrc] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        setSrc('');
        setError(false);

        getReportEvidenceObjectUrl(reportId, controller.signal)
            .then(url => {
                if (controller.signal.aborted) {
                    URL.revokeObjectURL(url);
                    return;
                }
                objectUrl = url;
                setSrc(url);
            })
            .catch(() => {
                if (!controller.signal.aborted) setError(true);
            });

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [reportId]);

    if (error) return <p className="report-evidence-preview-error">Không thể hiển thị ảnh bằng chứng.</p>;
    if (!src) return <p className="report-evidence-preview-loading">Đang tải ảnh bằng chứng…</p>;

    return (
        <a className="report-evidence-preview" href={src} target="_blank" rel="noreferrer" aria-label="Mở ảnh bằng chứng kích thước đầy đủ">
            <img src={src} alt={alt} loading="lazy" />
            <span>Mở ảnh</span>
        </a>
    );
}
