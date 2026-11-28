/* CleanMate AI Chatbot V4 Widget (100% Local Neural NLU + Hybrid RRF + Policy RAG + Dynamic Chips + Feedback) */
(function () {
  'use strict';
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }
  const money = (price) => new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  const defaultSuggestions = [
    'Giặt sofa ở Quận 7 dưới 400k',
    'Máy lạnh chảy nước có mùi hôi',
    'Chính sách hủy đơn & hoàn tiền',
    'Cách tích điểm Ccoin & voucher',
    'So sánh các bên này'
  ];

  function renderRichText(container, rawText) {
    const lines = String(rawText || '').split('\n');
    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) container.append(document.createElement('br'));
      // Parse **bold** and `code` safely via DOM nodes (zero innerHTML XSS risk)
      const tokens = line.split(/(\*\*.*?\*\*|`[^`]+`)/g);
      tokens.forEach((tok) => {
        if (!tok) return;
        if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
          container.append(el('strong', '', tok.slice(2, -2)));
        } else if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
          container.append(el('code', '', tok.slice(1, -1)));
        } else {
          container.append(document.createTextNode(tok));
        }
      });
    });
  }

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
    let mode = options.mode || 'v4';
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
    title.append(el('strong', '', 'CleanMate AI V4'), el('small', '', 'Trợ lý tư vấn dịch vụ & chính sách'));
    brand.append(title);
    const statusBadge = el('span', 'cm-connected', '● Local AI');
    header.append(brand, statusBadge);

    // Auto-select best ready offline model (v4 -> svm_v4 -> hybrid -> svm)
    apiFetch('/api/models').then(r => r.ok ? r.json() : null).then(info => {
      if (!info) return;
      if (mode === 'v4' && !info.v4_ready) {
        if (info.svm_v4_ready) mode = 'svm_v4';
        else if (info.hybrid_ready) mode = 'hybrid';
        else mode = 'svm';
      }
      if (info.transformer_v4_ready) {
        statusBadge.textContent = '● Local Transformer';
      } else if (info.e5_mlp_v4_ready) {
        statusBadge.textContent = '● Local Neural AI';
      }
    }).catch(() => {});

    const messages = el('div', 'cm-messages');
    messages.setAttribute('aria-live', 'polite');
    const bottom = el('div', 'cm-bottom');
    const chips = el('div', 'cm-chips');
    const reset = el('button', 'cm-reset', '↺ Làm mới hội thoại');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      context = {};
      messages.textContent = '';
      setBottomChips(defaultSuggestions);
      bubble('Đã bắt đầu hội thoại mới. Bạn đang cần dịch vụ vệ sinh nào hoặc muốn hỏi chính sách CleanMate?');
    });

    const bar = el('form', 'cm-inputbar');
    const textarea = el('textarea');
    textarea.placeholder = 'Mô tả tình trạng, dịch vụ hoặc hỏi chính sách CleanMate...';
    textarea.rows = 1;
    textarea.maxLength = 500;
    textarea.setAttribute('aria-label', 'Nhập yêu cầu');
    const send = el('button', 'cm-send', '➤');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Gửi yêu cầu');
    bar.append(textarea, send);
    bottom.append(reset, chips, bar, el('div', 'cm-caption', 'CleanMate AI V4 (100% Offline) • Giá & lịch xác thực trực tiếp trên hệ thống'));
    w.append(header, messages, bottom);
    container.append(w);

    function scroll() { messages.scrollTop = messages.scrollHeight; }

    function setBottomChips(list) {
      chips.textContent = '';
      (list && list.length ? list : defaultSuggestions).slice(0, 5).forEach(t => {
        const b = el('button', '', t);
        b.type = 'button';
        b.addEventListener('click', () => submit(t));
        chips.append(b);
      });
    }

    function bubble(text, user = false, meta = null) {
      const row = el('div', 'cm-message ' + (user ? 'cm-user' : 'cm-bot'));
      if (!user) row.append(el('div', 'cm-avatar', '✦'));
      const col = el('div', 'cm-bubble-col');
      const b = el('div', 'cm-bubble');
      renderRichText(b, text);
      col.append(b);

      if (!user && meta) {
        if (meta.kb_sources && meta.kb_sources.length) {
          const srcWrap = el('div', 'cm-kb-sources');
          meta.kb_sources.forEach(s => {
            srcWrap.append(el('span', 'cm-kb-pill', '📖 ' + s.title));
          });
          col.append(srcWrap);
        }
        if (meta.userMessage) {
          const fb = el('div', 'cm-feedback-row');
          const lbl = el('span', 'cm-fb-label', 'Hữu ích?');
          const up = el('button', 'cm-fb-btn', '👍'); up.type = 'button'; up.title = 'Câu trả lời hữu ích';
          const down = el('button', 'cm-fb-btn', '👎'); down.type = 'button'; down.title = 'Cần cải thiện';
          const sendFb = (helpful, btn) => {
            up.disabled = true; down.disabled = true;
            btn.classList.add('is-selected');
            lbl.textContent = helpful ? 'Cảm ơn phản hồi!' : 'Đã ghi nhận để cải thiện!';
            apiFetch('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: meta.userMessage,
                reply: String(text || '').slice(0, 500),
                intent: meta.intent || '',
                helpful,
                model_mode: meta.model_mode || mode
              })
            }).catch(() => {});
          };
          up.addEventListener('click', () => sendFb(true, up));
          down.addEventListener('click', () => sendFb(false, down));
          fb.append(lbl, up, down);
          col.append(fb);
        }
      }
      row.append(col);
      messages.append(row);
      scroll();
    }

    function resultCard(r) {
      const c = el('article', 'cm-result');
      const top = el('div', 'cm-result-top');
      top.append(el('span', 'cm-result-title', r.partner_name), el('span', 'cm-result-score', r.score + ' điểm'));
      c.append(top, el('p', 'cm-service', r.service_name), el('div', 'cm-price', money(r.price_vnd)));
      if (r.image_url && /^https?:\/\//.test(r.image_url)) {
        const img = el('img', 'cm-service-thumb');
        img.src = r.image_url;
        img.alt = r.service_name || 'Ảnh dịch vụ';
        img.loading = 'lazy';
        c.append(img);
      }
      const info = el('div', 'cm-info');
      info.append(el('span', '', r.rating_average == null ? '☆ Chưa có đánh giá' : '★ ' + r.rating_average.toFixed(1) + '/5 · ' + r.rating_count + ' review'));
      if (r.distance_km != null) info.append(el('span', '', '📍 ≈ ' + r.distance_km + ' km'));
      c.append(info);
      const reasons = el('ul', 'cm-reasons');
      (r.reasons || []).slice(0, 3).forEach(reason => reasons.append(el('li', '', reason)));
      c.append(reasons);
      const button = el('button', '', 'Chọn dịch vụ này');
      button.type = 'button';
      button.addEventListener('click', () => {
        const payload = { service_id: r.service_id, partner_id: r.partner_id, partner_service_id: r.partner_service_id, price_vnd: r.price_vnd };
        container.dispatchEvent(new CustomEvent('cleanmate:choose-service', { detail: payload, bubbles: true }));
        if (typeof options.onSelect === 'function') options.onSelect(payload);
        bubble('Đang mở trang chi tiết **' + r.service_name + '** của **' + r.partner_name + '** để xác thực giá và đặt lịch...');
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
        bubble(data.reply, false, {
          userMessage: txt,
          intent: data.intent,
          model_mode: data.model_mode,
          kb_sources: data.kb_sources || []
        });
        if (data.recommendations && data.recommendations.length) {
          const results = el('div', 'cm-results');
          data.recommendations.forEach(r => results.append(resultCard(r)));
          messages.append(results);
        }
        for (const note of (data.limitations || [])) messages.append(el('div', 'cm-notice', 'ⓘ ' + note));
        if (data.suggested_replies && data.suggested_replies.length) {
          setBottomChips(data.suggested_replies);
        }
        scroll();
      } catch (e) {
        pending.remove();
        console.error('CleanMate chatbot API error:', e);
        bubble('Không thể kết nối đến máy chủ Chatbot AI (cổng 8000). Hãy chắc chắn dịch vụ FastAPI đang chạy.');
      } finally {
        busy = false; send.disabled = false; textarea.disabled = false; textarea.focus();
      }
    }

    setBottomChips(defaultSuggestions);
    bar.addEventListener('submit', e => { e.preventDefault(); const v = textarea.value; textarea.value = ''; submit(v); });
    textarea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bar.requestSubmit(); } });
    bubble('Chào bạn! Mình là **CleanMate AI V4** (chạy 100% cục bộ). Mình có thể tìm & so sánh dịch vụ theo triệu chứng, khoảng giá, khu vực và giải đáp chính sách hủy đơn, thanh toán VNPay, điểm thưởng Ccoin!');
    return {
      send: submit,
      getContext: () => ({ ...context }),
      getMode: () => mode,
      reset: () => { context = {}; messages.textContent = ''; setBottomChips(defaultSuggestions); bubble('Bắt đầu một tìm kiếm mới nhé!'); },
      destroy: () => { container.textContent = ''; }
    };
  }
  window.CleanMateChat = { mount };
})();
