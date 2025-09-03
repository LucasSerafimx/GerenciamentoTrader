document.addEventListener('DOMContentLoaded', () => {
  // Helpers
  const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const STORAGE_KEY = 'bancaAtual';

  // Estado: banca atual carregada do localStorage (ou 100 padrão)
  let bancaAtual = (() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 100;
  })();

  // Elementos de UI
  const elBanca = document.getElementById('card-banca-valor');
  const form = document.getElementById('formOperacao');
  const msg = document.getElementById('formMsg');
  const modalEl = document.getElementById('modalOperacao');
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  // Renderiza banca na UI
  const renderBanca = () => {
    if (elBanca) elBanca.textContent = brl(bancaAtual);
  };
  const salvarBanca = () => localStorage.setItem(STORAGE_KEY, String(bancaAtual));

  // Primeira renderização
  renderBanca();

  // Captura submit do formulário do modal
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (msg) msg.textContent = '';

      // Lê valores do form
      const amount = Number(document.getElementById('inAmount').value);
      const payoutPercent = Number(document.getElementById('inPayout').value);
      const result = document.getElementById('inResult').value; // 'WIN' | 'LOSS'
      const operacional = document.getElementById('inOperacional').value; // opcional para lógica futura
      const description = document.getElementById('inDescription').value.trim(); // opcional

      // Validações
      if (!amount || amount <= 0) {
        if (msg) msg.textContent = 'Informe um valor válido (> 0).';
        return;
      }
      if (Number.isNaN(payoutPercent) || payoutPercent < 0 || payoutPercent > 100) {
        if (msg) msg.textContent = 'Payout deve ser entre 0 e 100.';
        return;
      }
      if (result !== 'WIN' && result !== 'LOSS') {
        if (msg) msg.textContent = 'Selecione WIN ou LOSS.';
        return;
      }
      if (!operacional) {
        if (msg) msg.textContent = 'Selecione o operacional.';
        return;
      }

      // Cálculo do impacto na banca:
      // - LOSS: subtrai o amount
      // - WIN: soma amount * (payout/100)
      const payout = payoutPercent / 100;
      const delta = (result === 'WIN') ? (amount * payout) : (-amount);

      // Atualiza banca, persiste e re-renderiza
      bancaAtual += delta;
      salvarBanca();
      renderBanca();

      // Aqui você pode também empurrar a "operação" para um array se quiser manter histórico:
      // state.operacoes.push({ amount, payoutPercent, result, operacional, description, createdAt: new Date() });
      // e então salvar no localStorage esse array também.

      // Limpa e fecha o modal
      form.reset();
      if (modal) modal.hide();
    });
  }
});