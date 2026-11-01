import type { Division, ScripturePack } from '../types';

function safePart(value: string): string {
  return value.replace(/\b(beginner|junior|intermediate|experienced|juniors|seniors)\b/gi, '').replace(/\b\d{4}\b/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Scripture';
}

type FilenameMaterial = { title: string; season: Pick<ScripturePack['season'], 'year'> };

export function suggestedMaterialFilename(pack: FilenameMaterial): string {
  return `${safePart(pack.title)}-${pack.season.year}-Material.json`;
}

export function suggestedAnalysisFilename(pack: FilenameMaterial, division: Division, version = '1.1'): string {
  return `${safePart(pack.title)}-${pack.season.year}-${division}-Analysis-${version}.json`;
}
