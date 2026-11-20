/* CleanMate AI Chatbot V3 Widget (Auto Best Model: SVM + E5 Hybrid + GPS Context + Proxy Fallback) */
(function () {
  'use strict';
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }
  const money = (price) => new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  const suggestions = [
    'Giặt sofa ở Quận 7 dưới 400k',
    'Đổi sang Quận 4',
    'Vệ sinh máy lạnh gần tôi nhất',
    'Dọn nhà giá rẻ',
    'Bên nào được đánh giá tốt?'
  ];
  function readSavedGeo() {
    try {
      const raw = localStorage.getItem('cleanmate_user_geo');
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (typeof g?.latitude === 'number' && typeof g?.longitude === 'number') {
        return { latitude: g.latitude, longitude: g.longitude };
      }
    } catch (_) {}
    return null;
  }
  function mount(container, options = {}) {
    if (!container) throw new Error('Missing widget mount container');
    const primaryBase = (options.apiBase || '').replace(/\/$/, '');
    const fallbackBase = 'http://127.0.0.1:8000';
    let context = {};
    // Always lock to the best local model (SVM + Multilingual-E5-Small Hybrid)
    let mode = 'hybrid';
    let busy = false;

    async function apiFetch(path, init) {
      try {
        const res = await fetch(primaryBase + path, init);
        if (res.ok) return res;
        if (primaryBase !== fallbackBase && [404, 500, 502, 503, 504].includes(res.status)) {
          return await fetch(fallbackBase + path, init);
        }
        return res;
      } catch (err) {
        if (primaryBase !== fallbackBase) {
          return await fetch(fallbackBase + path, init);
        }
        throw err;
      }
    }

    container.textContent = '';
    const w = el('div', 'cm-widget');
    const header = el('div', 'cm-header');
    const brand = el('div', 'cm-brand');
    brand.append(el('div', 'cm-logo', '✦'));
    const title = el('div');
    title.append(el('strong', '', 'CleanMate AI'), el('small', '', 'Trợ lý gợi ý dịch vụ vệ sinh'));
    brand.append(title);
    const statusBadge = el('span', 'cm-connected', '● Trực tuyến');
    header.append(brand, statusBadge);

    // Silent check: fall back to SVM only if E5 model is not ready on server
    apiFetch('/api/models').then(r => r.ok ? r.json() : null).then(info => {
      if (info && info.hybrid_ready === false) {
        mode = 'svm';
      }
    }).catch(() => {});

    const messages = el('div', 'cm-messages');
    messages.setAttribute('aria-live', 'polite');
    const bottom = el('div', 'cm-bottom');
    const chips = el('div', 'cm-chips');
    const reset = el('button', 'cm-reset', '↺ Làm mới hội thoại'); reset.type = 'button';
    reset.addEventListener('click', () => { context = {}; messages.textContent = ''; bubble('Đã bắt đầu hội thoại mới. Bạn đang cần dịch vụ vệ sinh nào?'); });
    const bar = el('form', 'cm-inputbar');
    const textarea = el('textarea');
    textarea.placeholder = 'Mô tả dịch vụ bạn đang cần...';
    textarea.rows = 1;
    textarea.maxLength = 500;
    textarea.setAttribute('aria-label', 'Nhập yêu cầu');
    const send = el('button', 'cm-send', '➤');
    send.type = 'submit'; send.setAttribute('aria-label', 'Gửi yêu cầu');
    bar.append(textarea, send);
    bottom.append(reset, chips, bar, el('div', 'cm-caption', 'CleanMate AI • Giá & lịch được xác thực trực tiếp trên hệ thống'));
    w.append(header, messages, bottom);
    container.append(w);

    function scroll() { messages.scrollTop = messages.scrollHeight; }
    function bubble(text, user = false) {
      const row = el('div', 'cm-message ' + (user ? 'cm-user' : 'cm-bot'));
      if (!user) row.append(el('div', 'cm-avatar', '✦'));
      const b = el('div', 'cm-bubble');
      const parts = String(text).split(/\*\*(.*?)\*\*/g);
      parts.forEach((p, i) => b.append(i % 2 ? el('strong', '', p) : document.createTextNode(p)));
      row.append(b); messages.append(row); scroll();
    }
    function resultCard(r) {
      const c = el('article', 'cm-result');
      const top = el('div', 'cm-result-top');
      top.append(el('span', 'cm-result-title', r.partner_name), el('span', 'cm-result-score', r.score + ' điểm'));
      c.append(top, el('p', 'cm-service', r.service_name), el('div', 'cm-price', money(r.price_vnd)));
      if (r.image_url && /^https?:\/\//.test(r.image_url)) {
        const img = el('img', 'cm-service-thumb'); img.src = r.image_url; img.alt = r.service_name || 'Ảnh dịch vụ'; img.loading = 'lazy'; c.append(img);
      }
      const info = el('div', 'cm-info');
      info.append(el('span', '', r.rating_average == null ? '☆ Chưa có đánh giá' : '★ ' + r.rating_average.toFixed(1) + '/5 · ' + r.rating_count + ' review'));
      if (r.distance_km != null) info.append(el('span', '', '📍 ≈ ' + r.distance_km + ' km'));
      c.append(info);
      const reasons = el('ul', 'cm-reasons');
      (r.reasons || []).slice(0, 3).forEach(reason => reasons.append(el('li', '', reason)));
      c.append(reasons);
      const button = el('button', '', 'Chọn dịch vụ này'); button.type = 'button';
      button.addEventListener('click', () => {
        const payload = { service_id: r.service_id, partner_id: r.partner_id, partner_service_id: r.partner_service_id, price_vnd: r.price_vnd };
        container.dispatchEvent(new CustomEvent('cleanmate:choose-service', { detail: payload, bubbles: true }));
        if (typeof options.onSelect === 'function') options.onSelect(payload);
        bubble('Đang mở trang chi tiết ' + r.service_name + ' của ' + r.partner_name + ' để xác thực giá và đặt lịch...');
      });
      c.append(button);
      return c;
    }
    async function submit(message) {
      const txt = String(message || '').trim();
      if (!txt || busy) return;
      busy = true; send.disabled = true; textarea.disabled = true;
      bubble(txt, true);
      const pending = el('div', 'cm-empty', 'Đang phân tích yêu cầu...');
      messages.append(pending); scroll();
      try {
        const geo = readSavedGeo();
        const requestContext = geo ? { ...context, latitude: geo.latitude, longitude: geo.longitude } : { ...context };
        const response = await apiFetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: txt, context: requestContext, top_k: 3, mode })
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error('HTTP ' + response.status + ': ' + (errorPayload.detail || errorPayload.message || 'Server error'));
        }
        const data = await response.json();
        context = data.context || context;
        pending.remove();
        bubble(data.reply);
        if (data.recommendations && data.recommendations.length) {
          const results = el('div', 'cm-results');
          data.recommendations.forEach(r => results.append(resultCard(r)));
          messages.append(results);
        }
        for (const note of (data.limitations || [])) messages.append(el('div', 'cm-notice', 'ⓘ ' + note));
        scroll();
      } catch (e) {
        pending.remove();
        console.error('CleanMate chatbot API error:', e);
        bubble('Không thể kết nối đến máy chủ Chatbot AI (cổng 8000). Hãy chắc chắn dịch vụ FastAPI đang chạy.');
      } finally {
        busy = false; send.disabled = false; textarea.disabled = false; textarea.focus();
      }
    }
    suggestions.forEach(t => {
      const b = el('button', '', t); b.type = 'button'; b.addEventListener('click', () => submit(t)); chips.append(b);
    });
    bar.addEventListener('submit', e => { e.preventDefault(); const v = textarea.value; textarea.value = ''; submit(v); });
    textarea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bar.requestSubmit(); } });
    bubble('Chào bạn! Mình là **CleanMate AI**. Mình có thể tìm và so sánh dịch vụ vệ sinh theo nhu cầu, ngân sách, đánh giá và vị trí gần bạn nhất!');
    return { send: submit, getContext: () => ({ ...context }), getMode: () => mode, reset: () => { context = {}; messages.textContent = ''; bubble('Bắt đầu một tìm kiếm mới nhé!'); }, destroy: () => { container.textContent = ''; } };
  }
  window.CleanMateChat = { mount };
})();
