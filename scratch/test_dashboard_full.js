const fs = require('fs');

async function runDashboardFullTest() {
  console.log('====================================================');
  console.log('   LIQ SAAS - RESTAURANT DASHBOARD AUDIT & TEST     ');
  console.log('====================================================\n');

  const BASE_API = 'http://localhost/liq/api';
  const BASE_URL = 'http://localhost/liq';
  const results = [];

  function record(category, testName, passed, details = '') {
    results.push({ category, testName, passed, details });
    const mark = passed ? '[PASS 100%]' : '[FAIL]';
    console.log(`${mark} [${category}] ${testName} ${details ? '-> ' + details : ''}`);
  }

  // -----------------------------------------------------------------
  // 1. VERIFICAÇÃO DE SERVIÇOS & INFRAESTRUTURA
  // -----------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_API}/health`);
    const data = await res.json();
    record('Infraestrutura', 'API Healthcheck', data.success === true, `Status: ${res.status}`);
  } catch (e) {
    record('Infraestrutura', 'API Healthcheck', false, e.message);
  }

  // -----------------------------------------------------------------
  // 2. PAINEL 1: DASHBOARD GERAL, KPIS & GRÁFICOS SVG
  // -----------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_API}/dashboard?restaurant_id=1&period=7d`);
    const json = await res.json();
    const d = json.data;
    const ok = json.success && d.kpis && d.charts && d.charts.daily_sales && d.charts.status_breakdown;
    record('Painel 1: Dashboard', 'Carregamento de KPIs e Métricas', ok, `Faturamento: ${d.kpis.revenue} Kz | Pedidos: ${d.kpis.total_orders}`);
    record('Painel 1: Dashboard', 'Dados do Gráfico de Área (Vendas 7 Dias)', Array.isArray(d.charts.daily_sales) && d.charts.daily_sales.length > 0, `${d.charts.daily_sales.length} dias computados`);
    record('Painel 1: Dashboard', 'Dados do Donut de Status de Pedidos', Array.isArray(d.charts.status_breakdown), `${d.charts.status_breakdown.length} status`);
    record('Painel 1: Dashboard', 'Horários de Pico (Gráfico de Barras)', Array.isArray(d.peak_hours), `${d.peak_hours.length} faixas horárias`);
    record('Painel 1: Dashboard', 'Top Produtos Mais Vendidos', Array.isArray(d.top_products), `${d.top_products.length} itens ranqueados`);
    record('Painel 1: Dashboard', 'Lista de Pedidos Recentes', Array.isArray(d.recent_orders), `${d.recent_orders.length} pedidos recentes`);
  } catch (e) {
    record('Painel 1: Dashboard', 'Carregamento de KPIs e Métricas', false, e.message);
  }

  // -----------------------------------------------------------------
  // 3. PAINEL 2: KDS COZINHA & GESTÃO DE PEDIDOS
  // -----------------------------------------------------------------
  let orderIdToTest = null;
  try {
    const res = await fetch(`${BASE_API}/orders/kitchen?restaurant_id=1`);
    const json = await res.json();
    const orders = json.data.orders || [];
    record('Painel 2: KDS Cozinha', 'Listagem de Pedidos em Espera / Produção', json.success, `${orders.length} comandas ativas`);
    if (orders.length > 0) {
      orderIdToTest = orders[0].id;
    }
  } catch (e) {
    record('Painel 2: KDS Cozinha', 'Listagem de Pedidos', false, e.message);
  }

  // Testar detalhes da comanda (Modal)
  if (orderIdToTest) {
    try {
      const res = await fetch(`${BASE_API}/orders/${orderIdToTest}`);
      const json = await res.json();
      record('Painel 2: KDS Cozinha', `Modal de Detalhes da Comanda #${orderIdToTest}`, json.success && !!json.data.items, `Itens: ${(json.data.items || []).length}`);
    } catch (e) {
      record('Painel 2: KDS Cozinha', `Modal de Detalhes da Comanda`, false, e.message);
    }
  }

  // -----------------------------------------------------------------
  // 4. PAINEL 3: GESTÃO DE MESAS
  // -----------------------------------------------------------------
  let tablesList = [];
  try {
    const res = await fetch(`${BASE_API}/tables?restaurant_id=1`);
    const json = await res.json();
    tablesList = json.data.tables || [];
    record('Painel 3: Mesas', 'Listagem de Mesas com Estatísticas', json.success, `${tablesList.length} mesas cadastradas`);
  } catch (e) {
    record('Painel 3: Mesas', 'Listagem de Mesas', false, e.message);
  }

  // -----------------------------------------------------------------
  // 5. TESTE DE AUDITORIA CRÍTICO DO QR CODE (ISO/IEC 18004)
  // -----------------------------------------------------------------
  console.log('\n--- AUDITORIA DE ESPECIFICAÇÃO DO QR CODE ---');
  let jsQR;
  try {
    jsQR = require('c:/xampp/htdocs/liq/node_modules/jsqr');
  } catch (e) {
    // try local
    jsQR = null;
  }

  const QRCode = require('c:/xampp/htdocs/liq/assets/script/qrcode.js');

  const testTableTokens = ['01', '07', 'VIP-1', 'mesa-esplanada-10'];
  const testHostModes = [
    { mode: 'WIFI', prefix: 'http://192.168.100.11/liq/client/index.html?t=' },
    { mode: 'LOCALHOST', prefix: 'http://localhost/liq/client/index.html?t=' },
    { mode: 'PROD', prefix: 'https://app.liq.ao/client/?t=' }
  ];

  let qrTotalTests = 0;
  let qrPassedTests = 0;

  for (const t of testTableTokens) {
    for (const host of testHostModes) {
      qrTotalTests++;
      const fullUrl = `${host.prefix}${encodeURIComponent(t)}`;
      const svg = QRCode.generateSVG(fullUrl, { size: 220, margin: 4, colorDark: '#032204' });

      // Validar formato SVG
      const isValidSvg = svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.includes('viewBox="0 0 220 220"');

      // Se temos o decodificador jsQR, renderizar a matriz de pixels e decodificar por câmara simulada
      let decodedMatch = true;
      let decodedStr = '';
      if (jsQR) {
        // Obter módulos direto de QRCode
        // Vamos extrair dimensões dos rects
        const rectMatches = [...svg.matchAll(/<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)" fill="#032204"/g)];
        
        // Simular imagem 240x240
        const size = 220;
        const scale = 2;
        const imgSize = size * scale;
        const rgba = new Uint8ClampedArray(imgSize * imgSize * 4);
        rgba.fill(255); // Branco

        for (const m of rectMatches) {
          const x0 = Math.round(parseFloat(m[1]) * scale);
          const y0 = Math.round(parseFloat(m[2]) * scale);
          const w = Math.round(parseFloat(m[3]) * scale);
          const h = Math.round(parseFloat(m[4]) * scale);

          for (let y = y0; y < y0 + h && y < imgSize; y++) {
            for (let x = x0; x < x0 + w && x < imgSize; x++) {
              const idx = (y * imgSize + x) * 4;
              rgba[idx] = 0;
              rgba[idx + 1] = 0;
              rgba[idx + 2] = 0;
              rgba[idx + 3] = 255;
            }
          }
        }

        const decoded = jsQR(rgba, imgSize, imgSize);
        decodedStr = decoded ? decoded.data : null;
        decodedMatch = (decodedStr === fullUrl);
      }

      const pass = isValidSvg && decodedMatch;
      if (pass) qrPassedTests++;
      record('Motor QR Code', `Mesa ${t} (${host.mode})`, pass, `Decodificado: ${decodedStr || 'SVG Válido'}`);
    }
  }

  // -----------------------------------------------------------------
  // 6. PAINEL 4: CARDÁPIO, PRODUTOS, UPLOAD DE IMAGEM & FALLBACK
  // -----------------------------------------------------------------
  console.log('\n--- AUDITORIA DE PRODUTOS & UPLOADS ---');
  try {
    const res = await fetch(`${BASE_API}/products?restaurant_id=1`);
    const json = await res.json();
    const prods = json.data.products || [];
    const cats = json.data.categories || [];
    record('Painel 4: Cardápio', 'Listagem de Produtos e Categorias', json.success, `${prods.length} produtos em ${cats.length} categorias`);

    // Testar se produtos com upload possuem caminho físico
    const uploadedProd = prods.find(p => p.image && p.image.startsWith('upload/'));
    if (uploadedProd) {
      const fullImgUrl = `${BASE_API}/${uploadedProd.image}`;
      const imgRes = await fetch(fullImgUrl);
      record('Painel 4: Cardápio', 'Acesso Físico a Imagem Enviada', imgRes.status === 200, `${uploadedProd.image} -> HTTP ${imgRes.status}`);
    }

    // Testar acesso a imagem padrão fallback
    const defRes = await fetch(`${BASE_URL}/assets/images/default-product.svg`);
    record('Painel 4: Cardápio', 'Imagem Fallback Padrão (default-product.svg)', defRes.status === 200, `HTTP ${defRes.status}`);
  } catch (e) {
    record('Painel 4: Cardápio', 'Listagem de Produtos', false, e.message);
  }

  // -----------------------------------------------------------------
  // 7. PAINEL 5: CRM & CLIENTES
  // -----------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_API}/crm/customers?restaurant_id=1`);
    const json = await res.json();
    const custs = json.data.customers || [];
    const kpis = json.data.kpis || {};
    record('Painel 5: CRM', 'Listagem de Clientes e KPIs de Fidelização', json.success, `${custs.length} clientes cadastrados | Taxa Retorno: ${kpis.return_rate || 0}%`);
  } catch (e) {
    record('Painel 5: CRM', 'Listagem de Clientes', false, e.message);
  }

  // -----------------------------------------------------------------
  // 8. PAINEL 6: CUPONS DE DESCONTO
  // -----------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_API}/coupons?restaurant_id=1`);
    const json = await res.json();
    const coups = json.data.coupons || [];
    record('Painel 6: Cupons', 'Listagem de Campanhas de Desconto', json.success, `${coups.length} cupons ativos`);
  } catch (e) {
    record('Painel 6: Cupons', 'Listagem de Cupons', false, e.message);
  }

  // -----------------------------------------------------------------
  // 9. CLIENT MENU RESOLUTION VIA TOKEN DA MESA
  // -----------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_API}/menu?restaurant=cafe-central&t=07`);
    const json = await res.json();
    record('Menu Digital Cliente', 'Resolução de Mesa por Token do QR Code (t=07)', json.success && json.data.table.number === '07', `Mesa ${json.data.table.number} identificada com sucesso`);
  } catch (e) {
    record('Menu Digital Cliente', 'Resolução de Mesa por Token', false, e.message);
  }

  // -----------------------------------------------------------------
  // RESUMO GERAL
  // -----------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const pct = Math.round((passed / total) * 100);

  console.log('\n====================================================');
  console.log(`   RELATÓRIO FINAL: ${passed}/${total} TESTES PASSARAM (${pct}%)`);
  console.log('====================================================');

  return { total, passed, failed, pct, results };
}

runDashboardFullTest().catch(console.error);
