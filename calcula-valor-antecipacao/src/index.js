/**
 * Lambda: Cálculo de valor presente das últimas N parcelas a antecipar
 * Corrige k para refletir corretamente o tempo de cada parcela até o presente
 */

exports.handler = async (event, context, callback) => {
  try {
    console.log("## Evento Recebido:", JSON.stringify(event));

    const valorParcela = parseFloat(event.valorParcela);
    const taxaJuros = parseFloat(event.taxaJuros);
    const nParcelasTotal = parseInt(event.nParcelasTotal);
    const nParcelasAdiantamento = parseInt(event.nParcelasAdiantamento);

    if (
      isNaN(valorParcela) ||
      isNaN(taxaJuros) ||
      isNaN(nParcelasTotal) ||
      isNaN(nParcelasAdiantamento) ||
      valorParcela <= 0 ||
      taxaJuros < 0 ||
      nParcelasTotal <= 0 ||
      nParcelasAdiantamento <= 0 ||
      nParcelasAdiantamento > nParcelasTotal
    ) {
      throw new Error("Parâmetros inválidos. Verifique os campos de entrada.");
    }

    const parcelasAntecipadas = [];
    const valoresPresentes = [];

    // Parcelas a antecipar: últimas N parcelas
    for (let i = 0; i < nParcelasAdiantamento; i++) {
      const parcelaNumero = nParcelasTotal - i;
      const k = parcelaNumero; // número de meses até o vencimento
      const vp = valorParcela / Math.pow(1 + taxaJuros, k);
      parcelasAntecipadas.push(parcelaNumero);
      valoresPresentes.push(parseFloat(vp.toFixed(2)));
    }

    const valorTotalAntecipado = parseFloat(
      valoresPresentes.reduce((acc, curr) => acc + curr, 0).toFixed(2)
    );

    const resultado = {
      valorTotalAntecipado,
      valoresPresentes,
      parcelasAntecipadas
    };

    console.log("## Resultado:", JSON.stringify(resultado));
    return resultado;

  } catch (error) {
    console.error("Erro no cálculo:", error);
    callback(error);
  }
};
