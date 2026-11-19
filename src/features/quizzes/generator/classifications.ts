const knownTypes = new Map<string, string>([
  ['direct', 'Direct'],
  ['quotation', 'Quotation'],
  ['quotationcompletion', 'Quotation Completion'],
  ['crossreference', 'Cross-Reference'],
  ['crossreferencequotation', 'Cross-Reference Quotation'],
]);

for (const part of ['Two', 'Three', 'Four', 'Five', 'Six']) {
  const key = `${part.toLowerCase()}part`;
  knownTypes.set(key, `${part}-Part`);
  knownTypes.set(`crossreference${key}`, `${part}-Part · Cross-Reference`);
}

function classification(value?: string) {
  const raw = value?.trim().replace(/\s+/g, ' ') || 'Direct';
  const compact = raw.toLowerCase().replace(/[\s\-–—·]/g, '').replace(/question$/, '');
  const crossPart = compact.match(/^((?:two|three|four|five|six)part)crossreference$/);
  const key = crossPart ? `crossreference${crossPart[1]}` : compact;
  const label = knownTypes.get(key);
  return label ? { key, label } : { key: raw.toLowerCase(), label: raw };
}

export const classificationKey = (value?: string) => classification(value).key;
export const classificationLabel = (value?: string) => classification(value).label;
export const classificationChoices = [...new Set(knownTypes.values())];
