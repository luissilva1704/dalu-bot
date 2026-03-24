/**
 * Lambda: quote-nails
 * POST - Analiza imagen de uñas y devuelve cotización por longitud.
 * Misma lógica que POST /quote/nails en index.js
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import { BASE_PRICES, DESIGN_PRICES } from '../../../prices.js';
import { analyzeNailDesignBase64 } from '../../../ai.js';

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(data),
});

function parseBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch {
      return {};
    }
  }
  return event.body;
}

async function downloadImage(url) {
  const r = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; DaluBot/1.0)',
      Referer: 'https://www.instagram.com/',
    },
  });

  const ct = r.headers.get('content-type');
  const buf = Buffer.from(await r.arrayBuffer());
  const sha = crypto.createHash('sha256').update(buf).digest('hex');

  console.log('IMG DEBUG:', {
    status: r.status,
    contentType: ct,
    bytes: buf.length,
    sha256: sha,
  });

  return buf;
}

export const handler = async (event) => {
  try {
    const body = parseBody(event);
    const { image, service } = body;

    if (!image || !service) {
      return json(400, { error: 'Missing image/length/service' });
    }

    // 1) Bajar imagen desde IG y convertir a base64
    const imgBuffer = await downloadImage(image);
    const imgBase64 = imgBuffer.toString('base64');

    // 2) IA analiza imagen (base64)
    const analysis = await analyzeNailDesignBase64(imgBase64);
    console.log('analysis from chat', analysis);
    const analysisUpdated = {
      ...analysis,
      effects_count: analysis.effects_count * 2,
      hand_paint_count: analysis.hand_paint_count * 2,
      babyboomer_count: analysis.babyboomer_count * 2,
      french_count: analysis.french_count * 2,
      rhinestones_count: analysis.rhinestones_count * 2,
      encapsulated_count: analysis.encapsulated_count * 2,
      decoration_count: analysis.decoration_count * 2,
    };
    console.log('analysis from chat', analysisUpdated);

    // 3) Validar servicio
    const servicePrices = BASE_PRICES?.[service];
    if (!servicePrices) {
      return json(400, { error: 'Invalid service', service });
    }

    // 4) Calcular diseño total según longitud
    function calculateDesignTotal(lengthKey) {
      let designTotal = 0;
      const breakdown = {};

      if (analysisUpdated.french_count > 0) {
        const frenchPrice = DESIGN_PRICES.french[lengthKey] || DESIGN_PRICES.french.corto;
        const frenchTotal = analysisUpdated.french_count * frenchPrice;
        designTotal += frenchTotal;
        breakdown.french = {
          count: analysisUpdated.french_count,
          price_per_nail: frenchPrice,
          total: frenchTotal,
        };
      }

      if (analysisUpdated.babyboomer_count > 0) {
        const babyboomerTotal = analysisUpdated.babyboomer_count * DESIGN_PRICES.babyboomer;
        designTotal += babyboomerTotal;
        breakdown.babyboomer = {
          count: analysisUpdated.babyboomer_count,
          price_per_nail: DESIGN_PRICES.babyboomer,
          total: babyboomerTotal,
        };
      }

      if (analysisUpdated.hand_paint_count > 0) {
        const handPaintTotal = analysisUpdated.hand_paint_count * DESIGN_PRICES.hand_paint;
        designTotal += handPaintTotal;
        breakdown.hand_paint = {
          count: analysisUpdated.hand_paint_count,
          price_per_nail: DESIGN_PRICES.hand_paint,
          total: handPaintTotal,
        };
      }

      if (analysisUpdated.effects_count > 0) {
        const effectsTotal = analysisUpdated.effects_count * DESIGN_PRICES.effects;
        designTotal += effectsTotal;
        breakdown.effects = {
          count: analysisUpdated.effects_count,
          price_per_nail: DESIGN_PRICES.effects,
          total: effectsTotal,
        };
      }

      if (analysisUpdated.decoration_count > 0) {
        const decorationTotal = analysisUpdated.decoration_count * DESIGN_PRICES.decoration;
        designTotal += decorationTotal;
        breakdown.decoration = {
          count: analysisUpdated.decoration_count,
          price_per_nail: DESIGN_PRICES.decoration,
          total: decorationTotal,
        };
      }

      if (analysisUpdated.encapsulated_count > 0) {
        const encapsulatedTotal = analysisUpdated.encapsulated_count * DESIGN_PRICES.encapsulated;
        designTotal += encapsulatedTotal;
        breakdown.encapsulated = {
          count: analysisUpdated.encapsulated_count,
          price_per_nail: DESIGN_PRICES.encapsulated,
          total: encapsulatedTotal,
        };
      }

      if (analysisUpdated.rhinestones_count > 0) {
        const rhinestonesTotal = analysisUpdated.rhinestones_count * DESIGN_PRICES.rhinestones;
        designTotal += rhinestonesTotal;
        breakdown.rhinestones = {
          count: analysisUpdated.rhinestones_count,
          price_per_nail: DESIGN_PRICES.rhinestones,
          total: rhinestonesTotal,
        };
      }

      return { designTotal, breakdown };
    }

    // 5) Calcular precios para todos los tamaños disponibles del servicio
    const pricesByLength = {};
    const lengthLabels = {
      corto: 'Corto',
      medio: 'Medio',
      largo: 'Largo',
      xl: 'Extra_largo',
    };

    for (const [lengthKey, basePrice] of Object.entries(servicePrices)) {
      const { designTotal } = calculateDesignTotal(lengthKey);
      const minPrice = basePrice + designTotal;
      const max = minPrice + 50;

      pricesByLength[lengthLabels[lengthKey] || lengthKey] = {
        minPrice,
        max,
      };
    }

    console.log('Analysis:', analysis);
    console.log('Prices by length:', pricesByLength);

    return json(200, {
      service,
      analysisUpdated,
      prices_by_length: pricesByLength,
    });
  } catch (e) {
    console.error('quote-nails handler error:', e?.message || e);
    return json(500, {
      error: 'Internal error',
      details: String(e?.message ?? e),
    });
  }
};
