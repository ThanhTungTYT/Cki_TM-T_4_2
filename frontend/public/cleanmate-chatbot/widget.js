/* Embeddable vanilla JS widget; no React/Vite build required.
   Host application can listen for the 'cleanmate:choose-service' event
   or pass onSelect(recommendation) when mounting. No checkout mutations occur here.
*/
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
    'Vệ sinh máy lạnh gần Bình Thạnh',
    'Dọn nhà giá rẻ',
    'Bên nào được đánh giá tốt?'
  ];
  function mount(container, options = {}) {
    if (!container) throw new Error('Missing widget mount container');
    const apiBase = (options.apiBase || '').replace(/\/$/, '');
    let context = {};
    let busy = false;
    container.textContent = '';
    const w = el('div', 'cm-widget');
    const header = el('div', 'cm-header');
    const brand = el('div', 'cm-brand');
    brand.append(el('div', 'cm-logo', '✦'));
    const title = el('div');
    title.append(el('strong', '', 'CleanMate AI'), el('small', '', 'Trợ lý gợi ý dịch vụ vệ sinh'));
    brand.append(title);
    header.append(brand, el('span', 'cm-connected', '●  Local AI'));
    const messages = el('div', 'cm-messages');
    messages.setAttribute('aria-live', 'polite');
    const bottom = el('div', 'cm-bottom');
    const chips = el('div', 'cm-chips');
    const bar = el('form', 'cm-inputbar');
    const textarea = el('textarea');
    textarea.placeholder = 'Mô tả dịch vụ bạn đang cần...';
    textarea.rows = 1;
    textarea.maxLength = 500;
    textarea.setAttribute('aria-label', 'Nhập yêu cầu');
    const send = el('button', 'cm-send', '➤');
    send.type = 'submit'; send.setAttribute('aria-label', 'Gửi yêu cầu');
    bar.append(textarea, send);
    bottom.append(chips, bar, el('div','cm-caption','Giá và review từ dữ liệu • Chưa xác nhận lịch trống'));
    w.append(header, messages, bottom);
    container.append(w);
    function scroll() { messages.scrollTop = messages.scrollHeight; }
    function bubble(text, user = false) {
      const row = el('div', 'cm-message ' + (user ? 'cm-user' : 'cm-bot'));
      if (!user) row.append(el('div', 'cm-avatar', '✦'));
      // avoid injecting HTML from API/model/user; use textContent everywhere.
      const b = el('div', 'cm-bubble');
      const parts = String(text).split(/\*\*(.*?)\*\*/g);
      parts.forEach((p, i) => b.append(i % 2 ? el('strong', '', p) : document.createTextNode(p)));
      row.append(b); messages.append(row); scroll();
    }
    function resultCard(r) {
      const c = el('article', 'cm-result');
      const top = el('div', 'cm-result-top');
      top.append(el('span','cm-result-title',r.partner_name),el('span','cm-result-score',r.score + ' điểm'));
      c.append(top, el('p','cm-service',r.service_name),el('div','cm-price',money(r.price_vnd)));
      const info = el('div','cm-info');
      info.append(el('span','', r.rating_average == null ? '☆ Chưa có đánh giá' : '★ ' + r.rating_average.toFixed(1) + '/5 · ' + r.rating_count + ' review'));
      if (r.distance_km != null) info.append(el('span','', '⌖ ≈ ' + r.distance_km + ' km'));
      c.append(info);
      const reasons = el('ul','cm-reasons');
      (r.reasons || []).slice(0,3).forEach(reason => reasons.append(el('li','',reason)));
      c.append(reasons);
      const button = el('button','','Chọn dịch vụ này'); button.type='button';
      button.addEventListener('click', () => {
        const payload = {service_id:r.service_id,partner_id:r.partner_id,partner_service_id:r.partner_service_id,price_vnd:r.price_vnd};
        container.dispatchEvent(new CustomEvent('cleanmate:choose-service',{detail:payload,bubbles:true}));
        if(typeof options.onSelect === 'function') options.onSelect(payload);
        bubble('Đã chọn ' + r.service_name + ' của ' + r.partner_name + '. Trong bản demo này, thao tác đặt hàng sẽ được ứng dụng chính xử lý sau khi tích hợp.');
      });
      c.append(button);
      return c;
    }
    async function submit(message) {
      const txt = String(message||'').trim();
      if(!txt || busy)return;
      busy = true; send.disabled = true; textarea.disabled = true;
      bubble(txt, true);
      const pending = el('div','cm-empty','Đang phân tích yêu cầu trên máy local...');
      messages.append(pending);scroll();
      try {
        const response = await fetch(apiBase + '/api/chat', {
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({message:txt,context,top_k:3})
        });
        if(!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        context = data.context || context;
        pending.remove();
        bubble(data.reply);
        if(data.recommendations && data.recommendations.length) {
          const results = el('div','cm-results');
          data.recommendations.forEach(r => results.append(resultCard(r)));
          messages.append(results);
        }
        for(const note of (data.limitations||[])) messages.append(el('div','cm-notice','ⓘ ' + note));
        scroll();
      } catch(e) {
        pending.remove();bubble('Không kết nối được API chatbot. Hãy kiểm tra Python FastAPI đang chạy tại ' + (apiBase||'địa chỉ hiện tại') + '.');
      } finally {
        busy = false;send.disabled = false;textarea.disabled = false;textarea.focus();
      }
    }
    suggestions.forEach(t => {
      const b = el('button','',t);b.type='button';b.addEventListener('click',()=>submit(t));chips.append(b);
    });
    bar.addEventListener('submit', e => {e.preventDefault();const v=textarea.value;textarea.value='';submit(v);});
    textarea.addEventListener('keydown', e => {if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();bar.requestSubmit();}});
    bubble('Chào bạn! Mình có thể tìm và so sánh dịch vụ vệ sinh theo nhu cầu, ngân sách, đánh giá và khu vực. Bạn đang cần dịch vụ gì?');
    return {send:submit, getContext:()=>({...context}), reset:()=>{context={};messages.textContent='';bubble('Bắt đầu một tìm kiếm mới nhé!');}, destroy:()=>{container.textContent='';}};
  }
  window.CleanMateChat = {mount};
})();
