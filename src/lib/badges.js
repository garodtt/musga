// Selos calculados a partir das estatísticas do usuário — não exigem
// nenhuma tabela nova no banco, são derivados de ratings/reviews/lists
// que já existem. Adicionar um selo novo é só adicionar um item aqui.

export const BADGE_DEFINITIONS = [
  {
    id: 'primeira_nota',
    label: 'Primeira nota',
    description: 'Avaliou a primeira faixa',
    check: (s) => s.ratingsCount >= 1,
  },
  {
    id: 'ouvinte_assiduo',
    label: 'Ouvinte assíduo',
    description: 'Avaliou 25 faixas',
    check: (s) => s.ratingsCount >= 25,
  },
  {
    id: 'maratonista',
    label: 'Maratonista',
    description: 'Avaliou 100 faixas',
    check: (s) => s.ratingsCount >= 100,
  },
  {
    id: 'critico',
    label: 'Crítico',
    description: 'Escreveu 10 reviews',
    check: (s) => s.reviewsCount >= 10,
  },
  {
    id: 'curador',
    label: 'Curador',
    description: 'Criou 3 listas',
    check: (s) => s.listsCount >= 3,
  },
  {
    id: 'explorador',
    label: 'Explorador',
    description: 'Avaliou faixas de 10 artistas diferentes',
    check: (s) => s.distinctArtists >= 10,
  },
  {
    id: 'madrugador',
    label: 'Madrugador',
    description: 'Avaliou algo lançado há menos de 7 dias',
    check: (s) => s.hasEarlyBird,
  },
  {
    id: 'nostalgico',
    label: 'Nostálgico',
    description: 'Avaliou um álbum com mais de 20 anos',
    check: (s) => s.hasNostalgic,
  },
  {
    id: 'sequencia_7',
    label: 'Semana cheia',
    description: 'Avaliou algo por 7 dias seguidos',
    check: (s) => s.streakDays >= 7,
  },
]

export function computeBadges(stats) {
  return BADGE_DEFINITIONS.map((b) => ({ ...b, unlocked: b.check(stats) }))
}