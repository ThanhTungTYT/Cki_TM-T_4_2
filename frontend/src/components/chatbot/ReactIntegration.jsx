// React/Vite integration for CleanMate Chatbot V4 (100% Local Deep Learning + Hybrid RRF + Policy RAG).
// Static files:
//   public/cleanmate-chatbot/widget.js
//   public/cleanmate-chatbot/embed.css
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CleanMateChatWidget({ onAfterSelect }) {
  const root = useRef(null);
  const navigate = useNavigate();
  const onAfterSelectRef = useRef(onAfterSelect);

  useEffect(() => {
    onAfterSelectRef.current = onAfterSelect;
  }, [onAfterSelect]);

  useEffect(() => {
    let instance = null;
    let timer = null;

    function tryMount() {
      const widget = window.CleanMateChat;
      if (!root.current) return;
      if (!widget) {
        timer = window.setTimeout(tryMount, 100);
        return;
      }
      instance = widget.mount(root.current, {
        // Kết nối qua Spring Boot Proxy (/api/customer/ai -> FastAPI :8000),
        // tự động fallback sang http://127.0.0.1:8000 khi chạy thử nghiệm trực tiếp.
        apiBase: import.meta.env.VITE_CHATBOT_API_BASE || '/api/customer/ai',
        mode: 'v4',
        onSelect: ({ service_id, partner_service_id, partner_id }) => {
          onAfterSelectRef.current?.();
          // Điều hướng sang route chi tiết dịch vụ thực tế của CleanMate (/service-detail/:id).
          // Không tin price_vnd từ widget; trang chi tiết và Spring Boot sẽ truy vấn lại giá và lịch thực tế.
          const params = new URLSearchParams();
          if (partner_id != null) params.set('partnerId', String(partner_id));
          if (partner_service_id != null) params.set('partnerServiceId', String(partner_service_id));
          const qs = params.toString();
          navigate(`/service-detail/${service_id}${qs ? `?${qs}` : ''}`);
        }
      });
    }

    tryMount();

    return () => {
      if (timer) window.clearTimeout(timer);
      instance?.destroy?.();
    };
  }, [navigate]);

  return <div ref={root} className="cm-chat-host" />;
}
