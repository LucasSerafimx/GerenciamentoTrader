// =============================================================================
// Script principal do frontend do "Gerenciamento Trader"
// - Mantém um estado simples na memória (state)
// - Persiste no localStorage (opcional)
// - Calcula KPIs para os cards
// - Renderiza valores no DOM
// - Trata o formulário de nova operação (modal)
// Obs.: todo o código roda no navegador, sem backend.
// =============================================================================

// ==== Estado (mock) ====
// Este objeto "state" guarda todos os dados da sua aplicação no front (sem backend).
// - bancaInicial: valor da banca de partida
// - operacoes: lista de operações (cada uma com seus campos)
const state = {
  bancaInicial: 5000, // valor inicial da banca; pode vir de formulário/localStorage
  operacoes: [
    // Estrutura esperada para cada operação:
    // {
    //   id: string (id),
    //   createdAt: Date,
    //   amount: number (valor em R$ arriscado ou ganho),
    //   result: 'WIN' | 'LOSS',
    //   strategy: string (opcional),
    //   description: string (opcional)
    // }
  ],
};

// ==== Helpers de formatação ====
// Converte um número para formato de moeda brasileira (R$)
// Usa Intl.NumberFormat por baixo (toLocaleString)
function brl(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// Converte número (0–100) para string percentual com 2 casas decimais
function pct(n) {
  return `${n.toFixed(2)}%`;
}

// ==== Persistência (opcional) com localStorage ====
// Serializa e salva o "state" no localStorage para manter os dados ao recarregar a página
function salvarLocal() {
  const serial = {
    bancaInicial: state.bancaInicial,
    // localStorage só armazena texto; datas precisam ir como string ISO
    operacoes: state.operacoes.map(o => ({
      ...o,
      // Garante que createdAt é string ISO (se for Date)
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt
    })),
  };
  // A chave 'daytrade_state' é onde armazenamos o JSON
  localStorage.setItem('daytrade_state', JSON.stringify(serial));
}

// Lê o state do localStorage (se existir) e reconstrói os tipos (Date/Number)
function carregarLocal() {
  const raw = localStorage.getItem('daytrade_state'); // lê a string salva
  if (!raw) return; // se não tiver nada salvo, não faz nada
  try {
    const parsed = JSON.parse(raw); // tenta parsear o JSON
    // Normaliza tipos para evitar NaN/valores inválidos
    state.bancaInicial = Number(parsed.bancaInicial) || 0;
    state.operacoes = Array.isArray(parsed.operacoes)
      ? parsed.operacoes.map(o => ({
          ...o,
          // Converte de ISO string para Date; fallback para agora se ausente
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
          // Garante que amount é Number
          amount: Number(o.amount),
          // Normaliza result para 'WIN' ou 'LOSS'
          result: o.result === 'WIN' ? 'WIN' : 'LOSS',
        }))
      : [];
  } catch {
    // Se der erro de parse, ignoramos (evita quebrar a página)
    // Poderia opcionalmente limpar a chave ou mostrar um aviso ao usuário
  }
}

// ==== Cálculos ====
// Retorna o objeto Date do primeiro dia do mês atual (usado para filtrar operações do mês)
function inicioDoMesAtual() {
  const now = new Date();
  // new Date(ano, mes, dia, hora, min, seg, ms) - horas zeradas
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

// Calcula todos os KPIs que os cards precisam, baseado no estado atual
function calcularKPIs() {
  const ops = state.operacoes; // atalho para as operações atuais
  const startMonth = inicioDoMesAtual();

  // Profit acumulado de todas as operações.
  // Regra base: WIN soma amount; LOSS subtrai amount.
  const profitAll = ops.reduce(
    (acc, o) => acc + (o.result === 'WIN' ? o.amount : -o.amount),
    0
  );
  const bancaAtual = state.bancaInicial + profitAll; // banca atual = inicial + resultado acumulado

  // Calcula o lucro antes do mês atual para ter uma base (baseline) de comparação
  const profitAntesMes = ops
    .filter(o => o.createdAt < startMonth)
    .reduce((acc, o) => acc + (o.result === 'WIN' ? o.amount : -o.amount), 0);

  // Baseline do mês = quanto a banca tinha no início do mês (inicial + lucro até o mês anterior)
  const baselineMes = state.bancaInicial + profitAntesMes;

  // Filtra operações do mês atual até o momento
  const opsMes = ops.filter(o => o.createdAt >= startMonth && o.createdAt <= new Date());

  // Conta wins e losses do mês
  const winsMes = opsMes.filter(o => o.result === 'WIN').length;
  const lossesMes = opsMes.filter(o => o.result === 'LOSS').length;

  // Lucro do mês (mesma regra simples de WIN/LOSS)
  const lucroMes = opsMes.reduce(
    (acc, o) => acc + (o.result === 'WIN' ? o.amount : -o.amount),
    0
  );

  // Taxa de acerto do mês (%). Evita divisão por zero
  const taxaAcerto = (winsMes + lossesMes) > 0
    ? (winsMes / (winsMes + lossesMes)) * 100
    : 0;

  // Variação do mês: valor e percentual sobre o baseline do início do mês
  const variacaoValor = lucroMes;
  const variacaoPct = baselineMes > 0 ? (variacaoValor / baselineMes) * 100 : 0;

  // Streak atual: quantos resultados iguais consecutivos a partir da última operação
  let streakAtual = 0;
  let streakTipo = null; // 'WIN' ou 'LOSS'
  for (let i = ops.length - 1; i >= 0; i--) {
    if (i === ops.length - 1) {
      // Define o tipo da última operação, inicia o contador
      streakTipo = ops[i]?.result || null;
      streakAtual = streakTipo ? 1 : 0;
    } else {
      // Se o resultado anterior for igual, incrementa; se mudar, encerra a streak
      if (ops[i].result === streakTipo) streakAtual++;
      else break;
    }
  }

  // Streak máximo de WIN (sequência positiva mais longa)
  let streakMax = 0, atual = 0;
  for (const o of ops) {
    if (o.result === 'WIN') {
      atual++;
      streakMax = Math.max(streakMax, atual);
    } else {
      atual = 0; // reseta quando encontrar um LOSS
    }
  }

  // Média de amount por operação no mês
  const mediaMes = opsMes.length > 0
    ? opsMes.reduce((acc, o) => acc + o.amount, 0) / opsMes.length
    : 0;

  // Última operação (a mais recente no array)
  const ultima = ops[ops.length - 1] || null;

  // Retorna tudo que a renderização precisa
  return {
    bancaAtual,
    baselineMes,
    variacaoValor,
    variacaoPct,
    winsMes,
    lossesMes,
    taxaAcerto,
    lucroMes,
    mediaMes,
    streakAtual,
    streakTipo,
    streakMax,
    ultima,
  };
}

// ==== Renderização no DOM ====
// Atualiza os textos/classes dos elementos HTML (os IDs do seu HTML)
function render() {
  const k = calcularKPIs(); // calcula as métricas com base no estado atual

  // Card: Banca Atual
  const elBancaValor = document.getElementById('card-banca-valor');
  const elBancaVar = document.getElementById('card-banca-var');
  if (elBancaValor) elBancaValor.textContent = brl(k.bancaAtual);
  if (elBancaVar) {
    const positivo = k.variacaoValor >= 0;
    // Mostra variação absoluta + percentual (com sinal)
    elBancaVar.textContent = `${positivo ? '+' : ''}${brl(k.variacaoValor)} (${pct(k.variacaoPct)})`;
    // Altera a cor conforme positivo/negativo (usa classes do Bootstrap)
    elBancaVar.classList.toggle('text-success', positivo);
    elBancaVar.classList.toggle('text-danger', !positivo);
  }

  // Card: Desempenho (Mês) — wins, losses, taxa de acerto
  const elWins = document.getElementById('card-wins');
  const elLosses = document.getElementById('card-losses');
  const elHit = document.getElementById('card-hit-rate');
  if (elWins) elWins.textContent = `${k.winsMes} WIN`;
  if (elLosses) elLosses.textContent = `${k.lossesMes} LOSS`;
  if (elHit) elHit.textContent = pct(k.taxaAcerto);

  // Card: Lucro (Mês)
  const elLucro = document.getElementById('card-lucro-valor');
  if (elLucro) {
    const positivo = k.lucroMes >= 0;
    elLucro.textContent = `${positivo ? '+' : ''}${brl(k.lucroMes)}`;
    elLucro.classList.toggle('text-success', positivo);
    elLucro.classList.toggle('text-danger', !positivo);
  }
  // Payout médio: não calculado aqui; pode ser implementado depois se houver dados de payout

  // Bônus: Sequência atual
  const elStreakCurrent = document.getElementById('card-streak-current');
  const elStreakMax = document.getElementById('card-streak-max');
  if (elStreakCurrent) elStreakCurrent.textContent = `${k.streakAtual || 0} ${k.streakTipo || ''}`.trim();
  if (elStreakMax) elStreakMax.textContent = `${k.streakMax} WIN`;

  // Bônus: Média por operação (mês)
  const elAvg = document.getElementById('card-avg-amount');
  if (elAvg) elAvg.textContent = brl(k.mediaMes);

  // Bônus: Última operação (result, lucro e data/hora)
  const elLastResult = document.getElementById('card-last-result');
  const elLastProfit = document.getElementById('card-last-profit');
  const elLastWhen = document.getElementById('card-last-when');
  if (k.ultima) {
    // lucro da última operação: positivo se WIN, negativo se LOSS
    const lucro = k.ultima.result === 'WIN' ? k.ultima.amount : -k.ultima.amount;
    if (elLastResult) {
      elLastResult.textContent = k.ultima.result;
      // Aplica badge verde para WIN e vermelha para LOSS
      elLastResult.classList.toggle('bg-success', k.ultima.result === 'WIN');
      elLastResult.classList.toggle('bg-danger', k.ultima.result === 'LOSS');
    }
    if (elLastProfit) {
      const positivo = lucro >= 0;
      elLastProfit.textContent = `${positivo ? '+' : ''}${brl(lucro)}`;
      elLastProfit.classList.toggle('text-success', positivo);
      elLastProfit.classList.toggle('text-danger', !positivo);
    }
    if (elLastWhen) {
      // Formata data/hora no locale pt-BR
      elLastWhen.textContent = new Date(k.ultima.createdAt).toLocaleString('pt-BR');
    }
  }
}

// ==== Operações (simulação de adicionar) ====
// Função para adicionar uma nova operação ao estado (chame essa função no submit do formulário)
function adicionarOperacao({ amount, result, strategy, description }) {
  const op = {
    // Gera um id único (usa crypto.randomUUID se disponível, fallback para timestamp)
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date(),        // data/hora atual no momento da inclusão
    amount: Number(amount),       // garante que é número
    result: result === 'WIN' ? 'WIN' : 'LOSS', // normaliza para 'WIN' ou 'LOSS'
    strategy: strategy || '',     // campos opcionais; evita undefined
    description: description || '',
  };
  state.operacoes.push(op); // adiciona no array em memória
  salvarLocal();            // salva no localStorage (opcional)
  render();                 // recalcula KPIs e atualiza UI
}

// ==== Inicialização ====
// Quando o HTML estiver carregado, lê dados salvos (se houver) e renderiza a UI
document.addEventListener('DOMContentLoaded', () => {
  carregarLocal(); // tenta recuperar o estado salvo do localStorage
  render();        // pinta os cards com os dados atuais

  // Captura elementos do formulário/modal
  const form = document.getElementById('formOperacao');
  if (!form) return; // se a página não tiver o formulário, sai

  const msg = document.getElementById('formMsg'); // área de mensagens de erro
  const modalEl = document.getElementById('modalOperacao');
  // Instancia o modal do Bootstrap (se existir na página)
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  // Handler de submit do formulário de nova operação
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // evita recarregar a página
    if (msg) msg.textContent = ''; // limpa mensagens anteriores

    // Lê valores dos campos
    const amount = Number(document.getElementById('inAmount').value);
    const result = document.getElementById('inResult').value;
    const strategy = document.getElementById('inStrategy').value.trim();
    const description = document.getElementById('inDescription').value.trim();

    // Validações simples de campos obrigatórios
    if (!amount || amount <= 0) {
      if (msg) msg.textContent = 'Informe um valor válido.';
      return;
    }
    if (result !== 'WIN' && result !== 'LOSS') {
      if (msg) msg.textContent = 'Selecione WIN ou LOSS.';
      return;
    }

    // Envia para o estado (adiciona a operação)
    adicionarOperacao({ amount, result, strategy, description });

    // Reseta formulário e fecha modal
    form.reset();
    if (modal) modal.hide();
  });
});