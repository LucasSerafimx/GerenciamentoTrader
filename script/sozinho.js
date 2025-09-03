document.addEventListener("DOMContentLoaded", () => {
  const bancaInicial = 100;

  // No seu submit do formulário, antes de processar:
  const payoutPercent = Number(document.getElementById("inPayout").value);

  // validação simples
  if (Number.isNaN(payoutPercent) || payoutPercent < 0 || payoutPercent > 100) {
    throw new Error("Payout inválido"); // ou apenas retorne para parar o submit
  }

  // Se for usar no cálculo: converta para proporção (0–1)
  const payout = payoutPercent / 100;

  // Exemplo de regra de lucro com payout:
  // - WIN => lucro = amount * payout
  // - LOSS => lucro = -amount
  // const lucro = (result === 'WIN') ? amount * payout : -amount;

  // Rederizar banca incial
  let saldoAtual = document.getElementById("card-banca-valor");
  saldoAtual.textContent = `R$ ${bancaInicial.toFixed(2)}`;

  // Calcular Risco Trader
  let riscoTrader = document.getElementById("card-recommended-value");
  console.log(riscoTrader.textContent);
  riscoTrader.textContent = `Valor recomendado: R$${(
    bancaInicial * 0.02
  ).toFixed(2)}`;
});
