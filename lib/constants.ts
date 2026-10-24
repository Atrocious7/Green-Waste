export const COIN_MAPPING: Record<string, number> = {
  Plastic: 15,
  Paper: 10,
  Glass: 20,
  Metal: 20,
  Organic: 10,
  "E-waste": 30,
  "Non-recyclable": 0,
};

export const DEFAULT_CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD || 70);
