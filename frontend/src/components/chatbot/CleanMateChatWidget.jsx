import { useEffect, useRef, useState } from 'react';
import './chatbot-embed.css';

/**
 * CleanMateChatWidget
 * - Floating AI chatbot button (bottom-right corner) chỉ hiện trên các trang Customer.
 * - Khi user bấm "Chọn dịch vụ này", gọi onChooseService({ service_id, partner_id, partner_service_id, price_vnd })
 *   để App.jsx navigate sang trang chi tiết dịch vụ.
 * - Sử dụng window.CleanMateChat.mount() từ /cleanmate-chatbot/widget.js (nạp qua index.html).
 */
export default function CleanMateChatWidget({ onChooseService }) {
  const hostRef = useRef(null);
  const onChooseRef = useRef(onChooseService);
  const [isOpen, setIsOpen] = useState(false);

  // Cập nhật callback mà không mount lại widget — tránh mất context hội thoại.
  useEffect(() => {
    onChooseRef.current = onChooseService;
  }, [onChooseService]);

  useEffect(() => {
    if (!window.CleanMateChat) {
      console.error('[CleanMate] Chưa tải /cleanmate-chatbot/widget.js. Kiểm tra index.html.');
      return;
    }

    const instance = window.CleanMateChat.mount(hostRef.current, {
      // Giai đoạn 1: React gọi trực tiếp FastAPI local (port 8000).
      // Khi đưa lên prod, đổi sang '/api/ai' và cấu hình Vite proxy → Spring Boot.
      apiBase: 'http://127.0.0.1:8000',
      onSelect: (item) => {
        setIsOpen(false); // Đóng panel sau khi chọn
        onChooseRef.current?.(item);
      },
    });

    return () => instance?.destroy?.();
  }, []); // Chỉ mount một lần

  return (
    <>
      {/* Nút chat nổi góc dưới phải */}
      <button
        type="button"
        className="cm-floating-button"
        aria-expanded={isOpen}
        aria-controls="cleanmate-chat-panel"
        aria-label={isOpen ? 'Đóng chat AI' : 'Chat với CleanMate AI'}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="cm-float-icon">{isOpen ? '✕' : '✦'}</span>
        <span className="cm-float-label">{isOpen ? 'Đóng' : 'AI Tư vấn'}</span>
      </button>

      {/* Panel chat */}
      <div
        id="cleanmate-chat-panel"
        className={`cm-floating-panel${isOpen ? ' cm-panel-open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div ref={hostRef} className="cm-chat-host" />
      </div>
    </>
  );
}
