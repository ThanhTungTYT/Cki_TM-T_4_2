import { useState } from 'react';
import CleanMateChatWidget from './ReactIntegration';
import './customer-chat-floating.css';

export default function CustomerChatFloating() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <button
        className="cm-float-button"
        type="button"
        aria-expanded={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? 'Đóng tư vấn' : '✦ Tư vấn dịch vụ'}
      </button>
      <aside className="cm-float-panel" style={{ display: visible ? 'block' : 'none' }}>
        {/* Giữ nguyên mount để bảo toàn context hội thoại khi đóng/mở hoặc chuyển trang Customer */}
        <CleanMateChatWidget onAfterSelect={() => setVisible(false)} />
      </aside>
    </>
  );
}
